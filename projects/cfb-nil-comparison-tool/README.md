# CFB NIL Comparison Tool (cfb-nil-comparison-tool)

Compares every FBS team's transfer "investment" to the on-field production it gets back.
The site page lives at [liferouby.com/cfb-nil-comparison-tool](https://liferouby.com/cfb-nil-comparison-tool)
and is intentionally not listed on the Projects page yet.

The pipeline builds a player-level dataset of FBS → FBS transfers with production
**before** (at the origin school) and **after** (at the destination school), scores
every transfer's cost and production on a 0-centered scale (0 = average, + above,
− below), rolls them up to teams, and
exports JSON for the site.

**Scope: the platform scores only quarterbacks, running backs, wide receivers and tight
ends**, the four positions PPA (predicted points added) covers. Defenders, offensive linemen
and specialists appear on team pages but are never scored, so they count neither for nor
against a school. School scores are per-player averages over scored transfers only, so a
school isn't penalized for bringing in few skill players (its score just has a wider range).
Schools with no scored transfers in a season are listed below the ranked schools as "not
ranked", not as last. Every average portal rating on the site (leaderboard, team cards,
year-by-year table, school sentence, chart, all-schools comparison) uses the scored players
only (`rating_measured_mean`; all schools .856).

Historical team-level NIL spending isn't publicly reliable, so the project measures cost
in two ways (see [Cost measures](#cost-measures)):

- **Primary:** transfer portal ratings, as a proxy for what each player cost (2021–2025).
- **Cross-check:** reported 2026 team NIL budgets, used separately to check whether the
  teams that rank high on portal-rating "spend" also have the biggest budgets.

The project does **not** pull actual team-level NIL spending numbers.

## Project layout

```
projects/cfb-nil-comparison-tool/
├── pull_cfbd_data.py          # downloads raw data from the CFBD API (cached)
├── requirements.txt
├── notebooks/
│   └── 01_explore.ipynb       # data exploration (Step 1)
├── src/
│   ├── build_dataset.py       # filtering + before/after matching; runs everything below
│   ├── cost_model.py          # 0-centered cost rating + imputation of missing ratings
│   ├── team_aggregate.py      # production ratings, expected production, team rollups
│   ├── robustness.py          # reruns the team leaderboard under alternative choices
│   └── export_site_data.py    # writes the JSON the site reads
└── data/
    ├── raw/                   # cached API responses (gitignored, never edited)
    └── processed/
        ├── transfers.csv            # one row per transfer
        ├── match_report.txt         # filter counts, match rates, review lists
        ├── cost_model_report.txt    # imputation coverage, accuracy, sanity checks
        ├── team_seasons.csv         # one row per FBS team per season
        ├── team_totals.csv          # one row per team, 2021–2025 combined
        ├── team_report.txt          # correlations, top/bottom teams
        └── robustness_report.txt    # leaderboard stability across variants
```

The site lives outside this folder, at the repo root:

```
src/cfb-nil-comparison-tool/                # React page, team pages, charts, styles
public/data/cfb-nil-comparison-tool/        # teams.json, transfers.json (written by export_site_data.py)
src/App.jsx                    # routes /cfb-nil-comparison-tool and /cfb-nil-comparison-tool/team/:slug
```

## Setup

```bash
pip install -r requirements.txt
```

### Pulling raw data

Only needed if `data/raw/` is empty. The free API tier allows 1,000 calls per month, and
a full pull is about 35 calls. Each response is cached and skipped on later runs.

1. Get a free key at https://collegefootballdata.com/key
2. Set it as an environment variable (don't hardcode it in the script):
   - macOS/Linux: `export CFBD_API_KEY="your_key"`
   - Windows: `set CFBD_API_KEY=your_key`
3. From this folder: `python pull_cfbd_data.py`

Run it from `projects/cfb-nil-comparison-tool/`. The script writes to `data/raw/` relative to the
current directory.

### Building the dataset and site data

```bash
python src/build_dataset.py
```

This reads only `data/raw/`, makes no API calls, writes everything in
`data/processed/`, and exports the site JSON to `public/data/cfb-nil-comparison-tool/`.

### Viewing the site locally

From the repo root: `npm run dev`, then open http://localhost:5173/cfb-nil-comparison-tool.

## Data sources

All data comes from the [CollegeFootballData.com API](https://collegefootballdata.com).

| Dataset | Endpoint | Years | Rows |
|---|---|---|---|
| `portal` | `/player/portal` | 2021–2025 | 14,422 |
| `ppa` | `/ppa/players/season` | 2020–2025 | 25,579 |
| `usage` | `/player/usage` | 2020–2025 | 25,579 |
| `stats` | `/stats/player/season` | 2020–2025 | 730,337 |
| `recruiting` | `/recruiting/players` (high school) | 2020–2025 | 24,254 |
| `teams_fbs` | `/teams/fbs` | 2020–2025 | 792 |

Production data starts one year before the first portal class, so every transfer has a
"before" season.

## Cost measures

### Primary: portal ratings (historical cost proxy)

The portal `rating` (0–1 composite) and `stars` (2–5) on each transfer stand in for what
the player cost. A team's historical "investment" is the rating of the transfers it
brought in. On the site this is labeled **portal rating**.

Coverage in `transfers.csv` (6,744 FBS → FBS transfers):

| Season | Has `rating` | Has `stars` |
|---|---|---|
| 2021 | 40.5% | 95.4% |
| 2022 | 69.7% | 95.9% |
| 2023 | 63.8% | 99.3% |
| 2024 | 85.4% | 96.2% |
| 2025 | 83.2% | 94.5% |
| **All** | **74.1%** | **96.1%** |

Things to handle before using it:

- **Ratings are missing for 26% of transfers**, and for 60% in 2021. Stars are nearly
  complete, so they can fill in where `rating` is missing.
- **Missing ratings aren't random.** Transfers with a rating were matched to AFTER
  production 72.5% of the time vs 66.4% without one, so dropping unrated players would
  skew results toward players who got on the field.
- **Ratings are tightly bunched** (mean 0.858, standard deviation 0.032, range
  0.73–1.00), and 80% of transfers are 3-stars (2-star 273, 3-star 5,423, 4-star 763,
  5-star 19). Small rating differences carry a lot of weight.
- No ratings are recorded as 0, so a missing rating is always null.
- **Portal `stars` are bands of `rating`:** 2★ = 0.73–0.79, 3★ = 0.80–0.89,
  4★ = 0.90–0.97, 5★ = 0.98–1.00.

### The cost rating and imputation

Implemented in `src/cost_model.py`, which runs as part of `build_dataset.py`.

**Cost rating:** each portal rating becomes a plus-or-minus score within its portal
season: **10 × z**, where z is how many standard deviations the rating sits above the
season's average among *rated FBS → FBS transfers*. So 0 is the average rated transfer,
+ is pricier, − is cheaper, and every 10 points is one standard deviation (the same scale
as the production rating below). Scores are capped at +30 (3 SD). The result is
`cost_index_observed`. Observed values run from about −34 to +30; every 5★ and a handful
of 4★ transfers sit at the +30 cap.

**What the site shows:** the plus/minus number drives all the math, but the site shows
portal ratings the way recruiting sites publish them: stars plus the 0–1 rating
(★★★★ .940), which coaches already read fluently. `add_display_rating()` writes
`rating_display` (the published rating, or for unrated players the estimate converted
back with that season's mean and SD: rating = mean + cost_index ÷ 10 × SD) and
`stars_display` (published stars, or the star band of `rating_display` when missing). A
school's `rating_display_mean` is the plain average of its transfers' `rating_display`.

Example: Cam Ward's 2024 rating was 0.94. The 2024 average was 0.861 with a standard
deviation of 0.030, so he was 2.6 standard deviations above average: 10 × 2.6 = +26.

**Imputation:** the 1,745 transfers without a rating (26%) get a model estimate. The
final cost column `cost_index` holds the observed rating when there is one and the
estimate otherwise, with `rating_imputed = True` on estimated rows (shown as "est." on
the site).

| Season | Imputed |
|---|---|
| 2021 | 412 (59.5%) |
| 2022 | 278 (30.3%) |
| 2023 | 427 (36.2%) |
| 2024 | 249 (14.6%) |
| 2025 | 379 (16.8%) |

The model is a gradient-boosted regressor (scikit-learn `HistGradientBoostingRegressor`,
which handles missing values directly), trained on rated transfers. It uses only
information available at transfer time:

| Feature | Source | Coverage |
|---|---|---|
| Prior-season PPA (avg/total × all/pass/rush) and usage (overall/pass/rush) | BEFORE match | 24.7% (offense only) |
| Had any prior-season production | BEFORE match | 63.6% |
| Position group | Portal position, rare labels merged (OLB→LB, DT→DL, OG→IOL, …) | 100% |
| Origin tier | Origin's conference in the prior season: **Power** = SEC, Big Ten, Big 12, ACC, Pac-12 (through 2023), Notre Dame; otherwise **G5** | 100% |
| Eligibility | Portal `eligibility` (Immediate / TBD / …) | 100% |
| Years since HS class (class-year proxy) | `season − hs_class_year` | 56.5% |
| HS recruiting rating and stars | Recruiting data | 53.4% |
| Portal stars | Portal `stars` | 96.1% (85% of unrated transfers) |

**Star-band clamp:** because portal stars are bands of the rating, each estimate is then
clipped into the range that *rated* transfers with the same stars reached in that season
(or across all seasons, if that season has none). This moved 136 of the 1,745 estimates.
The 266 unrated transfers that also have no stars can't be clamped.
`cost_index_raw_estimate` keeps the model output from before the clamp.

High school recruits are linked by athlete ID (2,856) or, failing that, by normalized
name plus the recruit having committed to the origin school (955, unique matches only).
Recruiting data only covers HS classes 2020–2025, so older players (most 2021–2022
transfers) can't link. The portal has no actual class-year field.

**Accuracy (5-fold cross-validation on rated transfers; error in rating points):**

| Model | MAE | R² | Spearman |
|---|---|---|---|
| Always predict the average (baseline) | 7.60 | 0 | — |
| Without portal stars | 6.38 | 0.306 | 0.500 |
| With portal stars | 5.11 | 0.584 | 0.632 |
| **With portal stars + star-band clamp (used)** | **5.02** | **0.593** | **0.633** |

In cross-validation, star bands are computed from the training folds only. Error is
lowest for WR and QB (about 4.6) and highest for interior linemen (5.7), which have no
PPA or usage.

**Imputed vs observed, by portal stars (mean cost rating):**

| Stars | Observed | Imputed |
|---|---|---|
| 2★ | −24.1 | −25.2 |
| 3★ | −2.1 | −4.1 |
| 4★ | +16.5 | +16.6 |
| 5★ | +30.0 | +30.0 |

**Known issues with the imputed values:**

- Imputed transfers average −5.4 versus 0.0 for rated ones, mostly because unrated
  players are lower-profile (more of them had no prior-season production).
- Unrated 3★ transfers come out a little lower than rated ones (−4.1 vs −2.1). The 3★
  band is wide (about −26 to +16), so the star clamp barely constrains them.
- The 266 transfers with neither a rating nor stars rely on the model alone.
- Both options can be turned off in `cost_model.py` (`USE_PORTAL_STARS`,
  `CLAMP_TO_STAR_BAND`).

### Cross-check: 2026 NIL budgets

Reported 2026 team NIL budgets are used only as a separate comparison, not merged into
the historical player-level analysis. The question is whether teams that rank high on
portal-rating spending also report large NIL budgets. If they do, that supports using
ratings as a cost proxy. The source for these budgets hasn't been chosen yet.

## Exploration findings

Full details and code are in `notebooks/01_explore.ipynb`.

### What the portal `season` means

`season` is the player's **first season at the new school**, not the season he left.
Transfer dates for season *S* run from fall *S−1* through summer *S*. Verified against
production data:

- Caleb Downs (2024): Alabama in 2023, Ohio State in 2024
- Cam Ward (2024): Washington State in 2023, Miami in 2024 (listed as "Cameron Ward")
- Michael Penix Jr., Bo Nix, Jayden Daniels and Will Howard follow the same pattern

So **BEFORE = origin school in season − 1** and **AFTER = destination school in season**.

### Portal entries

- **No destination:** 3,971 of 14,422 (27.5%). This includes all 256 "Withdrawn" rows.
- **Destination equals origin:** 142 rows (the player returned to the same school).
- **Repeat transfers:** about 1,900 normalized names appear in more than one portal
  season. These are real repeat transfers (e.g. Dillon Gabriel in 2022 and 2024).
- **Same-cycle duplicates:** 7 pairs share season, name and origin. Most have one row
  with a null destination; one pair (Dylan Barrett) is an exact repeat.
- **Army and Navy** never appear as a portal destination.

### PPA and usage

- Nested JSON. `averagePPA` and `totalPPA` each split into all / pass / rush / firstDown /
  secondDown / thirdDown / standardDowns / passingDowns, flattened to columns like
  `averagePPA.all` and `totalPPA.pass`. Usage has the same splits under `usage.*`, with
  `overall` instead of `all`.
- **Offense only:** QB, RB, WR, TE and FB. Defenders, linemen and specialists have no PPA
  or usage.
- **353 duplicated player-team-seasons, of two kinds:**
  - 283 are exact repeats except for a blank `conference`. One copy is dropped.
  - 70 are players CFBD splits across two positions (e.g. Julian Gray as RB and WR at
    NC State, 2022) with PPA divided between the rows. These are combined: totals and
    usage are summed, and averages are recomputed from implied plays (total ÷ average).

### Stats

- **Long format:** one row per player × team × season × (category, statType).
- `stat` is stored as a **string** and must be converted to numbers.
- Covers all positions, but **only players who recorded at least one stat**.
- 23 players appear with more than one team in the same season.

### IDs

| Dataset | ID fields |
|---|---|
| portal | none |
| ppa | `id` (CFBD athlete ID) |
| usage | `id` (same as ppa) |
| stats | `playerId` (same as ppa) |
| recruiting | `id` (recruit ID), `athleteId` |
| teams_fbs | `id` (team ID) |

- PPA `id` matches usage `id` 100% of the time and stats `playerId` 99.6% of the time.
- The athlete ID usually survives a transfer (Cam Ward, Caleb Downs) but **not always**:
  Bo Nix has different IDs at Auburn and Oregon.
- Recruiting `athleteId` links to stats for about 43% of recruits (many never record a stat).
- **The portal has no ID**, so portal rows must be matched by name, team and season.

### Team names

Team names are consistent across all datasets. Every FBS school name in `teams_fbs`
appears exactly in the portal, PPA, usage and stats data, and the only close misses
(Bowie State vs Boise State, etc.) are different schools. Conference labels are *not*
consistent (PPA uses `B1G`, stats uses `Big Ten`), but they aren't used for joining.

## Building the dataset

### Step 2: Filter to FBS → FBS transfers

| Step | Dropped | Remaining |
|---|---|---|
| All portal entries | — | 14,422 |
| No destination | 3,971 | 10,451 |
| Destination not FBS in the transfer season | 2,154 | 8,297 |
| Origin not FBS in the prior season | 1,414 | 6,883 |
| Destination equals origin | 138 | 6,745 |
| Exact duplicate (same season, name, origin, destination; latest kept) | 1 | 6,744 |

FBS membership is checked per season using `teams_fbs`, so schools moving up from FCS
(e.g. Sam Houston, Jacksonville State, Kennesaw State, Delaware, Missouri State) count
only from the year they joined.

### Step 3: Match transfers to production

Every production row (from stats and PPA) is a candidate keyed by season, team and
athlete ID. Each transfer is looked up twice: BEFORE at the origin in season − 1 and
AFTER at the destination in season.

**Name normalization** (applied to every dataset): lowercase, strip accents, turn
hyphens into spaces, remove other punctuation, and drop trailing suffixes (Jr, Sr, II,
III, IV, V).

**Matching order:**

1. **Exact** — normalized name + team + season. If two players share a name on the same
   team, the transfer is left unmatched and labeled `ambiguous_exact`.
2. **ID link** — if one side matched, look for the same athlete ID on the other side's
   team and season.
3. **Fuzzy** — rapidfuzz `token_sort_ratio` within the same team and season, among
   players not already matched. A candidate passes if:
   - its score is 90 or higher (`fuzzy`), or
   - it has the same last name and one first name is the start of the other, like
     Cam/Cameron or Josh/Joshua (`fuzzy_nickname`).

   A match is accepted only if exactly one candidate passes. Otherwise the transfer is
   labeled `ambiguous_fuzzy` and left unmatched.
4. **ID link again**, to catch sides whose partner was only found by fuzzy matching.

Transfers with no AFTER match are **kept**, with null AFTER values and
`no_after_match = True`. Players who never recorded a stat at their new school matter
for avoiding survivorship bias.

### Results

| Side | Matched | exact | fuzzy | fuzzy_nickname | id_link |
|---|---|---|---|---|---|
| BEFORE | 63.6% | 4,207 | 39 | 41 | 3 |
| AFTER | 70.9% | 4,688 | 41 | 49 | 4 |

Match rates by position range from 73–86% for skill and defensive positions, but are
about 8% for OT and 11% for IOL. Linemen almost never record a stat, so those gaps are
missing production data, not failed name matching. Rates by season and position are in
`match_report.txt`.

**ID check:** 3,765 transfers matched on both sides. 16 have different athlete IDs
before and after. Most are CFBD re-issuing IDs (Bo Nix), but the report lists them for
review.

**Spot-checks:** 21 well-known transfers were verified by hand (Ward, Downs, Dart,
Gabriel ×2, Nix, Penix, Daniels, Williams, Howard, McCord, Ewers, Gibbs, Addison,
Leonard, Rourke, Moore, Beck, Tez Johnson, Uiagalelei, Hunter). All matches are correct.

- Travis Hunter is excluded because his origin (Jackson State) is FCS.
- Quinn Ewers has no BEFORE row; he recorded no stats at Ohio State in 2021.
- Dante Moore's 49 passing yards at Oregon in 2024 is real (he was the backup).
- Kyle McCord's −65 rushing yards in both seasons is real (32 carries vs 67).

### `transfers.csv` columns

- **Transfer info:** `transfer_id`, `season`, `before_season`, `first_name`,
  `last_name`, `full_name`, `name_norm`, `position`, `origin`, `destination`,
  `transfer_date`, `stars`, `rating`, `eligibility`
- **Cost:** `cost_index` (final cost rating, 0 = average, ± in SD × 10), `rating_display`
  and `stars_display` (what the site shows), `rating_imputed`,
  `cost_index_observed`, `cost_index_raw_estimate` (model output before the star-band
  clamp)
- **Cost-model features:** `position_group`, `origin_tier`, `hs_rating`, `hs_stars`,
  `hs_class_year`, `years_since_hs`, `hs_link_method`
- **Flags:** `has_before`, `has_after`, `no_after_match`, `ids_disagree`
- **Production:** see [Production on a common scale](#production-on-a-common-scale)
- **Match details (per side):** `{side}_player_id`, `{side}_match_method`,
  `{side}_match_score`, `{side}_matched_name`, `{side}_matched_position`
- **PPA (per side):** `{side}_averagePPA_{all,pass,rush}`, `{side}_totalPPA_{all,pass,rush}`
- **Usage (per side):** `{side}_usage_{overall,pass,rush}`
- **Box-score stats (per side):** passing ATT / COMPLETIONS / YDS / TD / INT;
  rushing CAR / YDS / TD; receiving REC / YDS / TD; defensive TOT / SOLO / TFL / SACKS /
  QB_HUR / PD / TD; interceptions INT; kicking FGM / FGA; punting NO / YDS

`{side}` is `before` or `after`.

## Team-level aggregation

Implemented in `src/team_aggregate.py`, the last step of `build_dataset.py`. Each team is
credited with its **incoming** transfers: the destination school in the portal season.

### Production on a common scale

Production units differ by position, so each transfer gets a **production rating** on
the same 0-centered scale as cost (0 = average, + above, − below, 10 points = one
standard deviation):

1. **Raw score, per player-season:**
   - Offense (QB, RB, WR, TE): total PPA
   - OL and specialists (IOL, OT, K, P, LS): **not measured**. They have no usable stats
     They still count toward cost, but not production.
2. **Rated against all FBS players:** each transfer's before and after scores are
   compared with every player on an FBS team that season, in the same broad position
   group, who recorded at least one stat.
   - **Capping:** pool scores are capped at their 1st and 99th percentiles before the
     mean and SD are taken, and so is the transfer's score. Raw PPA is very skewed (one
     elite RB season sits 6 SD above average), so without the cap a single player could
     decide a team's average.
   - **+30 cap:** ratings are capped at +30 (3 SD), so the very best seasons (65 of
     2,363 measured transfers) share a rating of +30.
   - Capped z-scores were chosen over plain z-scores (outliers dominate) and percentiles
     (which flatten real differences between good and great seasons).
   - The scale is lopsided: most FBS players with stats are low-volume backups, so zero
     production sits below average (rating about −5 to −8), while stars reach
     +25 to +30.
   - Pools use four groups: QB, RB (incl. FB), WR, TE. A transfer is placed in the group
     of the position he's listed at in that
     season's production data; if that isn't usable, his portal position is used.
   - Rating within each season also neutralizes season-wide effects such as the
     shortened 2020 season (the BEFORE season for 2021 transfers).
3. **Playing time and quality are kept separate.** "Never played" is not treated as
   "worst player in FBS":
   - **AFTER side:** `played_after` records whether he got on the field at all (the hit
     rate), and `prod_index_after` measures how good he was, only for players who played.
     Players who didn't play still count against the team through `prod_value_after`:
     the rating if he played, otherwise the rating of zero production in his pool (about
     −5 to −8). That puts "contributed nothing" above players whose total PPA was
     negative.
   - **BEFORE side:** no stats at the old school means *unknown* (redshirt, injury or
     depth chart), not *bad*. These transfers are labeled `unproven` and get no
     `prod_gain`.
   - **`prod_gain` is only calculated for transfers who played on both sides** (3,624 of
     2,363 measured transfers).

The pool is "FBS players who got on the field," not every rostered player, so 0 means
an average player who got on the field.

### Expected production

`prod_over_expected` compares what a transfer produced with what his cost predicts. For
each position group, a straight line is fit through every measured transfer
(`prod_value_after` against `cost_index`, least squares; `expected_lines()` in
`team_aggregate.py`). A player's expected production is where his cost lands on the line.

Example for QBs (519 transfers): **expected = −0.2 + 0.347 × cost**. Cam Ward's cost of
+26 gives −0.2 + 0.347 × 26 = +8.8. He produced +29.7, so he was +20.8 over expected
(unrounded: +29.8 − +8.9).

The line is flat because cost only weakly predicts production (Spearman 0.23 between
cost and production for individual transfers, 0.37 for QBs). Every 10 cost points adds
about 3.4 expected points for QBs. See [Decisions to revisit](#decisions-to-revisit) for
a known weakness at the top end.

**Units: production points (pts).** Production ratings are "production points": 0 pts =
the average FBS player at his position, 10 pts = one standard deviation. Because a point
is abstract, the site translates it into real stats where it can (`unit_translations()`,
exported as `meta.units`, averaged over seasons):

| Position | 0 pts is about | Each +10 pts adds about |
|---|---|---|
| QB | 42 points added | 61 |
| RB | 8 points added | 15 |
| WR | 16 points added | 20 |
| TE | 8 points added | 11 |

"Points added" is total PPA. Per player,
`prod_actual_raw` is his real season total (0 if he didn't play) and `prod_expected_raw`
is his expected rating converted back with his pool's mean and SD (rating r → mean +
r ÷ 10 × SD). Cam Ward: 268 points added vs. about 97 for QBs rated like him. A school's
number mixes positions, so it stays in pts.

Transfer-level production columns in `transfers.csv`:

| Column | Meaning |
|---|---|
| `production_measured` | Position has a production score |
| `played_before`, `played_after` | Recorded any stat on that side |
| `prod_ref_group_before`, `prod_ref_group_after` | Position pool he was rated in |
| `prod_score_before`, `prod_score_after` | Raw score (season total PPA) |
| `prod_index_before`, `prod_index_after` | Production rating (0 = average); blank if he didn't play |
| `prod_value_after` | `prod_index_after` if he played, else the rating of zero production |
| `prod_gain` | `prod_index_after − prod_index_before`, only if he played on both sides |
| `transfer_profile` | `proven` (played before) or `unproven` (no stats before) |
| `prod_over_expected` | `prod_value_after` minus expected production for his cost and position |
| `prod_expected` | Expected production for his cost and position (`prod_value_after − prod_over_expected`) |
| `prod_actual_raw`, `prod_expected_raw` | Actual and expected production in real stats (points added) |

### Team tables

`team_seasons.csv` has one row per FBS team per season (664 rows, including 24
team-seasons with no incoming transfers). `team_totals.csv` combines all seasons.

| Column | Meaning |
|---|---|
| `n_transfers`, `n_measured` | Incoming transfers, and those with a production score |
| `cost_mean` | Mean `cost_index` over all incoming transfers |
| `rating_display_mean` | Mean published (or converted) portal rating, shown on the site |
| `n_imputed`, `share_imputed` | How many cost ratings were estimated |
| `n_played_after`, `hit_rate` | Measured transfers who recorded a stat, and their share |
| `prod_quality_mean` | Mean `prod_index_after` among those who played |
| `prod_value_mean` | Mean `prod_value_after` (actual production, DNP counted as zero production) |
| `prod_expected_mean` | Mean expected production for the transfers' costs |
| `prod_over_expected_mean` | **The main measure:** production beyond what cost predicts, per player (value above price), `prod_value_mean − prod_expected_mean` |
| `prod_over_expected_sum` | The same added up (kept in the CSVs, not shown on the site) |
| `prod_value_sum`, `prod_expected_sum`, `prod_over_expected_sum_lo/_hi` | Totals and the total's 95% range (CSV only) |
| `n_gain`, `prod_gain_mean` | Transfers who played on both sides, and their mean gain |
| `n_unproven`, `n_unproven_played`, `unproven_hit_rate` | Transfers with no prior stats |
| `{metric}_lo`, `{metric}_hi` | 95% range for `prod_over_expected`, `prod_value`, `hit_rate`, `prod_quality` |
| `prod_over_expected_signal` | `above` / `below` if the whole range is above / below 0, else `uncertain` |
| `leaderboard_eligible`, `prod_over_expected_rank` | Ranking by `prod_over_expected_mean` (1 = best) |
| `tier_baseline`, `tier_consistent`, `rank_pct_best/worst` | Robustness results (2021–2025 only) |

### Team scores, ranges and small groups

**Team scores are per-player averages.** A team's score is the mean of its transfers'
`prod_over_expected`: its value above price per transfer, with nothing adjusted. Each
player's difference already accounts for his price (expected is set by his rating), so
paying more is built in; averaging asks how much each pickup beat its price. A total was
tried and dropped: it only adds volume (more players = more credit) on top of the same
price-adjusted differences. The trade-off of averaging is that tiny groups can top or
bottom the board; they carry an "Only N scored transfers" tag and wide range bars. (An
earlier version shrank small groups toward the average with empirical Bayes; also dropped.)

**95% ranges** (`mean_intervals()`): mean ± 1.96 × s / √n, where s is the pooled
within-team standard deviation. Using the pooled SD gives even a one-player group a
(wide) range. The hit-rate range is clipped to 0–100%.

**Every team with at least one measured transfer is ranked** (`MIN_MEASURED_TOTAL` and
`MIN_MEASURED_SEASON` are 1): 133 of 136 teams for 2021–2025. Army, Navy and Air Force
have no FBS → FBS transfers. Teams with fewer than 10 measured transfers in totals, or 3
in one season (`FEW_MEASURED_TOTAL`, `FEW_MEASURED_SEASON`), are flagged on the site as
resting on few transfers, but not dropped.

Small groups swing a lot. Spread of team-season averages by size:

| Measured transfers | Team-seasons | SD of team averages |
|---|---|---|
| 1–4 | 403 | 6.9 |
| 5–9 | 180 | 4.2 |
| 10–14 | 20 | 4.0 |
| 15+ | 2 | 3.7 |

With only skill positions scored, a school averages about 17 scored transfers over five
years and about 3 a season, so single-season numbers are mostly small groups.

**Range signal (not shown on the site):** `prod_over_expected_signal` marks teams whose whole
95% range sits above (6 teams) or below (6) zero for 2021–2025. The site used to tag them
"clearly beat / missed expectations"; the tag was dropped because with 133 teams a few land
there by chance. The leaderboard instead colors each Difference by rank: green for the best
school shown, red for the worst, through yellow in between (`rankColor()` in
`Leaderboard.jsx`, relative to the current filter).

### Robustness checks

`src/robustness.py` reruns the 2021–2025 leaderboard under three alternatives and compares
each with the baseline:

| Variant | Change | Ranked teams | Spearman vs baseline | Top 10 kept | Bottom 10 kept |
|---|---|---|---|---|---|
| `no_cap` | Don't cap pool PPA at the 1st/99th percentiles | 133 | 0.999 | 10 | 9 |
| `rated_only` | Drop transfers with imputed ratings | 132 | 0.874 | 6 | 6 |
| `no_2021` | Drop the 2021 portal class | 133 | 0.944 | 6 | 7 |

- **The 1st/99th percentile cap barely matters.**
- **Imputation and 2021 matter somewhat** but don't overturn the ordering.
- **81 of 133 teams stay in the same third** (top / middle / bottom) in every variant
  (29 top, 20 middle, 32 bottom). The ones that move are mostly near tier boundaries or
  have few transfers.

### First results (2021–2025)

Scope: QB, RB, WR and TE only (2,363 of 6,744 transfers).

- **Cost predicts production only weakly for individual transfers.** Spearman between
  `cost_index` and: getting on the field 0.18, quality if he played 0.25, combined value
  0.27.
- **Proven vs unproven:**

  | Profile | n | Hit rate | Quality if played | Mean cost |
  |---|---|---|---|---|
  | Proven (played before) | 1,753 | 89% | +2.7 | +0.8 |
  | Unproven (no stats before) | 610 | 59% | −2.2 | −4.2 |

- **Gain (played on both sides, n = 1,566):** median +1.0 pts, and 56% improved. More
  expensive transfers gain less (Spearman −0.13), since they start higher.
- **Hit rate and quality are separate dimensions at the team level** (Spearman −0.01
  across team-seasons).
- **Cost and production are only loosely linked for teams** (Spearman 0.31 between
  `cost_mean` and `prod_value_mean` across team-seasons).
- **Highest average cost (all positions):** Georgia, Alabama, LSU, Miami, Florida State.
- **Most value above price per player:** Northern Illinois (+6.9, only 6 scored
  transfers), Duke (+6.8, 7), Oregon (+6.7), Miami (+6.2), Utah State (+5.2). 2025 alone:
  Duke (+13.4, 4 players), Tennessee, Ohio (2 players), Kansas, New Mexico.
- **Least:** UTEP (−6.7), Delaware (−6.2, 2 transfers), UTSA (−5.6), Auburn (−4.7),
  Minnesota (−4.5).
- **Repeatability is weak:** a school's per-player score one season barely predicts the next
  (rank correlation −0.08 to +0.14), and odd vs even years agree at 0.10. Rankings describe
  what happened more than a lasting skill.
- **Compared with the version that also scored defense** (rank correlation 0.70), the
  order shifted a lot, because defensive transfers were more than half the scored players.

## Site page

Routes (inside the site layout, in `src/App.jsx`):

- `/cfb-nil-comparison-tool`: main page
- `/cfb-nil-comparison-tool/team/:slug`: one page per team (slug = lowercase team name with dashes)

Files in `src/cfb-nil-comparison-tool/`:

| File | What it does |
|---|---|
| `CFBNilComparisonToolPage.jsx` | Main page: headline stats, quick guide, filters, view tabs, methodology |
| `ReadingGuide.jsx` | "New here?" guide: four steps, a key to the ± scale, how expected is calculated (with a chart of the QB line), Cam Ward example |
| `Leaderboard.jsx` | Ranked list with a range bar and the equation total actual − total expected = total |
| `CostScatter.jsx` | Price vs. results scatter plot (SVG), one dot per school, per player: expected production (its price in pts) across, actual production up, and a dashed "got what they paid for" line where they're equal. A dot's height above the line is its leaderboard score |
| `TeamPage.jsx` | Team summary cards, year-by-year table, every-player table |
| `TeamLogo.jsx` | ESPN logo with a team-color badge fallback |
| `useNilData.js` | Loads and caches the JSON, formatters |
| `cfb-nil-comparison-tool.css` | All styles for these pages |

Design notes:

- **Written for a general audience** (high school level): plain words, no statistics
  jargon on the page.
- **Plain-English sentences:** each team page opens with "X's transfers were rated .889 on
  average. Players rated like them usually play at +2.4 pts. They played at +7.0 pts, so they
  beat their ratings by 4.6 pts." Each player row adds his production in real stats under his
  stat line, and the guide has a units table and a plain-English line for the example.
- **Portal rating is shown as published** (stars + rating, e.g. ★★★★ .940; school
  averages like .889) so price and performance never look alike. Every performance number
  is plus/minus.
- **Main page:** headline cards, the quick guide, then season / conference filters and
  two views (Rankings, Price vs. results). The page uses up to 1440px of width.
- **Front page is one season at a time:** the season dropdown has no "All" option and
  defaults to the latest season (2025); team pages still offer the 2021–2025 view. Clicking a
  school opens its page on the season you were viewing.
- **Every FBS team is listed every season.** Schools with no scored transfers that season
  (no transfers at all, or none at QB/RB/WR/TE) sit at the bottom, A to Z, dimmed, with a
  dash for rank and score and a note saying why. The scatter plot shows only scored schools.
- **Leaderboard columns:** scored transfers, average rating, quality, the range bar,
  and actual − expected = difference per player, with its likely range underneath (hit rate
  is on team pages only). Expected and the difference are rounded to tenths first so the
  equation on screen always adds up. Quality drops out when the table is narrow; on phones
  only the difference shows.
- **Range bars** are sized to schools with enough transfers; the very long ranges of tiny
  groups fade out at the edge.
- **Team pages:** the player table ends with the same equation as the leaderboard,
  Actual − Expected = Difference (shared `equation()` helper in `useNilData.js`: expected
  and the difference rounded to tenths, actual = their sum, negative expected in
  parentheses, the difference in a pill). There's no Before Transfer column; it distracted
  from the comparison. Players who didn't play show their zero-production value with a
  "didn't play" tag. Sorted by Actual, highest first; every column is centered.
- Charts are plain SVG/CSS with no extra libraries.

### Site data

`src/export_site_data.py` runs at the end of the build and writes two files:

- **`teams.json`** (about 630 KB): `meta` plus one entry per team with `totals` and
  `seasons`.
- **`transfers.json`** (about 1.3 MB): every transfer, stored column by column to keep it
  small. Only team pages load it.

```
{
  "meta": {
    "generated", "seasons",
    "min_measured_total", "min_measured_season",
    "few_measured_total", "few_measured_season",
    "index": { "mean": 0, "sd": 10 },
    "averages": { "cost_mean", "prod_value_mean", "hit_rate", "prod_quality_mean", ... },
    "example": {
      "player": { name, season, position, origin, destination, stars, rating,
                  season_rating_mean, season_rating_sd, cost, production, expected,
                  over_expected },
      "line": { position, n, slope, intercept, points: [[cost, production], ...] },
      "team": { name, n_measured, mean, lo, hi, rank, n_ranked, signal }
    },
    "notes": [ ... ]
  },
  "teams": [ { "team", "conference", "abbreviation", "color", "alt_color", "logo",
               "logo_dark", "totals": {...}, "seasons": { "2021": {...}, ... } } ]
}
```

The worked example is `EXAMPLE_TRANSFER` in `export_site_data.py` (currently Cam Ward,
2024); the guide's text, formula and chart all update from the exported values.

## Design history: how the scale got here

The rating scale went through four versions before landing on plus/minus:

1. **Percentiles** (0–1 within each season): flattened the gap between good and great
   seasons, so elite production barely counted for more than solid production.
2. **An index with 100 = average** (15 points = 1 SD, like IQ scores): kept the size of
   elite seasons, but "100" read as a perfect score.
3. **A 0–100 Madden-style rating with letter grades** (70 = average; A 90+, B 80s, C 70s,
   D 60s, F under 60): felt familiar, but "70 = average" isn't intuitive, "72 out of 100"
   sounded like a percentage, and the grades were lopsided (42% of transfers landed in D
   and only 1.4% in F, because zero production already rated 60–65).
4. **0-centered plus/minus (current):** 0 = average, + above, − below, 10 points = 1 SD.
   This is the convention football analytics already uses (DVOA, EPA), so a coach reads
   +12 as "above average" and −8 as "below" without needing a key.

**Scope: real metrics only.** Defense was first scored with a homemade box-score formula
(tackles + 2 × TFL, sacks, passes defended, INT). It was dropped so every production number
is a public, respected metric: PPA, the college version of EPA. That limits scoring to QB,
RB, WR and TE (2,363 of 6,744 transfers) and shrank school samples to about 17 scored
transfers over five years. Other options considered: Approximate Value (NFL only) and PFF
grades / WAR (paid, not in CFBD).

Portal rating went its own way: after trying it as a 0–100 rating, a portal rank
("Top 2%") and plus/minus, it's now shown as published (stars + rating, ★★★★ .940).
Coaches already speak that language, and it keeps price visually distinct from
performance. The plus/minus version still drives the math.

**Lesson learned:** a 0-centered plus/minus scale works better than letter grades for
this. Grades hide where "average" sits and invite school-grade assumptions (a C sounds
mediocre, a D sounds failing) that don't match the data, while a signed number says
"how far above or below average" directly. The switch from version 3 to 4 only shifted
every rating by −70 and dropped the grades: every difference, range and ranking stayed
exactly the same.

## Decisions to revisit

These choices affect the results. The team-level ones are in `src/team_aggregate.py`:

- **The expected-production line is straight.** At the top of the market it
  underestimates: the 21 QB transfers with cost 90+ averaged 82.6 production, but the
  line predicts about 79 there. Teams that bought elite QBs get a few points of extra
  credit (Cam Ward's +20.9 would be closer to +17). A curved fit, or a separate fit for
  the top tier, would fix it.
- **Team scores are per-player averages**, so tiny groups can top a season; they're
  tagged. Totals were tried and dropped (see Team scores above).
- **Didn't play is scored separately from quality.** It counts as zero production only
  in `prod_value_after` and production over expected, and players with no stats before
  the transfer get no gain.
- **Rating construction:** capped at the 1st/99th percentiles (`CAP_PERCENTILES`); 0 and
  10 are `INDEX_MEAN` / `INDEX_SD`, capped above at `INDEX_MAX` (+30), in both
  `cost_model.py` and `team_aggregate.py`.
- **Only PPA positions are scored** (QB, RB, WR, TE). Defense used to be scored with a
  homemade box-score formula; it was dropped so every production number is a public,
  respected metric. Defenders, linemen and specialists still count toward cost.
- **Production is rated against FBS players who recorded a stat**, using broad position
  groups (QB, RB incl. FB, WR, TE).
- **Only incoming transfers count.** Players a team loses to the portal are not netted out.
- **OL and specialists** count toward cost but have no production score.

The matching ones are in `src/build_dataset.py`:

- **Same-school returns are dropped** (138 rows). Set `DROP_SAME_SCHOOL = False` to keep them.
- **Each portal entry is its own transfer.** Repeat transfers get one row per move; exact
  duplicates within one cycle keep the latest entry.
- **Fuzzy threshold is 90**, plus the nickname rule. Review the fuzzy match lists in
  `match_report.txt`. Ones worth a look: Alexander Honig QB → "Alex Honig" TE, and
  Vincent Jackson → "Vincent Carroll-Jackson".
- **Matching by athlete ID** was added beyond the original plan, because the ID usually
  stays the same through a transfer.
- **Split-position PPA rows are combined** rather than picking one.

## Known limitations

- **Survivorship:** production data only includes players who recorded a stat. A
  missing AFTER row can mean the player didn't play, not that the match failed.
- **Offense-only advanced metrics:** PPA and usage exist only for QB/RB/WR/TE/FB.
  Defenders are measured with box-score stats only, and linemen have almost nothing.
- **FCS transfers are excluded** by design (e.g. Travis Hunter, Shedeur Sanders).
- **2021 portal data looks incomplete.** It has 1,770 entries vs 4,499 in 2025, and some
  programs have no incoming transfers that year (e.g. Oregon has none in the raw data).
  Team totals that include 2021 may undercount.
- **Portal ratings are a proxy, not real spending.** They reflect how highly a player was
  rated, not what he was paid. The 2026 budget cross-check is there to test how well the
  proxy holds up at the team level, but it compares a single future season against
  2021–2025 history.

## Next steps

- Choose a source for reported 2026 team NIL budgets and compare team rankings against
  the portal-rating cost measure.
- Review the flagged fuzzy matches and athlete-ID mismatches in `match_report.txt`.
- Consider a curved expected-production line (see above).
- Git cleanup: commit `projects/cfb-nil-comparison-tool/`, `src/cfb-nil-comparison-tool/`, `public/data/cfb-nil-comparison-tool/`
  and the route change in `src/App.jsx` on a new branch.
