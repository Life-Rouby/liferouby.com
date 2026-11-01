import { equation, fmtAmount, fmtIndex, fmtPoints, fmtRating, fmtRaw, fmtStars, fmtTenths } from "./useNilData";

// Round tick step for an axis spanning `span` units, about `count` ticks.
const niceStep = (span, count = 6) => [5, 10, 20, 25, 50, 100, 200].find((s) => span / s <= count) ?? 500;

const ordinal = (n) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
};

function ExampleRange({ team }) {
  const extent = Math.max(4, Math.abs(team.lo), Math.abs(team.hi));
  const step = extent > 50 ? 25 : extent > 20 ? 10 : 2;
  const domain = Math.ceil(extent / step) * step;
  const pos = (v) => `${((v + domain) / (2 * domain)) * 100}%`;
  return (
    <div className="nil-guide-range">
      <div className="nil-range">
        <span className="nil-range-zero" style={{ left: pos(0) }} />
        <span className="nil-range-line" style={{ left: pos(team.lo), width: `calc(${pos(team.hi)} - ${pos(team.lo)})` }} />
        <span className="nil-range-dot" style={{ left: pos(team.mean) }} />
      </div>
      <div className="nil-guide-range-labels">
        <span style={{ left: pos(0) }}>normal school</span>
        <span style={{ left: pos(team.mean) }}>{team.name} {fmtPoints(team.mean)}</span>
      </div>
      <p className="nil-guide-range-caption">
        Dot = {team.name}'s score. Line = likely range ({fmtPoints(team.lo)} to{" "}
        {fmtPoints(team.hi)}). Thin mark = 0.
      </p>
    </div>
  );
}

// Every transfer at the example player's position (gray dots), the straight line
// that fits them, and the example player: his expected score sits on the line,
// his actual score above or below it, and the gap between them is "beat
// expectations by".
const CHART = { w: 560, h: 320, left: 60, right: 16, top: 16, bottom: 40 };

function ExpectedChart({ line, player }) {
  const xs = [-40, 30];
  const values = [...line.points.map(([, v]) => v), player.production, 0];
  const yStep = niceStep(Math.max(...values) - Math.min(...values));
  const ys = [Math.floor(Math.min(...values) / yStep) * yStep, Math.ceil(Math.max(...values) / yStep) * yStep];
  const yTicks = [];
  for (let t = ys[0]; t <= ys[1]; t += yStep) yTicks.push(t);
  const plotW = CHART.w - CHART.left - CHART.right;
  const plotH = CHART.h - CHART.top - CHART.bottom;
  const sx = (v) => CHART.left + ((v - xs[0]) / (xs[1] - xs[0])) * plotW;
  const sy = (v) => CHART.top + (1 - (v - ys[0]) / (ys[1] - ys[0])) * plotH;
  const fit = (x) => line.intercept + line.slope * x;
  const clampY = (v) => Math.min(ys[1], Math.max(ys[0], v));
  const px = sx(player.cost);
  const expY = sy(player.expected);
  const actY = sy(player.production);
  const gapAbove = player.production >= player.expected;

  return (
    <svg
      className="nil-expected-chart"
      viewBox={`0 0 ${CHART.w} ${CHART.h}`}
      role="img"
      aria-label={`Every ${line.position} transfer's portal rating (vs. that year's average) against the PPA he produced, with the trend line. ${player.name}'s rating of ${fmtIndex(player.cost)} lands on the line at an expected ${fmtTenths(player.expected)} PPA; he actually produced ${fmtTenths(player.production)}.`}
    >
      {[-30, -20, -10, 0, 10, 20, 30].map((t) => (
        <g key={`x${t}`}>
          <line className="nil-grid" x1={sx(t)} x2={sx(t)} y1={CHART.top} y2={CHART.top + plotH} />
          <text className="nil-tick" x={sx(t)} y={CHART.top + plotH + 16} textAnchor="middle">{fmtIndex(t)}</text>
        </g>
      ))}
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line className="nil-grid" x1={CHART.left} x2={CHART.left + plotW} y1={sy(t)} y2={sy(t)} />
          <text className="nil-tick" x={CHART.left - 8} y={sy(t) + 4} textAnchor="end">{fmtIndex(t)}</text>
        </g>
      ))}
      <text className="nil-axis-title" x={CHART.left + plotW / 2} y={CHART.h - 4} textAnchor="middle">
        Portal rating vs. that year's average (0 = average) →
      </text>
      <text className="nil-axis-title" transform={`translate(12 ${CHART.top + plotH / 2}) rotate(-90)`} textAnchor="middle">
        PPA he produced →
      </text>

      {line.points.map(([c, v], i) => (
        c >= xs[0] && <circle key={i} className="nil-expected-dot" cx={sx(c)} cy={sy(clampY(v))} r={2.6} />
      ))}

      <line className="nil-expected-fit" x1={sx(xs[0])} y1={sy(fit(xs[0]))} x2={sx(xs[1])} y2={sy(fit(xs[1]))} />
      <text className="nil-expected-fit-label" x={sx(-26)} y={sy(fit(-26)) + 18}>trend line</text>

      {/* the gap between expected and actual */}
      <line className="nil-expected-gap" x1={px} x2={px} y1={expY} y2={actY} />
      {/* label on whichever side of the gap has room */}
      <text className="nil-expected-gap-label" x={px > CHART.w - 70 ? px - 8 : px + 8}
        y={(expY + actY) / 2 + 4} textAnchor={px > CHART.w - 70 ? "end" : "start"}>
        {fmtTenths(equation(player.expected, player.over_expected).difference)}
      </text>

      <circle className="nil-expected-on-line" cx={px} cy={expY} r={5.5} />
      <text className="nil-expected-label" x={px - 9} y={expY + (gapAbove ? 16 : -10)} textAnchor="end">
        Expected {fmtTenths(player.expected)}
      </text>
      <circle className="nil-expected-player" cx={px} cy={actY} r={6.5} />
      <text className="nil-expected-label is-strong" x={px - 10} y={actY + (gapAbove ? -2 : 16)} textAnchor="end">
        {player.name}: {fmtTenths(player.production)}
      </text>
    </svg>
  );
}

// Step-by-step: how one player's expected score comes off the line. The worked
// numbers are rounded first and then multiplied, so the arithmetic shown checks out.
function ExpectedExplainer({ line, player }) {
  const a = Number(line.intercept.toFixed(1));
  const b = Number(line.slope.toFixed(3));
  const x = Math.round(player.cost * 10) / 10;
  const result = a + b * x;
  // "−0.2 + 0.344 × portal rating", with the starting number's own sign
  const start = a < 0 ? `−${Math.abs(a)}` : `${a}`;
  const xText = x < 0 ? `(${fmtTenths(x)})` : fmtTenths(x);
  const per10 = (b * 10).toFixed(1);
  return (
    <div className="nil-guide-expected">
      <div className="nil-guide-expected-text">
        <h3>How expected is calculated</h3>
        <ol>
          <li>
            <strong>Compare his rating with that year's transfers.</strong> {player.name}'s{" "}
            {fmtRating(player.rating)} vs. the {player.season} average ({fmtRating(player.season_rating_mean)})
            = {fmtTenths(player.cost)}.
          </li>
          <li>
            <strong>Plot every {line.position} transfer</strong> ({line.n.toLocaleString()}): rating
            across, PPA up. Players who didn't play count as 0.
          </li>
          <li>
            <strong>Fit a straight line</strong> through the dots:
            <span className="nil-guide-formula">
              expected = {start} + {b} × rating
            </span>
          </li>
          <li>
            <strong>Plug him in:</strong>
            <span className="nil-guide-formula">
              {start} + {b} × {xText} = {fmtTenths(result).replace("+", "")} PPA
            </span>
          </li>
        </ol>
        <p>
          Ratings are a rough guess, so the line is fairly flat: each +10 of rating adds only about{" "}
          {per10} expected PPA. Each position has its own line.
        </p>
      </div>
      <ExpectedChart line={line} player={player} />
    </div>
  );
}

export default function ReadingGuide({ example, scale }) {
  const { player, team } = example;
  const eq = equation(player.expected, player.over_expected);
  const costSd = (player.cost - scale.mean) / scale.sd;
  const ratingNote = costSd >= 1.5
    ? `one of the top-rated transfers of ${player.season}`
    : `${costSd >= 0 ? "an above" : "a below"}-average transfer for ${player.season}`;

  return (
    <details className="card nil-guide" open>
      <summary>New here? Start with this quick guide</summary>

      <div className="nil-guide-core">
        <p>
          <strong>PPA (predicted points added)</strong> is the college version of EPA: how much each
          play he was part of changed his team's expected points, added up over the season. Only QBs,
          RBs, WRs and TEs have it. QBs are part of far more plays, so their numbers are much bigger:
          compare players within a position.
        </p>
        <p>
          This project compares a transfer's <strong>expected PPA</strong> with the{" "}
          <strong>actual PPA</strong> he produced in his first season after transferring. His
          expected PPA is how an average player with his portal rating performs.
        </p>
        <p>
          <strong>Actual − expected = the difference:</strong> how much better (+) or worse (−) he
          played than a typical player with the same rating.
        </p>
        <p>
          A player's portal rating stands in for how much a school spent on his NIL, so a bigger
          difference means a better return on that investment. The rankings put the biggest
          differences first.
        </p>
      </div>

      <div className="nil-guide-example">
        <p className="eyebrow">Example</p>
        <p className="nil-guide-example-intro">
          Here's how it works for {player.name} at {player.destination}.
        </p>
        <h3>
          {player.name}, {player.position}: {player.origin} → {player.destination} ({player.season})
        </h3>

        <div className="nil-guide-chain">
          <div>
            <span className="nil-guide-label">Portal rating</span>
            <span className="nil-guide-value">{fmtRating(player.rating)}</span>
            <span className="nil-guide-note">{fmtStars(player.stars)}, {ratingNote}</span>
          </div>
          <div>
            <span className="nil-guide-label">Expected PPA</span>
            <span className="nil-guide-value">{fmtAmount(eq.expected)}</span>
            <span className="nil-guide-note">Typical for {player.position}s with his rating</span>
          </div>
          <div>
            <span className="nil-guide-label">Actual PPA</span>
            <span className="nil-guide-value">{fmtAmount(eq.actual)}</span>
            <span className="nil-guide-note">His {player.season} season</span>
          </div>
          <div className="is-result">
            <span className="nil-guide-label">Beat expectations by</span>
            <span className="nil-guide-value">{fmtTenths(eq.difference)}<span className="nil-unit">PPA</span></span>
            <span className="nil-guide-note">
              {fmtAmount(eq.actual)} actual − {fmtAmount(eq.expected)} expected
            </span>
          </div>
        </div>

        <p className="nil-guide-plain">
          <strong>In plain English:</strong> {player.position}s rated like him usually add about{" "}
          {fmtRaw(player.expected)} points. He added {fmtRaw(player.production)}, beating his rating
          by {fmtRaw(player.over_expected)}.
        </p>

        <p className="nil-guide-team">
          <strong>On his school's page:</strong> averaged over {team.name}'s {team.n_measured} scored
          transfers, that's {fmtPoints(team.mean)} per player, {ordinal(team.rank)} of{" "}
          {team.n_ranked}.
        </p>
        <ExampleRange team={team} />
      </div>

      {example.line && <ExpectedExplainer line={example.line} player={player} />}
    </details>
  );
}
