"""
Transfer "cost" proxy: portal rating as a 0-centered rating within its portal season.

Called from build_dataset.py after matching. For transfers with a portal rating,
cost index = 10 * z (capped at +30), where z is how many standard deviations the
rating sits above the season's average among rated FBS -> FBS transfers
(0 = average cost, + pricier, - cheaper).
For transfers without one, a gradient-boosted model estimates the index from
information available at transfer time, and `rating_imputed` is set to True.

Model features (by design, see README):
- prior-season PPA and usage at the origin school
- position group
- origin tier (Power vs G5, from the origin's conference in the prior season)
- portal eligibility status, and years since high school class (class-year proxy)
- high school recruiting rating and stars, where the recruit can be linked

Portal `stars` are bands of the portal rating (2* = 0.73-0.79, 3* = 0.80-0.89, ...),
so they are also used two ways:
- as a model feature (USE_PORTAL_STARS)
- to clamp each estimate into the index range that rated transfers with the
  same stars reached in that season (CLAMP_TO_STAR_BAND)
"""

import numpy as np
import pandas as pd
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import KFold, cross_val_predict

from build_dataset import normalize_name

USE_PORTAL_STARS = True
CLAMP_TO_STAR_BAND = True
RANDOM_STATE = 42

POWER_CONFERENCES = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
LAST_POWER_PAC12_SEASON = 2023  # Pac-12 had only Oregon State + Washington State after this

# Collapse rare portal position labels into the main groups.
POSITION_GROUPS = {
    "OLB": "LB", "ILB": "LB", "DT": "DL", "WDE": "EDGE", "SDE": "EDGE",
    "OG": "IOL", "OC": "IOL", "DUAL": "QB", "PRO": "QB", "APB": "RB",
}

NUMERIC_FEATURES = [
    "before_averagePPA_all", "before_averagePPA_pass", "before_averagePPA_rush",
    "before_totalPPA_all", "before_totalPPA_pass", "before_totalPPA_rush",
    "before_usage_overall", "before_usage_pass", "before_usage_rush",
    "has_before", "hs_rating", "hs_stars", "years_since_hs",
]
CATEGORICAL_FEATURES = ["position_group", "origin_tier", "eligibility"]


# --------------------------------------------------------------------------- #
# Feature preparation
# --------------------------------------------------------------------------- #

def origin_tier(transfers: pd.DataFrame, teams: pd.DataFrame) -> pd.Series:
    """Power or G5, based on the origin school's conference in the prior season."""
    conf = teams[["pull_year", "school", "conference"]].rename(
        columns={"pull_year": "before_season", "school": "origin"})
    merged = transfers[["before_season", "origin"]].merge(conf, on=["before_season", "origin"], how="left")
    power = merged["conference"].isin(POWER_CONFERENCES) | (merged["origin"] == "Notre Dame")
    pac12_late = (merged["conference"] == "Pac-12") & (merged["before_season"] > LAST_POWER_PAC12_SEASON)
    return pd.Series(np.where(power & ~pac12_late, "Power", "G5"), index=transfers.index)


def link_recruiting(transfers: pd.DataFrame, recruiting: pd.DataFrame) -> pd.DataFrame:
    """Attach high school rating / stars / class year to each transfer.

    1. athleteId: recruiting `athleteId` equals the CFBD athlete ID matched on
       either side of the transfer.
    2. name + school: normalized name equals the recruit's, and the recruit
       committed to the transfer's origin school (unique matches only).
    Recruiting data only covers HS classes 2020-2025, so older players can't link.
    """
    rec = recruiting.dropna(subset=["athleteId"]).copy()
    rec["athleteId"] = rec["athleteId"].astype(str)
    rec = rec.rename(columns={"rating": "hs_rating", "stars": "hs_stars", "year": "hs_class_year"})
    fields = ["hs_rating", "hs_stars", "hs_class_year"]

    out = pd.DataFrame(index=transfers.index, columns=fields + ["hs_link_method"], dtype=object)
    by_id = rec.set_index("athleteId")[fields]
    for side in ("before", "after"):
        ids = transfers[f"{side}_player_id"].astype(str)
        found = ids.isin(by_id.index) & out["hs_link_method"].isna()
        out.loc[found, fields] = by_id.loc[ids[found]].to_numpy()
        out.loc[found, "hs_link_method"] = "athlete_id"

    names = recruiting.assign(name_norm=recruiting["name"].map(normalize_name)).rename(
        columns={"rating": "hs_rating", "stars": "hs_stars", "year": "hs_class_year",
                 "committedTo": "origin"})
    hits = transfers[["transfer_id", "name_norm", "origin"]].reset_index().merge(
        names[["name_norm", "origin"] + fields], on=["name_norm", "origin"])
    hits = hits[~hits.duplicated("transfer_id", keep=False)].set_index("index")
    todo = hits.index[out.loc[hits.index, "hs_link_method"].isna()]
    out.loc[todo, fields] = hits.loc[todo, fields].to_numpy()
    out.loc[todo, "hs_link_method"] = "name_school"

    out[fields] = out[fields].apply(pd.to_numeric)
    return out


def build_features(transfers: pd.DataFrame, recruiting: pd.DataFrame, teams: pd.DataFrame) -> pd.DataFrame:
    df = transfers.copy()
    df["position_group"] = df["position"].replace(POSITION_GROUPS)
    df["origin_tier"] = origin_tier(df, teams)
    df = df.join(link_recruiting(df, recruiting))
    df["years_since_hs"] = df["season"] - df["hs_class_year"]
    return df


# 0-centered scale, like DVOA or EPA: 0 = average, + above, - below, 10 points
# = one SD. Values above +30 (3 SD) are capped so one outlier can't dominate.
INDEX_MEAN, INDEX_SD = 0, 10
INDEX_MAX = 30


def add_cost_index(df: pd.DataFrame) -> pd.DataFrame:
    """Rating (0 = average, 10 = one SD, capped at +30) of portal rating among
    rated transfers in the same season."""
    df = df.copy()
    by_season = df.groupby("season")["rating"]
    z = (df["rating"] - by_season.transform("mean")) / by_season.transform("std")
    df["cost_index_observed"] = (INDEX_MEAN + INDEX_SD * z).clip(upper=INDEX_MAX)
    return df


# --------------------------------------------------------------------------- #
# Model
# --------------------------------------------------------------------------- #

def model_matrix(df: pd.DataFrame, use_stars: bool) -> pd.DataFrame:
    X = df[NUMERIC_FEATURES].astype(float)
    if use_stars:
        X = X.assign(portal_stars=df["stars"].astype(float))
    for col in CATEGORICAL_FEATURES:
        X[col] = df[col].fillna("missing").astype("category")
    return X


def new_model() -> HistGradientBoostingRegressor:
    return HistGradientBoostingRegressor(
        categorical_features="from_dtype", max_iter=300, learning_rate=0.05,
        min_samples_leaf=40, l2_regularization=1.0, random_state=RANDOM_STATE,
    )


def star_bands(rated: pd.DataFrame) -> tuple:
    """Observed index range per (season, stars), plus a pooled range per stars
    for season/star combinations with no rated transfers."""
    g = rated.dropna(subset=["stars"])
    by_season = g.groupby(["season", "stars"])["cost_index_observed"].agg(["min", "max"])
    pooled = g.groupby("stars")["cost_index_observed"].agg(["min", "max"])
    return by_season, pooled


def clamp_to_star_band(est: pd.Series, df: pd.DataFrame, bands: tuple) -> pd.Series:
    """Clip each estimate into its season + stars band. Rows without stars are unchanged."""
    by_season, pooled = bands
    keys = pd.MultiIndex.from_arrays([df["season"], df["stars"]])
    lo = by_season["min"].reindex(keys).to_numpy()
    hi = by_season["max"].reindex(keys).to_numpy()
    lo = np.where(np.isnan(lo), pooled["min"].reindex(df["stars"]).to_numpy(), lo)
    hi = np.where(np.isnan(hi), pooled["max"].reindex(df["stars"]).to_numpy(), hi)
    clipped = est.to_numpy(dtype=float).copy()
    has_band = ~np.isnan(lo)
    clipped[has_band] = np.clip(clipped[has_band], lo[has_band], hi[has_band])
    return pd.Series(clipped, index=est.index)


def cross_validate(df: pd.DataFrame, use_stars: bool, clamp: bool) -> dict:
    """5-fold CV on rated transfers. Star bands come from the training folds only.
    Baseline predicts the training-fold mean."""
    rated = df[df["cost_index_observed"].notna()]
    X, y = model_matrix(rated, use_stars), rated["cost_index_observed"]
    folds = KFold(5, shuffle=True, random_state=RANDOM_STATE)
    pred = pd.Series(np.nan, index=y.index)
    for train, test in folds.split(X):
        model = new_model().fit(X.iloc[train], y.iloc[train])
        p = pd.Series(model.predict(X.iloc[test]), index=y.index[test])
        if clamp:
            p = clamp_to_star_band(p, rated.iloc[test], star_bands(rated.iloc[train]))
        pred.loc[p.index] = p
    baseline = cross_val_predict(DummyRegressor(), X, y, cv=folds)
    return {
        "n": len(rated),
        "mae": mean_absolute_error(y, pred),
        "r2": r2_score(y, pred),
        "spearman": pd.Series(pred, index=y.index).corr(y, method="spearman"),
        "baseline_mae": mean_absolute_error(y, baseline),
        "pred": pred,
    }


def impute_cost_index(df: pd.DataFrame) -> pd.DataFrame:
    """Fill `cost_index` with the observed index or a model estimate."""
    rated = df["cost_index_observed"].notna()
    model = new_model().fit(model_matrix(df[rated], USE_PORTAL_STARS), df.loc[rated, "cost_index_observed"])
    df = df.copy()
    df["rating_imputed"] = ~rated
    df["cost_index"] = df["cost_index_observed"]
    df["cost_index_raw_estimate"] = np.nan
    if (~rated).any():
        raw = pd.Series(model.predict(model_matrix(df[~rated], USE_PORTAL_STARS)),
                        index=df.index[~rated])
        df.loc[~rated, "cost_index_raw_estimate"] = raw
        final = clamp_to_star_band(raw, df[~rated], star_bands(df[rated])) if CLAMP_TO_STAR_BAND else raw
        df.loc[~rated, "cost_index"] = final
    return df


# Lowest published rating for each portal star level (2-star is everything below 3-star).
STAR_BANDS = [(5, 0.98), (4, 0.90), (3, 0.80), (2, 0.0)]


def add_display_rating(df: pd.DataFrame) -> pd.DataFrame:
    """Rating and stars shown on the site, on the published 0-1 scale.

    The math uses cost_index; this is display only. Rated transfers keep their
    published rating. For imputed ones the estimated cost_index is turned back into
    a rating with that season's mean and SD. Missing stars come from the rating's band.
    """
    df = df.copy()
    by_season = df.groupby("season")["rating"]
    mean, sd = by_season.transform("mean"), by_season.transform("std")
    estimate = mean + (df["cost_index"] - INDEX_MEAN) / INDEX_SD * sd
    df["rating_display"] = df["rating"].fillna(estimate).round(4)
    band = df["rating_display"].map(lambda r: next(s for s, lo in STAR_BANDS if r >= lo))
    df["stars_display"] = df["stars"].fillna(band).astype(int)
    return df


# --------------------------------------------------------------------------- #
# Entry point + report
# --------------------------------------------------------------------------- #

def add_cost_columns(transfers, recruiting, teams):
    """Return (transfers with cost columns, report text)."""
    df = add_cost_index(build_features(transfers, recruiting, teams))
    variants = {
        "no stars, no clamp": (False, False),
        "stars feature, no clamp": (True, False),
        "stars feature + star-band clamp": (True, True),
    }
    cvs = {label: cross_validate(df, *opts) for label, opts in variants.items()}
    used = next(label for label, opts in variants.items()
                if opts == (USE_PORTAL_STARS, CLAMP_TO_STAR_BAND))
    df = add_display_rating(impute_cost_index(df))
    return df, cost_report(df, cvs, used)


def _fmt_cv(label, cv, used):
    mark = "*" if used else " "
    return (f" {mark}{label:34} MAE {cv['mae']:.2f} (baseline {cv['baseline_mae']:.2f})  "
            f"R2 {cv['r2']:.3f}  Spearman {cv['spearman']:.3f}")


def cost_report(df, cvs, used) -> str:
    cv_main = cvs[used]
    imp = df[df["rating_imputed"]]
    lines = ["COST MODEL REPORT", "=" * 60, "",
             "Cost index = 10 * z (0 = average, capped at +30) of portal rating within its portal season (among",
             "rated FBS->FBS transfers). Missing ratings are estimated by a model.",
             "MAE below is in index points.", "",
             f"Rated transfers:   {(~df['rating_imputed']).sum():,}",
             f"Imputed transfers: {df['rating_imputed'].sum():,}", ""]

    lines += ["IMPUTED SHARE BY SEASON",
              df.groupby("season")["rating_imputed"].agg(["sum", "mean"]).round(3).to_string(), ""]

    lines += ["FEATURE COVERAGE (all transfers / imputed transfers)"]
    for col in ["has_before", "before_totalPPA_all", "before_usage_overall", "hs_rating", "years_since_hs"]:
        present = lambda s: (s.astype(bool) if s.dtype == bool else s.notna()).mean()
        lines.append(f"  {col:22} {present(df[col]):6.1%} / {present(imp[col]):6.1%}")
    lines += ["  HS link method: " + str(df["hs_link_method"].fillna("none").value_counts().to_dict()),
              "  origin tier: " + str(df["origin_tier"].value_counts().to_dict()), ""]

    lines += ["CROSS-VALIDATION (5-fold, rated transfers; * = used)",
              *[_fmt_cv(label, cv, label == used) for label, cv in cvs.items()], ""]

    if CLAMP_TO_STAR_BAND:
        moved = (imp["cost_index"] - imp["cost_index_raw_estimate"]).abs() > 1e-9
        lines += [f"STAR-BAND CLAMP: {moved.sum():,} of {len(imp):,} imputed estimates were moved "
                  f"into their star band; {imp['stars'].isna().sum():,} have no stars and are unclamped.",
                  ""]

    rated = df[~df["rating_imputed"]].assign(cv_pred=cv_main["pred"])
    lines += ["CV ERROR BY POSITION GROUP (used model)",
              rated.groupby("position_group").apply(
                  lambda g: pd.Series({"n": len(g), "mae": (g.cv_pred - g.cost_index_observed).abs().mean()}),
                  include_groups=False).round(2).sort_values("mae").to_string(), ""]

    lines += ["DISTRIBUTION OF cost_index",
              df.groupby("rating_imputed")["cost_index"].describe().round(3).to_string(),
              "Imputed values are model averages, so they cluster near the middle more",
              "than observed values do.", ""]

    star_check = imp.dropna(subset=["stars"]).groupby("stars")["cost_index"].describe()[["count", "mean", "min", "max"]]
    obs_check = df[~df["rating_imputed"]].groupby("stars")["cost_index"].describe()[["count", "mean", "min", "max"]]
    used = "used" if USE_PORTAL_STARS else "not used"
    lines += [f"SANITY CHECK: cost_index by portal stars (stars {used} by the model)",
              "  observed:", obs_check.round(3).to_string(),
              "  imputed:", star_check.round(3).to_string()]
    return "\n".join(lines)
