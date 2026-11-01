"""
Aggregate transfer cost and production to the team level.

Runs as the last step of build_dataset.py. Adds production columns to
transfers.csv and writes:
    data/processed/team_seasons.csv  one row per FBS team per season (2021-2025)
    data/processed/team_totals.csv   one row per team, all seasons combined
    data/processed/team_report.txt   coverage, correlations, top/bottom teams

Teams are credited with their INCOMING transfers: the destination school in the
transfer's portal season.

Production is put on a 0-centered scale so positions can be compared
(0 = average, + above, - below, 10 = one standard deviation, like DVOA or EPA):
1. A raw production score per player-season: total PPA (predicted points added,
   CFBD's college version of EPA). Only QB, RB, WR and TE have PPA, so only they are
   scored; defenders, OL and specialists count toward cost but not production.
2. Each transfer's before and after scores become an index against ALL FBS
   players in that season's production data with the same broad position group
   (players who recorded at least one stat on an FBS team). Pool scores are capped
   at their 1st and 99th percentiles before the mean and SD are taken, and so is
   the transfer's score, so one outlier season can't dominate a team average.
   The group comes from the position the transfer is listed at in that season's
   production data, so he's compared with the same labels the pool uses.
3. Playing time and quality are kept apart:
   - played_before / played_after: did he record any stat on that side
   - prod_index_before / prod_index_after: index, only for sides where he played
   - prod_gain: after - before, only for transfers who played on BOTH sides
   - transfer_profile: "proven" (played before) or "unproven" (no stats before;
     redshirt, injury, or depth, which the data can't tell apart)
4. prod_value_after combines the two: the index if he played, otherwise the index
   of zero production in his pool. It is what production over expected and team
   production averages use, so misses still count against the team.
"""

import numpy as np
import pandas as pd

from build_dataset import OUT_DIR, fbs_schools_by_season

# Portal position groups that get a production score: the ones PPA covers.
MEASURED_PORTAL_GROUPS = {"QB", "RB", "WR", "TE", "ATH"}

# Reference groups for the comparison pools (FB counts as RB).
REF_GROUP = {
    "QB": "QB", "RB": "RB", "FB": "RB", "WR": "WR", "TE": "TE",
    "ATH": "WR",  # portal-only label; used only when production data has no usable position
}
OFFENSE_REF = {"QB", "RB", "WR", "TE"}

# 0-centered scale, like DVOA or EPA: 0 = average, + above, - below, 10 points
# = one SD. Values above +30 (3 SD) are capped so one outlier can't dominate.
INDEX_MEAN, INDEX_SD = 0, 10
INDEX_MAX = 30
CAP_PERCENTILES = (1, 99)  # pool scores are capped here before the mean/SD


# --------------------------------------------------------------------------- #
# Production scores and FBS reference pools
# --------------------------------------------------------------------------- #

def production_score(df: pd.DataFrame, ref_group: pd.Series, prefix: str = "") -> pd.Series:
    """Raw production: season total PPA (0 if a player with stats has no PPA row)."""
    score = df[f"{prefix}totalPPA_all"].fillna(0).where(ref_group.isin(OFFENSE_REF))
    return pd.Series(score, index=df.index)


def fbs_reference_pools(roster: pd.DataFrame, metrics: pd.DataFrame, teams: pd.DataFrame,
                        cap: tuple = CAP_PERCENTILES) -> dict:
    """Index parameters for every FBS player-season pool, by (season, ref group):
    (cap_low, cap_high, mean, sd), with mean and SD taken after capping."""
    fbs = fbs_schools_by_season(teams)
    key = ["season", "team", "player_id"]
    pool = metrics.merge(roster[key + ["position"]], on=key)
    pool = pool[[t in fbs.get(s, ()) for s, t in zip(pool["season"], pool["team"])]]
    pool = pool.assign(ref_group=pool["position"].map(REF_GROUP)).dropna(subset=["ref_group"])
    pool["score"] = production_score(pool, pool["ref_group"])
    params = {}
    for key_, g in pool.groupby(["season", "ref_group"]):
        lo, hi = np.percentile(g["score"], cap)
        capped = g["score"].clip(lo, hi)
        params[key_] = (lo, hi, capped.mean(), capped.std())
    return params


def index_in_pool(value: float, params: tuple) -> float:
    """Production index of a raw score against one pool (capped like the pool)."""
    lo, hi, mean, sd = params
    index = INDEX_MEAN + INDEX_SD * (min(max(value, lo), hi) - mean) / sd
    return min(index, INDEX_MAX)




def unit_translations(pools: dict) -> dict:
    """What the rating scale means in real stats, per position group, averaged over
    seasons: the raw score at 0 (the pool average) and what +10 adds (one pool SD)."""
    rows = pd.DataFrame([(g, mean, sd) for (_, g), (_, _, mean, sd) in pools.items()],
                        columns=["group", "mean", "sd"])
    avg = rows.groupby("group")[["mean", "sd"]].mean()
    return {g: {"unit": "points added", "zero": round(float(avg.loc[g, "mean"]), 1),
                "per10": round(float(avg.loc[g, "sd"]), 1)}
            for g in ["QB", "RB", "WR", "TE"] if g in avg.index}


def side_ref_group(df: pd.DataFrame, side: str) -> pd.Series:
    """Reference group for one side: the position listed in that season's production
    data, falling back to the portal position when that label isn't usable (or is a
    defensive one, which PPA doesn't cover)."""
    from_stats = df[f"{side}_matched_position"].map(REF_GROUP)
    return from_stats.fillna(df["position_group"].map(REF_GROUP))


def add_production_columns(df, pools: dict) -> pd.DataFrame:
    df = df.copy()
    measured = df["position_group"].isin(MEASURED_PORTAL_GROUPS)
    df["production_measured"] = measured
    for side, season_col in (("before", "before_season"), ("after", "season")):
        played = df[f"has_{side}"] & measured
        group = side_ref_group(df, side).where(measured)
        df[f"played_{side}"] = df[f"has_{side}"].where(measured)
        df[f"prod_ref_group_{side}"] = group
        df[f"prod_score_{side}"] = production_score(df, group, f"{side}_").where(played)
        df[f"prod_index_{side}"] = [
            index_in_pool(score, pools[(season, g)]) if p else np.nan
            for p, g, score, season in zip(played, group, df[f"prod_score_{side}"], df[season_col])
        ]
    df["prod_gain"] = df["prod_index_after"] - df["prod_index_before"]  # NaN unless both sides played
    df["transfer_profile"] = np.where(
        ~measured, None, np.where(df["has_before"], "proven", "unproven"))

    # A transfer who didn't play gets the index of zero production in his pool.
    zero_index = pd.Series(
        [index_in_pool(0.0, pools[(s, g)]) if m else np.nan
         for m, g, s in zip(measured, df["prod_ref_group_after"], df["season"])],
        index=df.index)
    df["prod_value_after"] = df["prod_index_after"].where(df["has_after"], zero_index).where(measured)
    df["prod_over_expected"] = production_over_expected(df)
    df["prod_expected"] = df["prod_value_after"] - df["prod_over_expected"]  # what his cost predicts

    # The same two numbers in real stats, total PPA ("points added"). A rating r maps back to
    # pool mean + r / INDEX_SD * pool SD. Players who didn't play produced 0.
    def to_raw(rating, season, group):
        _, _, mean, sd = pools[(season, group)]
        return mean + (rating - INDEX_MEAN) / INDEX_SD * sd
    df["prod_actual_raw"] = df["prod_score_after"].where(df["has_after"], 0.0).where(measured)
    df["prod_expected_raw"] = [
        to_raw(r, s, g) if m and pd.notna(r) else np.nan
        for m, r, s, g in zip(measured, df["prod_expected"], df["season"], df["prod_ref_group_after"])
    ]
    return df


def production_over_expected(df: pd.DataFrame) -> pd.Series:
    """AFTER production value minus what cost predicts for that position group.

    Fits prod_value_after ~ cost_index separately per position group (least squares
    on measured transfers). Uses the combined value (zero production if he didn't play), so it
    rewards both getting on the field and playing well. Positive = more than the
    cost suggested.
    """
    out = pd.Series(np.nan, index=df.index)
    measured = df[df["production_measured"]]
    lines = expected_lines(df)
    for group, g in measured.groupby("position_group"):
        slope, intercept = lines[group]
        out.loc[g.index] = g["prod_value_after"] - (intercept + slope * g["cost_index"])
    return out


def expected_lines(df: pd.DataFrame) -> dict:
    """Straight-line fit of prod_value_after on cost_index for each position group:
    {group: (slope, intercept)}. Expected production = intercept + slope * cost."""
    measured = df[df["production_measured"]]
    return {
        group: tuple(np.polyfit(g["cost_index"], g["prod_value_after"], 1))
        for group, g in measured.groupby("position_group")
    }


# --------------------------------------------------------------------------- #
# Team aggregation
# --------------------------------------------------------------------------- #

def aggregate(df: pd.DataFrame, keys: list) -> pd.DataFrame:
    """Cost and production averages and counts for each group of incoming transfers."""
    m = df[df["production_measured"]]
    cost = df.groupby(keys).agg(
        n_transfers=("transfer_id", "size"),
        cost_mean=("cost_index", "mean"),
        rating_display_mean=("rating_display", "mean"),
        n_imputed=("rating_imputed", "sum"),
    )
    unproven = m["transfer_profile"] == "unproven"
    prod = m.assign(
        is_unproven=unproven, unproven_played=unproven & m["has_after"],
        prod_expected=m["prod_value_after"] - m["prod_over_expected"],
    ).groupby(keys).agg(
        n_measured=("transfer_id", "size"),
        rating_measured_mean=("rating_display", "mean"),  # scored players only
        n_played_after=("has_after", "sum"),
        hit_rate=("has_after", "mean"),
        prod_quality_mean=("prod_index_after", "mean"),     # among those who played
        prod_value_mean=("prod_value_after", "mean"),       # zero production if they didn't
        prod_expected_mean=("prod_expected", "mean"),       # what their cost predicts
        prod_value_sum=("prod_value_after", "sum"),         # totals: the leaderboard measure
        prod_expected_sum=("prod_expected", "sum"),
        n_gain=("prod_gain", "count"),                      # played on both sides
        prod_gain_mean=("prod_gain", "mean"),
        n_unproven=("is_unproven", "sum"),
        n_unproven_played=("unproven_played", "sum"),
        prod_over_expected_sum=("prod_over_expected", "sum"),
        prod_over_expected_mean=("prod_over_expected", "mean"),
    )
    out = cost.join(prod, how="left")
    out["share_imputed"] = out["n_imputed"] / out["n_transfers"]
    out["unproven_hit_rate"] = out["n_unproven_played"] / out["n_unproven"]

    m = m.assign(has_after=m["has_after"].astype(float))
    for team_col, transfer_col in INTERVAL_METRICS.items():
        out = out.join(mean_intervals(m, transfer_col, keys).add_prefix(team_col))
    out[["hit_rate_lo", "hit_rate_hi"]] = out[["hit_rate_lo", "hit_rate_hi"]].clip(0, 1)
    # 95% range for the total: the mean's range times the number of scored transfers.
    out["prod_over_expected_sum_lo"] = out["prod_over_expected_lo"] * out["n_measured"]
    out["prod_over_expected_sum_hi"] = out["prod_over_expected_hi"] * out["n_measured"]
    out["prod_over_expected_signal"] = np.select(
        [out["prod_over_expected_lo"] > 0, out["prod_over_expected_hi"] < 0],
        ["above", "below"], default="uncertain")
    out.loc[out["n_measured"].isna(), "prod_over_expected_signal"] = None
    return out


# --------------------------------------------------------------------------- #
# Uncertainty ranges
# --------------------------------------------------------------------------- #

# Team column prefix -> transfer-level column it averages. Each gets a 95% range.
INTERVAL_METRICS = {
    "prod_over_expected": "prod_over_expected",
    "prod_value": "prod_value_after",
    "hit_rate": "has_after",
    "prod_quality": "prod_index_after",
}

# Minimum measured transfers to appear on a leaderboard. Every team with at least
# one is ranked by its plain average; small groups get wide ranges and a flag.
MIN_MEASURED_TOTAL = 1
MIN_MEASURED_SEASON = 1

# Below these, the site flags a team's score as resting on few transfers.
FEW_MEASURED_TOTAL = 10
FEW_MEASURED_SEASON = 3


def mean_intervals(df: pd.DataFrame, value: str, keys: list) -> pd.DataFrame:
    """95% range around each group's plain mean: mean +/- 1.96 * s / sqrt(n).

    The means themselves are not adjusted. s is the pooled within-group standard
    deviation, so even a group of one gets a (wide) range. Returns _lo / _hi.
    """
    d = df.dropna(subset=[value])
    g = d.groupby(keys)[value]
    n, mean = g.size(), g.mean()
    within = ((d[value] - g.transform("mean")) ** 2).sum() / (len(d) - len(n))
    half = 1.96 * np.sqrt(within / n)
    return pd.DataFrame({"_lo": mean - half, "_hi": mean + half})


def add_ranks(df: pd.DataFrame, min_measured: int, by: list = None) -> pd.DataFrame:
    """Leaderboard rank by production over expected per player (1 = best), eligible rows
    only. Each player's difference already accounts for his price, so the average is the
    school's value above price per transfer."""
    df = df.copy()
    df["leaderboard_eligible"] = df["n_measured"].fillna(0) >= min_measured
    eligible = df[df["leaderboard_eligible"]]
    ranks = (eligible.groupby(by)["prod_over_expected_mean"] if by
             else eligible["prod_over_expected_mean"]).rank(ascending=False, method="min")
    df["prod_over_expected_rank"] = ranks.reindex(df.index)
    return df


def team_seasons(df: pd.DataFrame, teams: pd.DataFrame) -> pd.DataFrame:
    """One row per FBS team per season, including teams with no incoming transfers."""
    fbs = fbs_schools_by_season(teams)
    conf = teams.rename(columns={"pull_year": "season", "school": "team"})[["season", "team", "conference"]]
    grid = pd.DataFrame([(s, t) for s in sorted(df["season"].unique()) for t in sorted(fbs[s])],
                        columns=["season", "team"])
    agg = aggregate(df.rename(columns={"destination": "team"}), ["season", "team"]).reset_index()
    out = grid.merge(conf, on=["season", "team"], how="left").merge(agg, on=["season", "team"], how="left")
    count_cols = ["n_transfers", "n_imputed", "n_measured", "n_played_after", "n_gain",
                  "n_unproven", "n_unproven_played"]
    zero_cols = count_cols + ["prod_over_expected_sum"]
    out[zero_cols] = out[zero_cols].fillna(0)
    out[count_cols] = out[count_cols].astype(int)
    return add_ranks(out, MIN_MEASURED_SEASON, by=["season"])


def team_totals(df: pd.DataFrame, seasons: pd.DataFrame) -> pd.DataFrame:
    """All seasons combined, for every team that was FBS in any season."""
    agg = aggregate(df.rename(columns={"destination": "team"}), ["team"]).reset_index()
    fbs_years = seasons.groupby("team").agg(
        seasons_fbs=("season", "size"), conference_latest=("conference", "last"))
    out = fbs_years.reset_index().merge(agg, on="team", how="left")
    out["n_transfers"] = out["n_transfers"].fillna(0).astype(int)
    return add_ranks(out, MIN_MEASURED_TOTAL).sort_values("prod_over_expected_rank")


# --------------------------------------------------------------------------- #
# Report
# --------------------------------------------------------------------------- #

def write_report(df, seasons, totals, path) -> str:
    m = df[df["production_measured"]]
    show = ["team", "n_measured", "cost_mean", "hit_rate", "prod_quality_mean",
            "prod_expected_mean", "prod_value_mean", "prod_over_expected_mean",
            "prod_over_expected_lo", "prod_over_expected_hi", "prod_over_expected_signal"]
    board = totals[totals["leaderboard_eligible"]].sort_values("prod_over_expected_rank")
    signal = board["prod_over_expected_signal"].value_counts()
    season_board = seasons[seasons["leaderboard_eligible"]]
    by_size = (seasons.dropna(subset=["prod_over_expected_mean"])
               .assign(n_bin=lambda d: pd.cut(d["n_measured"], [0, 4, 9, 14, 100]))
               .groupby("n_bin", observed=True)
               .agg(team_seasons=("team", "size"),
                    sd_of_team_means=("prod_over_expected_mean", "std"))
               .round(2))

    corr = m.assign(played_after=m["has_after"].astype(float))[
        ["cost_index", "played_after", "prod_index_after", "prod_value_after", "prod_gain"]
    ].corr(method="spearman").round(3)
    team_corr = seasons[seasons["n_measured"] > 0][
        ["cost_mean", "prod_value_mean", "hit_rate", "prod_quality_mean"]
    ].corr(method="spearman").round(3)

    profile = m.groupby("transfer_profile").agg(
        n=("transfer_id", "size"), hit_rate=("has_after", "mean"),
        quality_if_played=("prod_index_after", "mean"), cost_mean=("cost_index", "mean"),
    ).round(2)
    gain = m["prod_gain"].dropna()

    lines = [
        "TEAM AGGREGATION REPORT", "=" * 60, "",
        f"Transfers: {len(df):,}  |  production measured: {len(m):,} "
        f"({df['production_measured'].mean():.1%})  |  not measured (no PPA: defense, OL, K/P/LS): "
        f"{(~df['production_measured']).sum():,}",
        f"Team-seasons: {len(seasons):,}  ({(seasons['n_transfers'] == 0).sum()} with no incoming transfers)",
        "",
        "Production index: 0 = average FBS player with stats at the same broad position",
        "group (QB/RB/WR/TE) that season; 10 points = one SD; capped at +30.",
        "",
        "HIT RATE (share who recorded a stat at the new school) AND QUALITY IF PLAYED",
        m.groupby("position_group").agg(
            n=("transfer_id", "size"), hit_rate=("has_after", "mean"),
            quality_if_played=("prod_index_after", "mean")).round(2).to_string(),
        "",
        "PROVEN (played before) vs UNPROVEN (no stats before)",
        profile.to_string(),
        "",
        f"PRODUCTION GAIN (played on both sides only): n = {len(gain):,}, "
        f"mean {gain.mean():+.1f}, median {gain.median():+.1f} index points, "
        f"improved {(gain > 0).mean():.1%}",
        "",
        "TRANSFER-LEVEL SPEARMAN CORRELATIONS (measured transfers; pairwise)",
        corr.to_string(),
        "",
        "TEAM-SEASON SPEARMAN CORRELATIONS",
        team_corr.to_string(),
        "",
        "SMALL GROUPS (team averages are plain means, not adjusted)",
        "Spread of team-season production over expected by number of measured transfers:",
        by_size.to_string(),
        "",
        f"LEADERBOARD ELIGIBILITY: totals need >= {MIN_MEASURED_TOTAL} measured transfers "
        f"({len(board)} of {len(totals)} teams); team-seasons need >= {MIN_MEASURED_SEASON} "
        f"({len(season_board)} of {len(seasons)} team-seasons)",
        f"95% interval excludes average: above {signal.get('above', 0)}, "
        f"below {signal.get('below', 0)}, uncertain {signal.get('uncertain', 0)}",
        "",
        "TOP 15 TEAMS BY AVERAGE COST, 2021-2025 (leaderboard-eligible teams)",
        board.sort_values("cost_mean", ascending=False).head(15)[
            ["team", "n_transfers", "cost_mean"]].round(1).to_string(index=False),
        "",
        "TOP 15 BY PRODUCTION OVER EXPECTED (leaderboard-eligible teams)",
        board.head(15)[show].round(2).to_string(index=False),
        "",
        "BOTTOM 15 BY PRODUCTION OVER EXPECTED (leaderboard-eligible teams)",
        board.tail(15).iloc[::-1][show].round(2).to_string(index=False),
    ]
    text = "\n".join(lines)
    path.write_text(text, encoding="utf-8")
    return text


def aggregate_teams(df: pd.DataFrame, teams: pd.DataFrame, roster: pd.DataFrame,
                    metrics: pd.DataFrame):
    """Add production columns to transfers and write the team files.

    Returns (transfers with production columns, report text). Called by build_dataset.py.
    """
    # Imported here because robustness imports helpers from this module.
    from robustness import run_robustness
    robust, robust_report = run_robustness(df, roster, metrics, teams)
    (OUT_DIR / "robustness_report.txt").write_text(robust_report, encoding="utf-8")

    pools = fbs_reference_pools(roster, metrics, teams)
    df = add_production_columns(df, pools)
    seasons = team_seasons(df, teams)
    totals = team_totals(df, seasons).merge(robust, left_on="team", right_index=True, how="left")
    seasons.to_csv(OUT_DIR / "team_seasons.csv", index=False)
    totals.to_csv(OUT_DIR / "team_totals.csv", index=False)

    from export_site_data import export_site_data
    exported = export_site_data(df, seasons, totals, teams, unit_translations(pools))
    report = write_report(df, seasons, totals, OUT_DIR / "team_report.txt")
    return df, report + "\n\nSITE DATA EXPORTED\n" + exported
