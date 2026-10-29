"""
Robustness checks for the team leaderboard (production over expected per player).

Re-runs production scoring and team aggregation under alternative choices and
compares each team's leaderboard position with the baseline:

    no_cap          don't cap pool PPA at the 1st/99th percentiles
    rated_only      drop transfers whose rating was imputed
    no_2021         drop the 2021 portal class (its data looks incomplete)

Positions are compared as percentile ranks among leaderboard-eligible teams, since
the number of eligible teams changes when transfers are dropped. A team's tier is
top / middle / bottom third; `tier_consistent` means it lands in the same tier in
every variant where it is eligible.

Called from team_aggregate.aggregate_teams; writes data/processed/robustness_report.txt.
"""

import pandas as pd

from team_aggregate import (CAP_PERCENTILES, MIN_MEASURED_TOTAL, add_production_columns,
                            add_ranks, aggregate, fbs_reference_pools)

VARIANTS = {
    "baseline": {},
    "no_cap": {"cap": (0, 100)},
    "rated_only": {"keep": lambda d: ~d["rating_imputed"].astype(bool)},
    "no_2021": {"keep": lambda d: d["season"] != 2021},
}
TIERS = ["top", "middle", "bottom"]


def variant_leaderboard(transfers, roster, metrics, teams, cap=CAP_PERCENTILES, keep=None):
    """Team totals leaderboard under one set of choices."""
    df = transfers[keep(transfers)] if keep else transfers
    scored = add_production_columns(df, fbs_reference_pools(roster, metrics, teams, cap))
    totals = add_ranks(aggregate(scored.rename(columns={"destination": "team"}), ["team"]),
                       MIN_MEASURED_TOTAL)
    board = totals[totals["leaderboard_eligible"]]
    return pd.DataFrame({
        "mean": board["prod_over_expected_mean"],
        "rank": board["prod_over_expected_rank"],
        "rank_pct": board["prod_over_expected_rank"] / len(board),  # 0 = best
    })


def tier(rank_pct: pd.Series) -> pd.Series:
    return pd.cut(rank_pct, [0, 1 / 3, 2 / 3, 1], labels=TIERS, include_lowest=True)


def run_robustness(transfers, roster, metrics, teams):
    """Return (per-team robustness table, report text)."""
    boards = {name: variant_leaderboard(transfers, roster, metrics, teams, **opts)
              for name, opts in VARIANTS.items()}
    base = boards["baseline"]

    ranks = pd.DataFrame({name: b["rank_pct"] for name, b in boards.items()})
    tiers = ranks.apply(tier)
    per_team = pd.DataFrame(index=base.index)
    per_team["tier_baseline"] = tiers["baseline"]
    per_team["rank_pct_best"] = ranks.min(axis=1)
    per_team["rank_pct_worst"] = ranks.max(axis=1)
    per_team["tier_consistent"] = tiers.loc[base.index].nunique(axis=1, dropna=True) == 1
    per_team["variants_eligible"] = ranks.loc[base.index].notna().sum(axis=1)

    summary = []
    for name, b in boards.items():
        common = base.index.intersection(b.index)
        top_base = set(base["rank"].nsmallest(10).index)
        bottom_base = set(base["rank"].nlargest(10).index)
        summary.append({
            "variant": name,
            "eligible_teams": len(b),
            "spearman_vs_baseline": base.loc[common, "mean"].corr(b.loc[common, "mean"], method="spearman"),
            "top10_overlap": len(top_base & set(b["rank"].nsmallest(10).index)),
            "bottom10_overlap": len(bottom_base & set(b["rank"].nlargest(10).index)),
        })
    summary = pd.DataFrame(summary).set_index("variant").round(3)

    consistent = per_team[per_team["tier_consistent"]]
    show = base.join(per_team).sort_values("rank")
    show["rank_pct_best"] = (show["rank_pct_best"] * 100).round().astype(int)
    show["rank_pct_worst"] = (show["rank_pct_worst"] * 100).round().astype(int)
    cols = ["rank", "mean", "tier_baseline", "rank_pct_best", "rank_pct_worst", "tier_consistent"]

    lines = [
        "ROBUSTNESS REPORT (team totals, adjusted production over expected)", "=" * 60, "",
        "Variants: " + ", ".join(VARIANTS), "",
        "AGREEMENT WITH BASELINE",
        summary.to_string(), "",
        f"Teams in the same tier (top/middle/bottom third) in every variant: "
        f"{len(consistent)} of {len(per_team)}",
        "  " + ", ".join(f"{t}: {(consistent['tier_baseline'] == t).sum()}" for t in TIERS), "",
        "BASELINE LEADERBOARD WITH RANK RANGE ACROSS VARIANTS",
        "(rank_pct: 0 = best, 100 = worst)",
        show[cols].round(3).to_string(),
    ]
    return per_team, "\n".join(lines)
