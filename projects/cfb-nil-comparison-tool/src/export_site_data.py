"""
Export compact JSON for the /cfb-nil-comparison-tool page into the site's public/ folder.

Runs as the last step of build_dataset.py. Writes to public/data/cfb-nil-comparison-tool/:

    teams.json      every team: branding, 2021-2025 totals, and per-season rows
                    (feeds the leaderboard, the cost vs production scatter, and
                    the team page header)
    transfers.json  every FBS -> FBS transfer, column-oriented to keep it small
                    (feeds the team page's transfer list)

Numbers are rounded to 3 decimals; missing values are null.
"""

import json
import math
from datetime import date

import pandas as pd

from build_dataset import OUT_DIR, ROOT
from team_aggregate import (FEW_MEASURED_SEASON, FEW_MEASURED_TOTAL, INDEX_MEAN, INDEX_SD,
                            MIN_MEASURED_SEASON, MIN_MEASURED_TOTAL, expected_lines)

SITE_DATA_DIR = ROOT.parents[1] / "public" / "data" / "cfb-nil-comparison-tool"

# Team metrics shown on the page. Each `{m}` in INTERVAL_METRICS also exports _lo/_hi.
TEAM_FIELDS = [
    "n_transfers", "n_measured", "n_imputed", "share_imputed",
    "cost_mean", "rating_display_mean", "rating_measured_mean",
    "n_played_after", "hit_rate", "prod_quality_mean", "prod_value_mean",
    "prod_expected_mean",
    "n_gain", "prod_gain_mean", "n_unproven", "n_unproven_played", "unproven_hit_rate",
    "prod_over_expected_mean", "prod_over_expected_signal",
    "leaderboard_eligible", "prod_over_expected_rank",
]
INTERVAL_METRICS = ["prod_over_expected", "prod_value", "hit_rate", "prod_quality"]
ROBUSTNESS_FIELDS = ["tier_baseline", "tier_consistent", "rank_pct_best", "rank_pct_worst"]

TRANSFER_FIELDS = [
    "transfer_id", "season", "full_name", "position", "position_group", "origin",
    "destination", "stars", "rating", "cost_index", "rating_display", "stars_display", "rating_imputed", "transfer_profile",
    "production_measured", "played_before", "played_after",
    "prod_index_before", "prod_index_after", "prod_gain", "prod_value_after", "prod_expected", "prod_actual_raw", "prod_expected_raw",
    "prod_ref_group_after",
    "prod_over_expected",
    # headline stats at the new school
    "after_totalPPA_all", "after_passing_YDS", "after_passing_TD", "after_rushing_YDS",
    "after_rushing_TD", "after_receiving_REC", "after_receiving_YDS", "after_receiving_TD",
]


def clean(value):
    """JSON-safe scalar: round floats, NaN -> None, numpy types -> Python types."""
    if value is None or isinstance(value, (str, bool, list, dict)):
        return value
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, float):
        if math.isnan(value):
            return None
        return int(value) if value.is_integer() else round(value, 3)
    return value


def team_record(row: pd.Series, robustness: bool) -> dict:
    fields = TEAM_FIELDS + [f"{m}_{s}" for m in INTERVAL_METRICS for s in ("lo", "hi")]
    if robustness:
        fields += ROBUSTNESS_FIELDS
    return {f: clean(row[f]) for f in fields}


def branding(teams_fbs: pd.DataFrame) -> dict:
    """Latest school name, abbreviation, colors and logo per team."""
    latest = teams_fbs.sort_values("pull_year").drop_duplicates("school", keep="last")
    return {
        r.school: {
            "abbreviation": r.abbreviation,
            "color": r.color,
            "alt_color": r.alternateColor,
            "logo": r.logos[0] if isinstance(r.logos, list) and r.logos else None,
            "logo_dark": r.logos[1] if isinstance(r.logos, list) and len(r.logos) > 1 else None,
        }
        for r in latest.itertuples()
    }


def overall_averages(transfers: pd.DataFrame) -> dict:
    """Reference lines for the scatter plot and leaderboard."""
    m = transfers[transfers["production_measured"].astype(bool)]
    return {
        "cost_mean": clean(transfers["cost_index"].mean()),
        "rating_display_mean": clean(transfers["rating_display"].mean()),
        "rating_measured_mean": clean(m["rating_display"].mean()),  # QB/RB/WR/TE only
        "prod_value_mean": clean(m["prod_value_after"].mean()),
        "hit_rate": clean(m["has_after"].astype(float).mean()),
        "prod_quality_mean": clean(m["prod_index_after"].mean()),
        "prod_over_expected_mean": clean(m["prod_over_expected"].mean()),
    }


# Worked example for the page's reading guide: (full_name, portal season).
EXAMPLE_TRANSFER = ("Cam Ward", 2024)


def example_line(transfers: pd.DataFrame, group: str) -> dict:
    """The expected-production line for the example player's position group, with
    every measured transfer in that group as (cost, production) points to draw it."""
    slope, intercept = expected_lines(transfers)[group]
    g = transfers[transfers["production_measured"].astype(bool)
                  & (transfers["position_group"] == group)]
    return {
        "position": group,
        "n": int(len(g)),
        "slope": clean(slope),
        "intercept": clean(intercept),
        "points": [[round(float(c), 1), round(float(v), 1)]
                   for c, v in zip(g["cost_index"], g["prod_value_after"])],
    }


def worked_example(transfers: pd.DataFrame, totals: pd.DataFrame) -> dict:
    """One transfer traced from cost to his new team's score, for the reading guide."""
    name, season = EXAMPLE_TRANSFER
    t = transfers[(transfers["full_name"] == name) & (transfers["season"] == season)].iloc[0]
    team = totals.set_index("team").loc[t["destination"]]
    season_ratings = transfers.loc[transfers["season"] == season, "rating"].dropna()
    return {
        "player": {
            "name": name, "season": int(season), "position": t["position"],
            "origin": t["origin"], "destination": t["destination"],
            "stars": int(t["stars_display"]),
            "rating": clean(t["rating_display"]),
            "season_rating_mean": clean(season_ratings.mean()),
            "season_rating_sd": clean(season_ratings.std()),
            "cost": clean(t["cost_index"]),
            "production": clean(t["prod_value_after"]),
            "expected": clean(t["prod_value_after"] - t["prod_over_expected"]),
            "over_expected": clean(t["prod_over_expected"]),
            "group": t["prod_ref_group_after"],
            "actual_raw": clean(t["prod_actual_raw"]),
            "expected_raw": clean(t["prod_expected_raw"]),
        },
        "line": example_line(transfers, t["position_group"]),
        "team": {
            "name": t["destination"],
            "n_measured": clean(team["n_measured"]),
            "mean": clean(team["prod_over_expected_mean"]),
            "lo": clean(team["prod_over_expected_lo"]),
            "hi": clean(team["prod_over_expected_hi"]),
            "rank": clean(team["prod_over_expected_rank"]),
            "n_ranked": int(totals["leaderboard_eligible"].sum()),
            "signal": team["prod_over_expected_signal"],
        },
    }


def build_teams_json(transfers, seasons, totals, teams_fbs, units) -> dict:
    brand = branding(teams_fbs)
    by_team = {t: g for t, g in seasons.groupby("team")}
    teams = []
    for row in totals.sort_values("team").itertuples(index=False):
        row = pd.Series(row._asdict())
        team_seasons = by_team[row["team"]].sort_values("season")
        teams.append({
            "team": row["team"],
            "conference": row["conference_latest"],
            **brand.get(row["team"], {}),
            "totals": team_record(row, robustness=True),
            "seasons": {
                str(int(s["season"])): {"conference": s["conference"], **team_record(s, robustness=False)}
                for _, s in team_seasons.iterrows()
            },
        })
    return {
        "meta": {
            "generated": date.today().isoformat(),
            "seasons": sorted(int(s) for s in seasons["season"].unique()),
            "min_measured_total": MIN_MEASURED_TOTAL,
            "min_measured_season": MIN_MEASURED_SEASON,
            "few_measured_total": FEW_MEASURED_TOTAL,
            "few_measured_season": FEW_MEASURED_SEASON,
            "index": {"mean": INDEX_MEAN, "sd": INDEX_SD},
            "units": units,
            "averages": overall_averages(transfers),
            "example": worked_example(transfers, totals),
            "notes": [
                "cost = portal rating vs that season's transfers, 0 = average (imputed when missing)",
                "production = rating vs all FBS players at the same position group, 0 = average",
                "ratings: 0 = average, + above, - below, 10 points = one standard deviation, capped at +30",
                "team values are plain averages; *_lo/*_hi are 95% ranges around them",
            ],
        },
        "teams": teams,
    }


def build_transfers_json(transfers: pd.DataFrame) -> dict:
    rows = transfers[TRANSFER_FIELDS].sort_values(["destination", "season", "full_name"])
    return {
        "columns": TRANSFER_FIELDS,
        "rows": [[clean(v) for v in r] for r in rows.itertuples(index=False)],
    }


def export_site_data(transfers, seasons, totals, teams_fbs, units) -> str:
    """Write the JSON files and return a one-line summary per file."""
    SITE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    outputs = {
        "teams.json": build_teams_json(transfers, seasons, totals, teams_fbs, units),
        "transfers.json": build_transfers_json(transfers),
    }
    lines = []
    for name, payload in outputs.items():
        path = SITE_DATA_DIR / name
        path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
        lines.append(f"{path.relative_to(ROOT.parents[1])}: {path.stat().st_size / 1024:,.0f} KB")
    return "\n".join(lines)
