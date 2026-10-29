import { Link } from "react-router-dom";
import TeamLogo from "./TeamLogo";
import {
  equation, fmtIndex, fmtPoints, fmtRating, fmtSubtracted, fmtTenths, teamSlug,
} from "./useNilData";

// Range-plot domain in rating points: symmetric around 0 (average), rounded up
// to a whole tick step. Sized to the schools with enough transfers; the very long
// ranges of tiny groups are clipped at the edge instead of squashing everyone else.
function plotDomain(rows, fewSample) {
  const sized = rows.filter(({ stats }) => stats.n_measured >= fewSample);
  const extent = Math.max(4, ...(sized.length ? sized : rows).flatMap(({ stats }) => [
    Math.abs(stats.prod_over_expected_lo), Math.abs(stats.prod_over_expected_hi),
  ]));
  const step = tickStep(extent);
  return Math.ceil(extent / step) * step;
}

// About four labeled ticks per side.
const tickStep = (domain) => [2, 5, 10, 20, 25, 50, 100, 200].find((s) => domain / s <= 4) ?? 500;

// Labeled ticks: average plus whole steps, kept off the edges so labels don't
// spill into neighboring columns.
function ticks(domain) {
  const step = tickStep(domain);
  const out = [0];
  for (let t = step; t < domain - 1e-9; t += step) out.push(t, -t);
  return out;
}

const tickLabel = (t) => (t === 0 ? "avg" : `${t > 0 ? "+" : "−"}${Math.abs(t)}`);

function RangeBar({ stats, domain }) {
  const clip = (v) => Math.min(domain, Math.max(-domain, v));
  const pos = (v) => `${((clip(v) + domain) / (2 * domain)) * 100}%`;
  const lo = stats.prod_over_expected_lo;
  const hi = stats.prod_over_expected_hi;
  const cut = [lo < -domain && "is-cut-lo", hi > domain && "is-cut-hi"].filter(Boolean).join(" ");
  return (
    <div className="nil-range" aria-hidden="true">
      <span className="nil-range-zero" style={{ left: pos(0) }} />
      <span className={`nil-range-line ${cut}`} style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }} />
      <span className="nil-range-dot" style={{ left: pos(stats.prod_over_expected_mean) }} />
    </div>
  );
}

// Difference pill color by place in the list shown: best = green, worst = red,
// through yellow in the middle. A light tint behind dark text of the same hue.
function rankColor(i, n) {
  const t = n > 1 ? 1 - i / (n - 1) : 1; // 1 = best, 0 = worst
  const hue = Math.round(t * 130);
  return { background: `hsl(${hue} 65% 86%)`, color: `hsl(${hue} 70% 22%)` };
}

// A school's per-player actual − expected = difference (see `equation`).
const expected = (stats) => equation(stats.prod_expected_mean, stats.prod_over_expected_mean).expected;
const actual = (stats) => equation(stats.prod_expected_mean, stats.prod_over_expected_mean).actual;

// Why a school has no score this season.
const unscoredReason = (stats) => (stats.n_transfers === 0
  ? "Not ranked: no transfers this season"
  : "Not ranked: no QB, RB, WR or TE transfers");

export default function Leaderboard({ rows, season, fewSample }) {
  if (!rows.length) {
    return <p className="nil-empty">No teams for this filter.</p>;
  }
  const ranked = rows.filter(({ stats }) => stats.leaderboard_eligible);
  const domain = plotDomain(ranked.length ? ranked : rows, fewSample);
  const axisTicks = ticks(domain);

  return (
    <div className="nil-board" role="table" aria-label="Production over expected leaderboard">
      <div className="nil-board-head" role="row">
        <span role="columnheader" className="nil-col-rank">#</span>
        <span role="columnheader" className="nil-col-team">Team</span>
        <span role="columnheader" className="nil-col-num nil-hide-sm" title="Transfers at QB, RB, WR and TE">Scored transfers</span>
        <span role="columnheader" className="nil-col-num nil-hide-sm" title="Average published portal rating of its scored transfers (QB, RB, WR, TE; higher = pricier)">Avg rating</span>
        <span role="columnheader" className="nil-col-num nil-hide-md" title="Average score of the transfers who played">Quality</span>
        <span role="columnheader" className="nil-col-plot">
          <span className="nil-axis">
            {axisTicks.map((t) => (
              <span key={t} style={{ left: `${((t + domain) / (2 * domain)) * 100}%` }}>
                {tickLabel(t)}
              </span>
            ))}
          </span>
        </span>
        <span role="columnheader" className="nil-col-value nil-eq">
          <span className="nil-eq-term nil-hide-sm" title="How its transfers actually played, per player">Actual</span>
          <span className="nil-eq-op nil-hide-sm" aria-hidden="true">−</span>
          <span className="nil-eq-term nil-hide-sm" title="How players with their ratings usually play, per player">Expected</span>
          <span className="nil-eq-op nil-hide-sm" aria-hidden="true">=</span>
          <span className="nil-eq-result" title="Value above price per player, in production points">Difference (pts)</span>
        </span>
      </div>

      {rows.map(({ team, stats }, i) => {
        const isRanked = stats.leaderboard_eligible;
        return (
        <Link
          key={team.team}
          to={`/cfb-nil-comparison-tool/team/${teamSlug(team.team)}${season === "all" ? "" : `?season=${season}`}`}
          className={isRanked ? "nil-board-row" : "nil-board-row is-unranked"}
          role="row"
        >
          <span role="cell" className="nil-col-rank">{isRanked ? stats.prod_over_expected_rank : "–"}</span>
          <span role="cell" className="nil-col-team">
            <TeamLogo team={team} size={26} />
            <span className="nil-team-text">
              <span className="nil-team-name">{team.team}</span>
              {isRanked && stats.n_measured < fewSample && (
                <span className="nil-signal nil-signal--few">Only {stats.n_measured} scored transfer{stats.n_measured === 1 ? "" : "s"}</span>
              )}
              {!isRanked && <span className="nil-signal nil-signal--few">{unscoredReason(stats)}</span>}
            </span>
          </span>
          <span role="cell" className="nil-col-num nil-hide-sm">{stats.n_measured}</span>
          <span role="cell" className="nil-col-num nil-hide-sm">{fmtRating(stats.rating_measured_mean)}</span>
          <span role="cell" className="nil-col-num nil-hide-md">{fmtIndex(stats.prod_quality_mean)}</span>
          <span role="cell" className="nil-col-plot">
            {isRanked && <RangeBar stats={stats} domain={domain} />}
          </span>
          {isRanked ? (
          <span
            role="cell"
            className="nil-col-value nil-eq"
            aria-label={`Actual ${fmtTenths(actual(stats))} minus expected ${fmtTenths(expected(stats))} equals ${fmtPoints(stats.prod_over_expected_mean)} per player`}
          >
            <span className="nil-eq-term nil-hide-sm">{fmtTenths(actual(stats))}</span>
            <span className="nil-eq-op nil-hide-sm" aria-hidden="true">−</span>
            <span className="nil-eq-term nil-eq-term--muted nil-hide-sm">{fmtSubtracted(expected(stats))}</span>
            <span className="nil-eq-op nil-hide-sm" aria-hidden="true">=</span>
            <span className="nil-eq-result">
              <span className="nil-eq-pill" style={rankColor(i, ranked.length)}>
                {fmtPoints(stats.prod_over_expected_mean)}
              </span>
              <span className="nil-value-range">
                {fmtPoints(stats.prod_over_expected_lo)} to {fmtPoints(stats.prod_over_expected_hi)}
              </span>
            </span>
          </span>
          ) : (
            <span role="cell" className="nil-col-value nil-eq nil-eq--empty">–</span>
          )}
        </Link>
        );
      })}
    </div>
  );
}
