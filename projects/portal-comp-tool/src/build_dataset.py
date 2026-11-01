"""
Build the transfer before/after production dataset from cached CFBD data.

Reads only data/raw/ (never calls the API, never writes to data/raw/) and writes:
    data/processed/transfers.csv     one row per FBS -> FBS transfer
    data/processed/match_report.txt  filter counts, match rates, fuzzy matches to review

Usage (from the project folder):
    python src/build_dataset.py

Key facts this relies on (verified in notebooks/01_explore.ipynb):
- Portal "season" is the player's FIRST season at the destination. A transfer
  with season S is compared at ORIGIN in S-1 (BEFORE) and DESTINATION in S (AFTER).
- PPA `id`, usage `id`, and stats `playerId` are the same CFBD athlete ID. It
  usually (~99.6%) stays the same when a player changes teams, but CFBD sometimes
  issues a new ID (e.g. Bo Nix at Auburn vs Oregon). The portal has no ID, so we
  match on names first, then use the ID to link the other side where possible.
"""

import json
import re
import unicodedata
import warnings
from pathlib import Path

import pandas as pd
from rapidfuzz import fuzz

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "data" / "processed"

# Fuzzy matching only runs within a single team-season, so the candidate pool is
# small (~100 players); 90 on token_sort_ratio still only allows tiny spelling
# differences (e.g. "jamarcus" vs "ja marcus").
FUZZY_THRESHOLD = 90

# Drop transfers whose destination equals their origin (player re-entered and
# returned). Set False to keep them.
DROP_SAME_SCHOOL = True

NAME_SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}

PPA_COLS = [
    "averagePPA.all", "averagePPA.pass", "averagePPA.rush",
    "totalPPA.all", "totalPPA.pass", "totalPPA.rush",
]
USAGE_COLS = ["usage.overall", "usage.pass", "usage.rush"]

# (category, statType) pairs pulled from the long-format stats table.
KEY_STATS = [
    ("passing", "ATT"), ("passing", "COMPLETIONS"), ("passing", "YDS"),
    ("passing", "TD"), ("passing", "INT"),
    ("rushing", "CAR"), ("rushing", "YDS"), ("rushing", "TD"),
    ("receiving", "REC"), ("receiving", "YDS"), ("receiving", "TD"),
    ("defensive", "TOT"), ("defensive", "SOLO"), ("defensive", "TFL"),
    ("defensive", "SACKS"), ("defensive", "QB HUR"), ("defensive", "PD"),
    ("defensive", "TD"), ("interceptions", "INT"),
    ("kicking", "FGM"), ("kicking", "FGA"), ("punting", "NO"), ("punting", "YDS"),
]

# Well-known transfers printed for manual verification: (first, last, season).
SPOT_CHECKS = [
    ("Cam", "Ward", 2024), ("Caleb", "Downs", 2024), ("Jaxson", "Dart", 2022),
    ("Dillon", "Gabriel", 2022), ("Dillon", "Gabriel", 2024), ("Bo", "Nix", 2022),
    ("Michael", "Penix Jr.", 2022), ("Jayden", "Daniels", 2022),
    ("Caleb", "Williams", 2022), ("Will", "Howard", 2024), ("Kyle", "McCord", 2024),
    ("Quinn", "Ewers", 2022), ("Jahmyr", "Gibbs", 2022), ("Jordan", "Addison", 2022),
    ("Riley", "Leonard", 2024), ("Kurtis", "Rourke", 2024), ("Dante", "Moore", 2024),
    ("Carson", "Beck", 2025), ("Tez", "Johnson", 2023), ("DJ", "Uiagalelei", 2024),
    ("Travis", "Hunter", 2023),
]


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #

def load(name: str) -> pd.DataFrame:
    """Combine every cached year of one dataset into a single DataFrame."""
    frames = []
    for path in sorted(RAW_DIR.glob(f"{name}_*.json")):
        df = pd.json_normalize(json.loads(path.read_text(encoding="utf-8")))
        df["pull_year"] = int(path.stem.split("_")[-1])
        frames.append(df)
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def normalize_name(name) -> str:
    """Lowercase, strip accents and punctuation, and drop generational suffixes."""
    if not isinstance(name, str):
        return ""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c)).lower()
    name = name.replace("-", " ")
    name = re.sub(r"[^a-z ]", "", name)
    tokens = name.split()
    while len(tokens) > 2 and tokens[-1] in NAME_SUFFIXES:
        tokens.pop()
    if len(tokens) == 2 and tokens[-1] in NAME_SUFFIXES - {"v"}:
        tokens.pop()  # rare one-token-plus-suffix names
    return " ".join(tokens)


def fbs_schools_by_season(teams: pd.DataFrame) -> dict:
    return teams.groupby("pull_year")["school"].apply(set).to_dict()


# --------------------------------------------------------------------------- #
# Step 2: filter to project scope
# --------------------------------------------------------------------------- #

def filter_portal(portal: pd.DataFrame, fbs: dict, log: list) -> pd.DataFrame:
    """Keep FBS -> FBS transfers, logging rows dropped at each step."""
    df = portal.copy()
    df["full_name"] = (df["firstName"].fillna("") + " " + df["lastName"].fillna("")).str.strip()
    df["name_norm"] = df["full_name"].map(normalize_name)
    log.append(f"Start: {len(df):,} portal entries ({df.season.min()}-{df.season.max()})")

    def step(mask, reason):
        nonlocal df
        log.append(f"  - dropped {(~mask).sum():,} {reason} -> {mask.sum():,} remain")
        df = df[mask].copy()

    step(df["destination"].notna(), "with no destination (incl. withdrawn / unsigned)")
    step(
        df.apply(lambda r: r["destination"] in fbs.get(r["season"], set()), axis=1),
        "whose destination was not FBS in the transfer season",
    )
    step(
        df.apply(lambda r: r["origin"] in fbs.get(r["season"] - 1, set()), axis=1),
        "whose origin was not FBS in the prior season",
    )
    if DROP_SAME_SCHOOL:
        step(df["destination"] != df["origin"], "where destination == origin (returned to same school)")

    # Same player listed twice in one cycle with the same origin and destination:
    # keep the most recent entry.
    df = df.sort_values("transferDate")
    dup = df.duplicated(["season", "name_norm", "origin", "destination"], keep="last")
    step(~dup, "duplicate entries (same season, name, origin, destination; kept latest)")

    df = df.sort_values(["season", "lastName", "firstName"]).reset_index(drop=True)
    df.insert(0, "transfer_id", range(1, len(df) + 1))
    return df


# --------------------------------------------------------------------------- #
# Production tables
# --------------------------------------------------------------------------- #

def drop_conference_dupes(df: pd.DataFrame) -> pd.DataFrame:
    """Drop rows that repeat another row except for a blank conference."""
    return df.drop_duplicates(subset=[c for c in df.columns if c not in ("conference", "pull_year")])


def combine_ppa_rows(ppa: pd.DataFrame, key: list) -> pd.DataFrame:
    """Merge players CFBD splits across two positions (e.g. RB + WR) in one season.

    Totals are summed; averages are recomputed as total / plays, where each row's
    plays = total / average.
    """
    ppa = ppa.copy()
    for split in ("all", "pass", "rush"):
        total, avg = ppa[f"totalPPA.{split}"], ppa[f"averagePPA.{split}"]
        ppa[f"plays.{split}"] = (total / avg).where(avg != 0)
    sum_cols = [c for c in ppa.columns if c.startswith(("totalPPA.", "plays."))]
    out = ppa.groupby(key, as_index=False).agg(
        name=("name", "first"), position=("position", "first"),
        **{c: (c, lambda s: s.sum(min_count=1)) for c in sum_cols},
    )
    for split in ("all", "pass", "rush"):
        out[f"averagePPA.{split}"] = out[f"totalPPA.{split}"] / out[f"plays.{split}"]
    return out


def combine_usage_rows(usage: pd.DataFrame, key: list) -> pd.DataFrame:
    """Sum usage shares for players split across two positions in one season."""
    return usage.groupby(key, as_index=False)[USAGE_COLS].sum(min_count=1)


def build_production(ppa: pd.DataFrame, usage: pd.DataFrame, stats: pd.DataFrame):
    """Return (roster, metrics), both keyed by season / team / player_id.

    roster: every player-team-season with any PPA or box-score row (match candidates)
    metrics: wide PPA + usage + key stats for each player-team-season
    """
    key = ["season", "team", "player_id"]

    ppa = combine_ppa_rows(drop_conference_dupes(ppa.rename(columns={"id": "player_id"})), key)
    usage = combine_usage_rows(drop_conference_dupes(usage.rename(columns={"id": "player_id"})), key)

    stats = stats.rename(columns={"playerId": "player_id"})
    stats = stats.assign(stat=pd.to_numeric(stats["stat"], errors="coerce"))
    wanted = pd.MultiIndex.from_tuples(KEY_STATS)
    stats_key = stats.set_index(["category", "statType"]).index.isin(wanted)
    wide = stats[stats_key].pivot_table(
        index=key, columns=["category", "statType"], values="stat", aggfunc="first"
    )
    wide.columns = [f"{c}_{s}".replace(" ", "_") for c, s in wide.columns]
    wide = wide.reset_index()

    for df in (ppa, usage, stats, wide):
        df["player_id"] = df["player_id"].astype(str)

    roster = pd.concat([
        stats[key + ["player", "position"]].rename(columns={"player": "name"}),
        ppa[key + ["name", "position"]],
    ]).drop_duplicates(key)
    roster["name_norm"] = roster["name"].map(normalize_name)

    metrics = (
        roster[key]
        .merge(ppa[key + PPA_COLS], on=key, how="left")
        .merge(usage[key + USAGE_COLS], on=key, how="left")
        .merge(wide, on=key, how="left")
    )
    metrics.columns = [c.replace(".", "_") for c in metrics.columns]
    return roster.reset_index(drop=True), metrics


# --------------------------------------------------------------------------- #
# Step 3: name matching
# --------------------------------------------------------------------------- #

def match_exact(targets: pd.DataFrame, roster: pd.DataFrame) -> pd.DataFrame:
    """Exact match on normalized name + team + season. Ambiguous hits are left unmatched."""
    hits = targets.merge(roster, on=["season", "team", "name_norm"], how="inner")
    counts = hits.groupby("transfer_id").size()
    unique = hits[hits["transfer_id"].isin(counts[counts == 1].index)]
    out = unique[["transfer_id", "player_id"]].assign(method="exact", score=100.0)
    ambiguous = counts[counts > 1].index
    amb = pd.DataFrame({"transfer_id": ambiguous, "player_id": None,
                        "method": "ambiguous_exact", "score": None})
    return concat_matches(out, amb)


def concat_matches(*frames) -> pd.DataFrame:
    """Concatenate match tables, skipping empty ones.

    Ambiguous and ID-link rows have all-null player_id / score columns by design,
    so pandas' all-NA concat FutureWarning is expected and silenced here.
    """
    frames = [f for f in frames if not f.empty]
    if not frames:
        return pd.DataFrame(columns=["transfer_id", "player_id", "method", "score"])
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FutureWarning)
        return pd.concat(frames, ignore_index=True)


def match_by_id(targets: pd.DataFrame, other_side: pd.DataFrame, roster: pd.DataFrame) -> pd.DataFrame:
    """Link via the CFBD athlete ID already matched on the other side of the transfer."""
    ids = other_side.dropna(subset=["player_id"])[["transfer_id", "player_id"]]
    hits = targets.merge(ids, on="transfer_id").merge(
        roster[["season", "team", "player_id"]], on=["season", "team", "player_id"]
    )
    return hits[["transfer_id", "player_id"]].assign(method="id_link", score=None)


def is_nickname_match(portal_first: str, portal_last: str, cand_norm: str) -> bool:
    """Same last name, and one first name is a prefix of the other (Cam / Cameron)."""
    first, last = normalize_name(portal_first), normalize_name(portal_last)
    if not first or not last or not cand_norm.endswith(" " + last):
        return False
    cand_first = cand_norm[: -len(last) - 1].strip()
    short, long_ = sorted([first.replace(" ", ""), cand_first.replace(" ", "")], key=len)
    return len(short) >= 2 and long_.startswith(short)


def match_fuzzy(targets: pd.DataFrame, roster: pd.DataFrame, claimed: set) -> pd.DataFrame:
    """Fuzzy match within the same team and season. Requires a unique passing candidate."""
    pool = roster[~roster["player_id"].isin(claimed)]
    groups = {k: g for k, g in pool.groupby(["season", "team"])}
    rows = []
    for t in targets.itertuples():
        cands = groups.get((t.season, t.team))
        if cands is None:
            continue
        passing = []
        for c in cands.itertuples():
            score = fuzz.token_sort_ratio(t.name_norm, c.name_norm)
            if score >= FUZZY_THRESHOLD:
                passing.append((c.player_id, "fuzzy", score))
            elif is_nickname_match(t.firstName, t.lastName, c.name_norm):
                passing.append((c.player_id, "fuzzy_nickname", score))
        if len(passing) == 1:
            pid, method, score = passing[0]
            rows.append((t.transfer_id, pid, method, round(score, 1)))
        elif len(passing) > 1:
            rows.append((t.transfer_id, None, "ambiguous_fuzzy", None))
    return pd.DataFrame(rows, columns=["transfer_id", "player_id", "method", "score"])


def side_targets(transfers: pd.DataFrame, side: str) -> pd.DataFrame:
    """Rows to look up for one side: BEFORE = origin in season-1, AFTER = destination in season."""
    cols = ["transfer_id", "name_norm", "firstName", "lastName"]
    if side == "before":
        return transfers[cols].assign(season=transfers["season"] - 1, team=transfers["origin"])
    return transfers[cols].assign(season=transfers["season"], team=transfers["destination"])


def run_matching(transfers: pd.DataFrame, roster: pd.DataFrame) -> dict:
    """Exact -> ID link -> fuzzy, for both sides. Returns {side: match table}."""
    targets = {s: side_targets(transfers, s) for s in ("before", "after")}
    matches = {s: match_exact(targets[s], roster) for s in targets}

    # Use whichever side matched exactly to link the other by athlete ID.
    for side, other in (("before", "after"), ("after", "before")):
        done = matches[side].dropna(subset=["player_id"])["transfer_id"]
        todo = targets[side][~targets[side]["transfer_id"].isin(done)]
        linked = match_by_id(todo, matches[other], roster)
        matches[side] = concat_matches(
            matches[side][~matches[side]["transfer_id"].isin(linked["transfer_id"])], linked
        )

    for side in ("before", "after"):
        done = matches[side].dropna(subset=["player_id"])
        todo = targets[side][~targets[side]["transfer_id"].isin(done["transfer_id"])]
        fuzzy = match_fuzzy(todo, roster, claimed=set(done["player_id"]))
        matches[side] = concat_matches(
            matches[side][~matches[side]["transfer_id"].isin(fuzzy["transfer_id"])], fuzzy
        )

    # A second ID pass picks up sides whose partner was only found by fuzzy match.
    for side, other in (("before", "after"), ("after", "before")):
        done = matches[side].dropna(subset=["player_id"])["transfer_id"]
        todo = targets[side][~targets[side]["transfer_id"].isin(done)]
        linked = match_by_id(todo, matches[other], roster)
        matches[side] = concat_matches(
            matches[side][~matches[side]["transfer_id"].isin(linked["transfer_id"])], linked
        )
    return matches


def attach_production(transfers, matches, roster, metrics) -> pd.DataFrame:
    """Join matched metrics onto each transfer with before_/after_ prefixes."""
    out = transfers.copy()
    for side in ("before", "after"):
        m = matches[side]
        tgt = side_targets(transfers, side)[["transfer_id", "season", "team"]]
        joined = (
            tgt.merge(m, on="transfer_id", how="left")
            .merge(roster[["season", "team", "player_id", "name", "position"]],
                   on=["season", "team", "player_id"], how="left")
            .merge(metrics, on=["season", "team", "player_id"], how="left")
            .drop(columns=["season", "team"])
        )
        joined = joined.rename(columns={"name": "matched_name", "position": "matched_position",
                                        "method": "match_method", "score": "match_score"})
        joined = joined.add_prefix(f"{side}_").rename(columns={f"{side}_transfer_id": "transfer_id"})
        out = out.merge(joined, on="transfer_id", how="left")
        out[f"has_{side}"] = out[f"{side}_player_id"].notna()
    out["no_after_match"] = ~out["has_after"]
    return out


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #

def tidy_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.rename(columns={
        "firstName": "first_name", "lastName": "last_name", "transferDate": "transfer_date",
    })
    df["before_season"] = df["season"] - 1
    lead = ["transfer_id", "season", "before_season", "first_name", "last_name", "full_name",
            "name_norm", "position", "origin", "destination", "transfer_date", "stars",
            "rating", "eligibility", "has_before", "has_after", "no_after_match",
            "ids_disagree"]
    return df[lead + [c for c in df.columns if c not in lead and c != "pull_year"]]


COST_COLUMNS = ["cost_index", "rating_display", "stars_display", "rating_imputed", "cost_index_observed",
                "cost_index_raw_estimate", "position_group",
                "origin_tier", "hs_rating", "hs_stars", "hs_class_year", "years_since_hs",
                "hs_link_method"]


def order_cost_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Place the cost columns right after `eligibility`."""
    rest = [c for c in df.columns if c not in COST_COLUMNS]
    at = rest.index("eligibility") + 1
    return df[rest[:at] + COST_COLUMNS + rest[at:]]


def rate_table(df: pd.DataFrame, by: str) -> pd.DataFrame:
    t = df.groupby(by).agg(n=("transfer_id", "size"),
                           before_rate=("has_before", "mean"),
                           after_rate=("has_after", "mean"))
    t.loc["ALL"] = [len(df), df["has_before"].mean(), df["has_after"].mean()]
    t["n"] = t["n"].astype(int)
    for c in ("before_rate", "after_rate"):
        t[c] = (t[c] * 100).round(1).astype(str) + "%"
    return t


def spot_check(df: pd.DataFrame) -> str:
    cols = ["season", "full_name", "position", "origin", "destination",
            "before_match_method", "before_matched_name", "before_totalPPA_all",
            "before_passing_YDS", "before_rushing_YDS", "before_receiving_YDS", "before_defensive_TOT",
            "after_match_method", "after_matched_name", "after_totalPPA_all",
            "after_passing_YDS", "after_rushing_YDS", "after_receiving_YDS", "after_defensive_TOT"]
    lines = []
    for first, last, season in SPOT_CHECKS:
        hit = df[(df["name_norm"] == normalize_name(f"{first} {last}")) & (df["season"] == season)]
        if hit.empty:
            lines.append(f"{first} {last} ({season}): NOT IN FILTERED DATA (check filters)")
            continue
        for r in hit[cols].to_dict("records"):
            lines.append(f"{first} {last} ({season}) {r['position']}: {r['origin']} -> {r['destination']}")
            for side in ("before", "after"):
                vals = {k.removeprefix(side + "_"): r[k] for k in cols
                        if k.startswith(side + "_") and k not in (f"{side}_match_method", f"{side}_matched_name")
                        and pd.notna(r[k])}
                lines.append(f"    {side.upper():6} [{r[f'{side}_match_method']}] "
                             f"{r[f'{side}_matched_name']}: {vals}")
    return "\n".join(lines)


def write_report(df, filter_log, path: Path) -> str:
    sections = ["TRANSFER DATASET BUILD REPORT", "=" * 60, "", "FILTERS", *filter_log, ""]

    sections += ["MATCH METHODS"]
    for side in ("before", "after"):
        counts = df[f"{side}_match_method"].fillna("unmatched").value_counts()
        sections += [f"  {side.upper()}:", *[f"    {k:18} {v:,}" for k, v in counts.items()]]
    sections += [""]

    sections += ["MATCH RATES BY SEASON", rate_table(df, "season").to_string(), ""]
    sections += ["MATCH RATES BY PORTAL POSITION", rate_table(df, "position").to_string(), ""]
    sections += [
        "NOTE: production data only includes players who recorded a stat. Unmatched",
        "OL / LS / backups mostly reflect 'no stats recorded', not failed name matching.",
        "",
    ]

    both = df[df["has_before"] & df["has_after"]]
    bad = both[both["ids_disagree"]]
    sections += [f"ID CONSISTENCY: {len(both):,} transfers matched on both sides; "
                 f"{len(bad):,} have different athlete IDs before vs after.",
                 "  CFBD sometimes re-issues IDs (Bo Nix), so this is a review list, not proof of error:"]
    sections += [bad[["transfer_id", "season", "full_name", "origin", "destination",
                      "before_player_id", "before_matched_name", "after_player_id",
                      "after_matched_name"]].to_string(index=False) if len(bad) else "  none", ""]

    for side in ("before", "after"):
        fz = df[df[f"{side}_match_method"].isin(["fuzzy", "fuzzy_nickname"])]
        sections += [f"FUZZY MATCHES TO REVIEW ({side.upper()}): {len(fz):,}"]
        if len(fz):
            sections += [fz[["transfer_id", "season", "full_name", "position",
                             "origin" if side == "before" else "destination",
                             f"{side}_matched_name", f"{side}_matched_position",
                             f"{side}_match_method", f"{side}_match_score"]].to_string(index=False)]
        sections += [""]

    amb = df[df["before_match_method"].str.startswith("ambiguous", na=False)
             | df["after_match_method"].str.startswith("ambiguous", na=False)]
    sections += [f"AMBIGUOUS (multiple candidates, left unmatched): {len(amb):,}"]
    if len(amb):
        sections += [amb[["transfer_id", "season", "full_name", "origin", "destination",
                          "before_match_method", "after_match_method"]].to_string(index=False)]
    sections += ["", "SPOT CHECKS", spot_check(df)]

    text = "\n".join(sections)
    path.write_text(text, encoding="utf-8")
    return text


def build() -> pd.DataFrame:
    portal, ppa, usage, stats, teams = (load(n) for n in ("portal", "ppa", "usage", "stats", "teams_fbs"))

    filter_log = []
    transfers = filter_portal(portal, fbs_schools_by_season(teams), filter_log)
    roster, metrics = build_production(ppa, usage, stats)
    matches = run_matching(transfers, roster)

    df = attach_production(transfers, matches, roster, metrics)
    df["ids_disagree"] = (df["has_before"] & df["has_after"]
                          & (df["before_player_id"] != df["after_player_id"]))
    df = tidy_columns(df)

    # Imported here because these modules import helpers from this one.
    from cost_model import add_cost_columns
    from team_aggregate import aggregate_teams
    df, cost_report = add_cost_columns(df, load("recruiting"), teams)
    df = order_cost_columns(df)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    df, team_report = aggregate_teams(df, teams, roster, metrics)
    df.to_csv(OUT_DIR / "transfers.csv", index=False)
    report = write_report(df, filter_log, OUT_DIR / "match_report.txt")
    (OUT_DIR / "cost_model_report.txt").write_text(cost_report, encoding="utf-8")
    print(report)
    print("\n" + cost_report)
    print("\n" + team_report)
    return df


if __name__ == "__main__":
    build()
