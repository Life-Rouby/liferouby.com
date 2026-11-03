# CFBargain

Compares each FBS transfer's on-field production with what his portal rating says he
should produce: his **expected PPA** vs. the **actual PPA** he produced in his first season
after transferring. The portal rating stands in for what a school spent on his NIL, so a
bigger difference (actual − expected) means a better return on that investment.
The site page lives at [liferouby.com/cfbargain](https://liferouby.com/cfbargain)
and is intentionally not listed on the Projects page yet.

The pipeline builds a player-level dataset of FBS → FBS transfers with production
**before** (at the origin school) and **after** (at the destination school), measures
production as raw PPA (points added, no rescaling or cap), fits an expected-PPA line per
position, and exports JSON for the site. The site is **player-first**: the main page ranks
players by actual − expected, filtered by season, position (default: quarterbacks) and
conference. School pages average the same differences over a school's transfers.

**Scope: the platform scores only quarterbacks, running backs, wide receivers and tight
ends**, the four positions PPA (predicted points added) covers. Defenders, offensive linemen
and specialists appear on team pages but are never scored, so they count neither for nor
against a school. Raw PPA is much bigger for QBs (they're part of far more plays), so
players are best compared within a position, and school averages lean on their QBs. Every
average portal rating on the site uses the scored players only (`rating_measured_mean`; all
schools .856).

Historical team-level NIL spending isn't publicly reliable, so the project measures cost
in two ways (see [Cost measures](#cost-measures)):

- **Primary:** transfer portal ratings, as a proxy for what each player cost (2021–2025).
- **Cross-check:** reported 2026 team NIL budgets, used separately to check whether the
  teams that rank high on portal-rating "spend" also have the biggest budgets.

The project does **not** pull actual team-level NIL spending numbers.

## Project layout

```
projects/cfbargain/
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
src/cfbargain/                # React page, team pages, charts, styles
public/data/cfbargain/        # teams.json, transfers.json (written by export_site_data.py)
src/App.jsx                    # routes /cfbargain and /cfbargain/team/:slug
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

Run it from `projects/cfbargain/`. The script writes to `data/raw/` relative to the
current directory.

### Building the dataset and site data

```bash
python src/build_dataset.py
```

This reads only `data/raw/`, makes no API calls, writes everything in
`data/processed/`, and exports the site JSON to `public/data/cfbargain/`.

### Viewing the site locally

From the repo root: `npm run dev`, then open http://localhost:5173/cfbargain.

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
+ is pricier, − is cheaper, and every 10 points is one standard deviation. Scores are
capped at +30 (3 SD). The result is
`cost_index_observed`. Observed values run from about −34 to +30; every 5★ and a handful
of 4★ transfers sit at the +30 cap.

**What the site shows:** the plus/minus number is the x-axis of the expected-PPA line, but the site shows
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

### Production: raw PPA

Each scored transfer's production is his **season total PPA** (predicted points added,
CFBD's college version of EPA), in CFBD's own units: "points added". There is no rescaling
and no cap.

1. **Raw score, per player-season:**
   - Offense (QB, RB, WR, TE): total PPA, summed over every play he was part of.
   - OL, defense and specialists: **not measured** (no PPA).
2. **Position group:** QB, RB (incl. FB), WR or TE, from the position he's listed at in
   that season's production data; if that isn't usable, his portal position. This group
   sets his expected-PPA line and the site's position filter.
3. **Playing time and quality are kept separate.** "Never played" is not treated as
   "worst player in FBS":
   - **AFTER side:** `played_after` records whether he got on the field at all (the hit
     rate), and `prod_index_after` is his season PPA, only for players who played.
     Players who didn't play still count through `prod_value_after`: his PPA if he
     played, otherwise **0**. That puts "contributed nothing" above players whose total
     PPA was negative.
   - **BEFORE side:** no stats at the old school means *unknown* (redshirt, injury or
     depth chart), not *bad*. These transfers are labeled `unproven` and get no
     `prod_gain`.
   - **`prod_gain` is only calculated for transfers who played on both sides** (1,566 of
     2,363 scored transfers).

Raw PPA differs a lot by position. Average PPA among those who played: QB 51.2, WR 21.1,
RB 11.6, TE 10.1. That's why each position gets its own expected line and why the site
defaults to one position at a time.

**Pass plays count twice.** CFBD credits a completion to both the passer and the targeted
receiver, so adding PPA across positions double counts. Within one position it doesn't
matter; school averages mix positions, and the team page says so.

(Earlier versions put production on a 0-centered "pts" scale: 10 × z-score against all FBS
players at the position that season, capped at the 1st/99th percentiles and at +30. See
[Design history](#design-history-how-the-scale-got-here) for why it was dropped.)

### Expected production

`prod_over_expected` compares what a transfer produced with what his cost predicts. For
each position group, a straight line is fit through every scored transfer
(`prod_value_after` against `cost_index`, least squares; `expected_lines()` in
`team_aggregate.py`). A player's expected PPA is where his cost lands on the line.

Example for QBs (498 transfers): **expected = 42.6 + 2.239 × cost**. Cam Ward's cost of
+26.3 gives 42.6 + 2.239 × 26.3 = 101.5 points added. He produced 268.0, so he was
+166.5 over expected.

The line is flat because cost only weakly predicts production (Spearman 0.27 between
cost and production for individual transfers). Every 10 cost points adds about 22 expected
PPA for QBs. See [Decisions to revisit](#decisions-to-revisit) for a known weakness at the
top end.

Transfer-level production columns in `transfers.csv`:

| Column | Meaning |
|---|---|
| `production_measured` | Position has a production score |
| `played_before`, `played_after` | Recorded any stat on that side |
| `prod_ref_group_before`, `prod_ref_group_after` | Position group (QB/RB/WR/TE) he was scored at |
| `prod_index_before`, `prod_index_after` | Season total PPA; blank if he didn't play (the column names are kept from the old rescaled version) |
| `prod_value_after` | `prod_index_after` if he played, else 0 |
| `prod_gain` | `prod_index_after − prod_index_before`, only if he played on both sides |
| `transfer_profile` | `proven` (played before) or `unproven` (no stats before) |
| `prod_over_expected` | `prod_value_after` minus expected PPA for his cost and position |
| `prod_expected` | Expected PPA for his cost and position (`prod_value_after − prod_over_expected`) |

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
| `prod_quality_mean` | Mean PPA among those who played |
| `prod_value_mean` | Mean `prod_value_after` (actual PPA, didn't play = 0) |
| `prod_expected_mean` | Mean expected PPA for the transfers' costs |
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

**Team scores (school pages) are per-player averages.** A team's score is the mean of its transfers'
`prod_over_expected`: its value above price per transfer, with nothing adjusted. Each
player's difference already accounts for his price (expected is set by his rating), so
paying more is built in; averaging asks how much each pickup beat its price. A total was
tried and dropped: it only adds volume (more players = more credit) on top of the same
price-adjusted differences. The trade-off of averaging is that tiny groups swing a lot;
they carry an "Only N scored transfers" note and wide ranges. (An earlier version shrank
small groups toward the average with empirical Bayes; also dropped.) In raw PPA a school's
average leans on its QBs, since their differences are several times larger (SD of player
differences: QB 58.9, WR 21.1, RB 16.2, TE 11.5).

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
| 1–4 | 403 | 24.3 |
| 5–9 | 180 | 13.2 |
| 10–14 | 20 | 11.1 |
| 15+ | 2 | 7.9 |

With only skill positions scored, a school averages about 17 scored transfers over five
years and about 3 a season, so single-season numbers are mostly small groups.

**Range signal (not shown on the site):** `prod_over_expected_signal` marks teams whose whole
95% range sits above (8 teams) or below (0) zero for 2021–2025. The site doesn't tag them,
because with 133 teams a few land there by chance. The player rankings color each
Difference by rank instead: green for the best player shown, red for the worst, through
yellow in between (`rankColor()` in `useNilData.js`, relative to the current filter).

### Robustness checks

`src/robustness.py` reruns the 2021–2025 school averages under two alternatives and
compares each with the baseline:

| Variant | Change | Ranked teams | Spearman vs baseline | Top 10 kept | Bottom 10 kept |
|---|---|---|---|---|---|
| `rated_only` | Drop transfers with imputed ratings | 132 | 0.896 | 7 | 8 |
| `no_2021` | Drop the 2021 portal class | 133 | 0.946 | 7 | 10 |

- **Imputation and 2021 matter somewhat** but don't overturn the ordering.
- **96 of 133 teams stay in the same third** (top / middle / bottom) in every variant
  (35 top, 26 middle, 35 bottom).
- The old `no_cap` variant was removed with the cap.
- School averages in raw PPA correlate 0.82 (Spearman) with the old pts version: mostly
  the same order, with QB-heavy schools moving the most.

### First results (2021–2025)

Scope: QB, RB, WR and TE only (2,363 of 6,744 transfers).

- **Cost predicts production only weakly for individual transfers.** Spearman between
  `cost_index` and: getting on the field 0.18, PPA if he played 0.25, combined value 0.27.
- **Proven vs unproven:**

  | Profile | n | Hit rate | PPA if played | Mean cost |
  |---|---|---|---|---|
  | Proven (played before) | 1,753 | 89% | 26.3 | +0.8 |
  | Unproven (no stats before) | 610 | 59% | 12.0 | −4.2 |

- **Gain (played on both sides, n = 1,566):** median +1.6 points added, and 54% improved.
  More expensive transfers gain less (Spearman −0.13), since they start higher.
- **Hit rate and quality are separate dimensions at the team level** (Spearman 0.02
  across team-seasons).
- **Cost and production are only loosely linked for teams** (Spearman 0.27 between
  `cost_mean` and `prod_value_mean` across team-seasons).
- **Highest average cost (all positions):** Georgia, Alabama, LSU, Miami, Florida State.
- **Best 2025 players vs. their price, by position:** QB Anthony Colandrea (+163.3),
  RB Cam Cook (+56.0), WR Camden Brown (+62.1), TE Tanner Koziol (+42.6).
- **Most value above price per player (schools):** Northern Illinois (+35.7, only 6 scored
  transfers), Miami (+24.3, 15), Oregon (+23.8), Duke (+23.1), Notre Dame (+22.1).
  2025 alone: Tennessee (+51.6, 3 players), Duke, BYU, Houston, Buffalo.
- **Least:** Delaware (−26.2, 2 transfers), UTEP (−18.8), Iowa (−18.3), Wisconsin
  (−14.5), Sam Houston (−13.0).
- **Repeatability is weak:** a school's per-player score one season barely predicts the next
  (rank correlation −0.06 to +0.09), and odd vs even years agree at 0.08. School averages
  describe what happened more than a lasting skill.

## Site page

Routes (inside the site layout, in `src/App.jsx`):

- `/cfbargain`: main page
- `/cfbargain/team/:slug`: one page per team (slug = lowercase team name with dashes)

Files in `src/cfbargain/`:

| File | What it does |
|---|---|
| `CFBargainPage.jsx` | Main page: headline stats, quick guide, season / position / conference filters, the two views, methodology |
| `ReadingGuide.jsx` | "New here?" guide: what PPA is and what the project compares, the Cam Ward example, how expected is calculated (with a chart of the QB line), glossary |
| `PlayerBoard.jsx` | Player rankings: every scored transfer, best actual − expected first; 50 rows, then "Show all" |
| `PlayerScatter.jsx` | Price vs. results scatter (SVG): one dot per player, expected PPA across, actual PPA up, a dashed "got what they paid for" line; hover picks the nearest dot |
| `TeamPage.jsx` | School page: summary cards, year-by-year table, every-player table |
| `TeamLogo.jsx` | ESPN logo with a team-color badge fallback |
| `useNilData.js` | Loads and caches the JSON; formatters, `equation()`, `statLine()`, `rankColor()` |
| `cfbargain.css` | All styles for these pages |

Design notes:

- **Written for a general audience** (high school level): plain words, no statistics
  jargon on the page.
- **Player-first.** The main page ranks players, not schools (school rankings were found
  confusing). Filters: season (one at a time, default 2025), position (default
  **Quarterbacks**; "All positions" is available but QBs fill its top and bottom, and the
  page says so) and conference (the new school's). Both views use the same filters.
- **Rankings table:** rank, player, position (with "portal: ATH" when the portal listed him
  differently), portal rating, old and new schools as logos (name on hover; the new school
  links to its page), Actual − Expected = Difference, and his stat line. Players who didn't
  play are included at 0 with a small "didn't play" tag under the number.
- **Raw PPA everywhere.** Every production number is points added as CFBD publishes it.
  The `equation()` helper rounds actual and expected to tenths and shows their difference,
  so each equation adds up and actual matches the published PPA.
- **Portal rating is shown as published** (stars + rating, e.g. ★★★★ .940; school
  averages like .889), so price and performance never look alike.
- **School pages** open with a plain sentence ("Players rated like them usually add 34.6
  PPA. They added 51.6, so they beat their price by 17.0 PPA per player."), note that school
  averages lean on QBs and that completions count for both QB and receiver, and end with
  the same per-player equation table.
- Charts are plain SVG/CSS with no extra libraries.

### Site data

`src/export_site_data.py` runs at the end of the build and writes two files:

- **`teams.json`** (about 630 KB): `meta` plus one entry per team with `totals` and
  `seasons`.
- **`transfers.json`** (about 1.2 MB): every transfer, stored column by column to keep it
  small. The main page and team pages load it.

```
{
  "meta": {
    "generated", "seasons",
    "min_measured_total", "min_measured_season",
    "few_measured_total", "few_measured_season",
    "index": { "mean": 0, "sd": 10 },   // the cost (portal rating) scale
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
4. **0-centered plus/minus:** 0 = average, + above, − below, 10 points = 1 SD.
   This is the convention football analytics already uses (DVOA, EPA), so a coach reads
   +12 as "above average" and −8 as "below" without needing a key.
5. **Raw PPA (current):** production is shown exactly as CFBD publishes it, in points
   added. The plus/minus "pts" were a conversion of PPA, and mixing the two confused
   readers: "QBs rated like him usually add about 97 points. He added 268, beating his
   rating by 20.8 pts" read as if it didn't add up (20.8 was in pts, and the cap had
   trimmed his 268 to about 224). Raw PPA is a real public metric, needs no cap, and
   keeps the same order within a position. The trade-off is that positions aren't
   comparable (QBs are part of far more plays), so the site defaults to one position.

**Scope: real metrics only.** Defense was first scored with a homemade box-score formula
(tackles + 2 × TFL, sacks, passes defended, INT). It was dropped so every production number
is a public, respected metric: PPA, the college version of EPA. That limits scoring to QB,
RB, WR and TE (2,363 of 6,744 transfers) and shrank school samples to about 17 scored
transfers over five years. Other options considered: Approximate Value (NFL only) and PFF
grades / WAR (paid, not in CFBD).

Portal rating went its own way: after trying it as a 0–100 rating, a portal rank
("Top 2%") and plus/minus, it's now shown as published (stars + rating, ★★★★ .940).
Coaches already speak that language, and it keeps price visually distinct from
performance. The plus/minus version of the rating still drives the expected-PPA line.

**Lesson learned:** a 0-centered plus/minus scale works better than letter grades for
this. Grades hide where "average" sits and invite school-grade assumptions (a C sounds
mediocre, a D sounds failing) that don't match the data, while a signed number says
"how far above or below average" directly. The switch from version 3 to 4 only shifted
every rating by −70 and dropped the grades: every difference, range and ranking stayed
exactly the same. The later move to raw PPA went one step further and dropped the
conversion entirely.

## Decisions to revisit

These choices affect the results. The team-level ones are in `src/team_aggregate.py`:

- **The expected-production line is straight.** At the top of the market it
  underestimates: the 14 QB transfers with cost +25 or more averaged 134.6 PPA, but the
  line predicts about 107.8 for them. Elite QBs get some extra credit. A curved fit, or a
  separate fit for the top tier, would fix it.
- **One expected line per position, pooled over 2021–2025.** Raw PPA isn't adjusted for
  season-wide changes (the old pts scale rated each season separately).
- **Team scores are per-player averages** over mixed positions, so they lean on QBs, and
  tiny groups swing a lot. Totals were tried and dropped (see Team scores above).
- **Didn't play is scored separately from quality.** It counts as 0 PPA only in
  `prod_value_after` and production over expected, and players with no stats before the
  transfer get no gain.
- **Cost rating construction:** 0 and 10 are `INDEX_MEAN` / `INDEX_SD`, capped above at
  `INDEX_MAX` (+30), in `cost_model.py`. Production has no cap.
- **Only PPA positions are scored** (QB, RB, WR, TE). Defense used to be scored with a
  homemade box-score formula; it was dropped so every production number is a public,
  respected metric. Defenders, linemen and specialists still count toward cost.
- **Position groups** are broad (QB, RB incl. FB, WR, TE), taken from the production data.
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
- **Offense-only advanced metrics:** PPA and usage exist only for QB/RB/WR/TE/FB, so
  defenders, linemen and specialists aren't scored.
- **PPA double counts pass plays** across the passer and the receiver.
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
- Git cleanup: commit `projects/cfbargain/`, `src/cfbargain/`, `public/data/cfbargain/`
  and the route change in `src/App.jsx` on a new branch.
