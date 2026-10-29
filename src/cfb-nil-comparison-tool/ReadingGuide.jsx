import { equation, fmtIndex, fmtPoints, fmtRating, fmtRaw, fmtStars, fmtTenths } from "./useNilData";

const STEPS = [
  {
    title: "Portal rating",
    text: "The recruiting-site rating each transfer gets (★★★ .800–.899 is typical; ★★★★ .900+ "
      + "is top tier). Higher = pricier.",
  },
  {
    title: "How well he played",
    text: "His first season at the new school in points added (PPA), against every FBS player at "
      + "his position: 0 = average, + better, − worse. Only QBs, RBs, WRs and TEs have PPA. "
      + "Didn't play ≈ −5 to −8.",
  },
  {
    title: "Expected vs. actual",
    text: "Expected = how players with his rating usually play (chart below). Actual − expected "
      + "= how much he beat (+) or missed (−) it.",
  },
  {
    title: "School score",
    text: "That difference, averaged over a school's scored transfers: its value above price "
      + "per player.",
  },
];

const GLOSSARY = [
  ["Hit rate", "Share of players who got into a game."],
  ["Quality", "Average score of those who played."],
  ["Better or worse than before", "Change from his old school to his new one."],
  ["– (dash)", "No score: didn't play, or a position without PPA."],
  ["est.", "No published rating; we estimated one."],
  ["no prior stats", "Didn't play the year before transferring."],
  ["The gray line", "Likely range around the dot. Shorter = more certain."],
];

const ordinal = (n) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
};

// A key to the 0-centered scale, from well below to well above average.
const SCALE_KEY = [
  [-20, "well below average"],
  [-10, "below average"],
  [0, "average"],
  [10, "above average"],
  [20, "well above average"],
];

function ScaleKey() {
  return (
    <div className="nil-guide-scale" aria-label="How to read the scores">
      <span className="nil-guide-label">Scores (pts)</span>
      <ul>
        {SCALE_KEY.map(([v, label]) => (
          <li key={v}>
            <span className={`nil-scale-chip ${v > 0 ? "is-pos" : v < 0 ? "is-neg" : ""}`}>{fmtIndex(v)}</span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// What the points mean in real stats, per position: the season production at 0 pts
// and what each +10 pts adds.
const GROUP_NAMES = {
  QB: "Quarterback", RB: "Running back", WR: "Wide receiver", TE: "Tight end",
};

function UnitsTable({ units }) {
  return (
    <div className="nil-guide-units">
      <h3>What a point means</h3>
      <p>10 pts is about the gap between an average and a clearly productive player. Over a season:</p>
      <div className="nil-table-wrap">
        <table className="nil-table">
          <thead>
            <tr><th>Position</th><th className="nil-td-num">0 pts (average)</th><th className="nil-td-num">Each +10 pts</th></tr>
          </thead>
          <tbody>
            {Object.entries(units).map(([g, u]) => (
              <tr key={g}>
                <td>{GROUP_NAMES[g] ?? g}</td>
                <td className="nil-td-num">{fmtRaw(u.zero)} {u.unit}</td>
                <td className="nil-td-num">+{fmtRaw(u.per10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nil-table-note">
        Points added = PPA, the college version of EPA: points a player added to his offense,
        play by play.
      </p>
    </div>
  );
}

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
const CHART = { w: 560, h: 320, left: 44, right: 16, top: 16, bottom: 40 };

function ExpectedChart({ line, player }) {
  const xs = [-40, 30];
  const ys = [-20, 30];
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
      aria-label={`Every ${line.position} transfer's portal rating (vs. that year's average) against how well he played, with the trend line. ${player.name}'s rating of ${fmtIndex(player.cost)} lands on the line at an expected score of ${fmtIndex(player.expected)}; he actually scored ${fmtIndex(player.production)}.`}
    >
      {[-30, -20, -10, 0, 10, 20, 30].map((t) => (
        <g key={`x${t}`}>
          <line className="nil-grid" x1={sx(t)} x2={sx(t)} y1={CHART.top} y2={CHART.top + plotH} />
          <text className="nil-tick" x={sx(t)} y={CHART.top + plotH + 16} textAnchor="middle">{fmtIndex(t)}</text>
        </g>
      ))}
      {[-20, -10, 0, 10, 20, 30].map((t) => (
        <g key={`y${t}`}>
          <line className="nil-grid" x1={CHART.left} x2={CHART.left + plotW} y1={sy(t)} y2={sy(t)} />
          <text className="nil-tick" x={CHART.left - 8} y={sy(t) + 4} textAnchor="end">{fmtIndex(t)}</text>
        </g>
      ))}
      <text className="nil-axis-title" x={CHART.left + plotW / 2} y={CHART.h - 4} textAnchor="middle">
        Portal rating vs. that year's average (0 = average) →
      </text>
      <text className="nil-axis-title" transform={`translate(12 ${CHART.top + plotH / 2}) rotate(-90)`} textAnchor="middle">
        How well he played →
      </text>

      {line.points.map(([c, v], i) => (
        c >= xs[0] && <circle key={i} className="nil-expected-dot" cx={sx(c)} cy={sy(clampY(v))} r={2.6} />
      ))}

      <line className="nil-expected-fit" x1={sx(xs[0])} y1={sy(fit(xs[0]))} x2={sx(xs[1])} y2={sy(fit(xs[1]))} />
      <text className="nil-expected-fit-label" x={sx(-26)} y={sy(fit(-26)) + 18}>trend line</text>

      {/* the gap between expected and actual */}
      <line className="nil-expected-gap" x1={px} x2={px} y1={expY} y2={actY} />
      <text className="nil-expected-gap-label" x={px + 8} y={(expY + actY) / 2 + 4}>
        {fmtPoints(player.over_expected)}
      </text>

      <circle className="nil-expected-on-line" cx={px} cy={expY} r={5.5} />
      <text className="nil-expected-label" x={px - 9} y={expY + (gapAbove ? 16 : -10)} textAnchor="end">
        Expected {fmtIndex(player.expected)}
      </text>
      <circle className="nil-expected-player" cx={px} cy={actY} r={6.5} />
      <text className="nil-expected-label is-strong" x={px - 10} y={actY + (gapAbove ? -2 : 16)} textAnchor="end">
        {player.name}: {fmtIndex(player.production)}
      </text>
    </svg>
  );
}

// Step-by-step: how one player's expected score comes off the line. The worked
// numbers are rounded first and then multiplied, so the arithmetic shown checks out.
function ExpectedExplainer({ line, player }) {
  const a = Number(line.intercept.toFixed(1));
  const b = Number(line.slope.toFixed(3));
  const x = Math.round(player.cost);
  const result = a + b * x;
  // "−0.2 + 0.344 × portal rating", with the starting number's own sign
  const start = a < 0 ? `−${Math.abs(a)}` : `${a}`;
  const xText = x < 0 ? `(${fmtIndex(x)})` : fmtIndex(x);
  const per10 = (b * 10).toFixed(1);
  return (
    <div className="nil-guide-expected">
      <div className="nil-guide-expected-text">
        <h3>How expected is calculated</h3>
        <ol>
          <li>
            <strong>Compare his rating with that year's transfers.</strong> {player.name}'s{" "}
            {fmtRating(player.rating)} vs. the {player.season} average ({fmtRating(player.season_rating_mean)})
            = {fmtIndex(player.cost)}.
          </li>
          <li>
            <strong>Plot every {line.position} transfer</strong> ({line.n.toLocaleString()}): rating
            across, production up. Non-players count at about −5 to −8.
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
              {start} + {b} × {xText} = {fmtPoints(result)}, about {fmtIndex(result)}
            </span>
          </li>
        </ol>
        <p>
          <strong>Why not {fmtIndex(x)}?</strong> Ratings are a rough guess, so the line is flat:
          +10 rating adds only about {per10} expected. Each position has its own line.
        </p>
      </div>
      <ExpectedChart line={line} player={player} />
    </div>
  );
}

export default function ReadingGuide({ example, scale, units }) {
  const { player, team } = example;
  const costSd = (player.cost - scale.mean) / scale.sd;
  const ratingNote = costSd >= 1.5
    ? `one of the top-rated transfers of ${player.season}`
    : `${costSd >= 0 ? "an above" : "a below"}-average transfer for ${player.season}`;

  return (
    <details className="card nil-guide" open>
      <summary>New here? Start with this quick guide</summary>

      <ol className="nil-guide-steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="nil-guide-num">{i + 1}</span>
            <strong>{s.title}</strong>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>

      <ScaleKey />

      {units && <UnitsTable units={units} />}

      {example.line && <ExpectedExplainer line={example.line} player={player} />}

      <div className="nil-guide-example">
        <p className="eyebrow">Example</p>
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
            <span className="nil-guide-label">Expected score</span>
            <span className="nil-guide-value">{fmtIndex(player.expected)}</span>
            <span className="nil-guide-note">Typical for {player.position}s with his rating</span>
          </div>
          <div>
            <span className="nil-guide-label">Actual score</span>
            <span className="nil-guide-value">
              {fmtIndex(player.production)}
            </span>
            <span className="nil-guide-note">His {player.season} season</span>
          </div>
          <div className="is-result">
            <span className="nil-guide-label">Beat expectations by</span>
            <span className="nil-guide-value">{fmtPoints(player.over_expected)}<span className="nil-unit">pts</span></span>
            <span className="nil-guide-note">
              {fmtTenths(equation(player.expected, player.over_expected).actual)} actual −{" "}
              {fmtTenths(equation(player.expected, player.over_expected).expected)} expected
            </span>
          </div>
        </div>

        {player.actual_raw != null && (
          <p className="nil-guide-plain">
            <strong>In plain English:</strong> {player.position}s rated like him usually add about{" "}
            {fmtRaw(player.expected_raw)} points. He added {fmtRaw(player.actual_raw)},
            beating his rating by {fmtPoints(player.over_expected).replace("+", "")} pts.
          </p>
        )}

        <p className="nil-guide-team">
          <strong>For the school:</strong> averaged over {team.name}'s {team.n_measured} scored
          transfers, that's {fmtPoints(team.mean)} per player, {ordinal(team.rank)} of{" "}
          {team.n_ranked}.
        </p>
        <ExampleRange team={team} />
      </div>

      <dl className="nil-guide-glossary">
        {GLOSSARY.map(([term, def]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{def}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
