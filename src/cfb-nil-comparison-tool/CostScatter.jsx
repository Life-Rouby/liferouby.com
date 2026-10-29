import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtIndex, fmtPoints, fmtRating, teamSlug } from "./useNilData";

const HEIGHT = 440;
const MARGIN = { top: 16, right: 20, bottom: 44, left: 52 };
const LABELLED = 3; // label the top and bottom N teams by production over expected

function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

// Domain padded to the nearest 5 units around the data.
function extent(values) {
  return [Math.floor((Math.min(...values) - 1) / 5) * 5, Math.ceil((Math.max(...values) + 1) / 5) * 5];
}

// Roughly one tick per `spacing` px, on a round step.
function tickValues([lo, hi], pixels, spacing = 60) {
  const step = [5, 10, 20, 25, 50, 100, 200].find((s) => ((hi - lo) / s) * spacing <= pixels) ?? 500;
  const out = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(t);
  return out;
}

export default function CostScatter({ rows, averages, season }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const navigate = useNavigate();
  const [hover, setHover] = useState(null);

  const points = useMemo(
    // Per player: price in pts (what their ratings predict) across, production up.
    () => rows.map(({ team, stats }) => ({ team, stats, x: stats.prod_expected_mean, y: stats.prod_value_mean })),
    [rows],
  );

  const labelled = useMemo(() => {
    const sorted = [...points].sort((a, b) => b.stats.prod_over_expected_mean - a.stats.prod_over_expected_mean);
    return new Set([...sorted.slice(0, LABELLED), ...sorted.slice(-LABELLED)].map((p) => p.team.team));
  }, [points]);

  if (!points.length) {
    return <p className="nil-empty">No teams meet the minimum sample for this filter.</p>;
  }

  const xDomain = extent([...points.map((p) => p.x), 0]);
  const yDomain = extent([...points.map((p) => p.y), 0]);
  // "Got what they paid for": actual = expected, drawn where both axes overlap.
  const diag = [Math.max(xDomain[0], yDomain[0]), Math.min(xDomain[1], yDomain[1])];
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const sx = (v) => MARGIN.left + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotW;
  const sy = (v) => MARGIN.top + (1 - (v - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotH;
  const query = season === "all" ? "" : `?season=${season}`;
  const open = (p) => navigate(`/cfb-nil-comparison-tool/team/${teamSlug(p.team.team)}${query}`);

  // Place direct labels right of the dot, else left; skip any that would still
  // collide with an earlier label or another dot (the tooltip always carries the name).
  const dotBoxes = points.map((q) => [sx(q.x) - 6, sy(q.y) - 6, sx(q.x) + 6, sy(q.y) + 6]);
  const placed = [...dotBoxes];
  const labelPos = {};
  for (const p of points.filter((q) => labelled.has(q.team.team))) {
    const w = p.team.team.length * 6.4;
    const cx = sx(p.x);
    const cy = sy(p.y);
    const options = [
      { x: cx + 9, anchor: "start", box: [cx + 9, cy - 8, cx + 9 + w, cy + 6] },
      { x: cx - 9, anchor: "end", box: [cx - 9 - w, cy - 8, cx - 9, cy + 6] },
    ];
    const fits = options.find(({ box }) =>
      box[0] >= MARGIN.left && box[2] <= MARGIN.left + plotW
      && !placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]));
    if (fits) {
      placed.push(fits.box);
      labelPos[p.team.team] = { x: fits.x, y: cy + 4, anchor: fits.anchor };
    }
  }

  return (
    <div className="nil-scatter" ref={wrapRef}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img"
          aria-label="Scatter plot of expected production per player (price) against actual production per player, one dot per school, with the line where they are equal">
          {/* grid + axes */}
          {tickValues(xDomain, plotW).map((t) => (
            <g key={`x${t}`}>
              <line className="nil-grid" x1={sx(t)} x2={sx(t)} y1={MARGIN.top} y2={MARGIN.top + plotH} />
              <text className="nil-tick" x={sx(t)} y={MARGIN.top + plotH + 18} textAnchor="middle">
                {fmtIndex(t)}
              </text>
            </g>
          ))}
          {tickValues(yDomain, plotH).map((t) => (
            <g key={`y${t}`}>
              <line className="nil-grid" x1={MARGIN.left} x2={MARGIN.left + plotW} y1={sy(t)} y2={sy(t)} />
              <text className="nil-tick" x={MARGIN.left - 8} y={sy(t) + 4} textAnchor="end">
                {fmtIndex(t)}
              </text>
            </g>
          ))}
          <text className="nil-axis-title" x={MARGIN.left + plotW / 2} y={HEIGHT - 6} textAnchor="middle">
            Expected per player: what their ratings paid for (pts) →
          </text>
          <text className="nil-axis-title" transform={`translate(14 ${MARGIN.top + plotH / 2}) rotate(-90)`}
            textAnchor="middle">
            Actual per player (pts) →
          </text>

          {/* actual = expected: above the line beat their price, below fell short */}
          <line className="nil-diag" x1={sx(diag[0])} y1={sy(diag[0])} x2={sx(diag[1])} y2={sy(diag[1])} />
          <text className="nil-diag-label" x={sx(diag[1]) - 6} y={sy(diag[1]) + 16} textAnchor="end">
            got what they paid for
          </text>
          <text className="nil-quadrant" x={MARGIN.left + 8} y={MARGIN.top + 14}>Beat their price</text>
          <text className="nil-quadrant" x={MARGIN.left + plotW - 8} y={MARGIN.top + plotH - 8} textAnchor="end">
            Fell short of their price
          </text>

          {/* points */}
          {points.map((p) => {
            const active = hover?.team.team === p.team.team;
            return (
              <g key={p.team.team}>
                <circle className={active ? "nil-dot is-active" : "nil-dot"} cx={sx(p.x)} cy={sy(p.y)}
                  r={active ? 6.5 : 5} />
                <circle
                  className="nil-hit"
                  cx={sx(p.x)} cy={sy(p.y)} r={12}
                  tabIndex={0}
                  role="link"
                  aria-label={`${p.team.team}: expected ${fmtPoints(p.x)}, actual ${fmtPoints(p.y)}, ${fmtPoints(p.stats.prod_over_expected_mean)} above price per player`}
                  onPointerEnter={() => setHover(p)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(p)}
                  onBlur={() => setHover(null)}
                  onClick={() => open(p)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(p)}
                />
              </g>
            );
          })}

          {/* labels last, so no dot paints over them */}
          {points.map((p) => labelPos[p.team.team] && hover?.team.team !== p.team.team && (
            <text key={`l${p.team.team}`} className="nil-dot-label" x={labelPos[p.team.team].x}
              y={labelPos[p.team.team].y} textAnchor={labelPos[p.team.team].anchor}>
              {p.team.team}
            </text>
          ))}
        </svg>
      )}

      {hover && (
        <div
          className="nil-tooltip"
          style={{
            left: Math.min(sx(hover.x) + 14, width - 220),
            top: Math.max(0, sy(hover.y) - 70),
          }}
        >
          <strong>{hover.team.team}</strong>
          <dl>
            <div><dt>Expected</dt><dd>{fmtPoints(hover.x)}</dd></div>
            <div><dt>Actual</dt><dd>{fmtPoints(hover.y)}</dd></div>
            <div><dt>Above price</dt><dd>{fmtPoints(hover.stats.prod_over_expected_mean)}</dd></div>
            <div><dt>Avg portal rating</dt><dd>{fmtRating(hover.stats.rating_measured_mean)}</dd></div>
            <div><dt>Scored transfers</dt><dd>{hover.stats.n_measured}</dd></div>
          </dl>
          <span className="nil-tooltip-hint">Click to see this school's players</span>
        </div>
      )}
    </div>
  );
}
