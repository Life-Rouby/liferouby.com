import { useLayoutEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtIndex } from "./useNilData";

const HEIGHT = 480;
const MARGIN = { top: 16, right: 20, bottom: 44, left: 52 };
const LABELLED = 3; // name the top and bottom N dots by actual − expected
const HOVER_RADIUS = 18; // px: how close the pointer must be to pick a dot
const LOGO = 22; // px: size of a logo drawn in place of a dot

// Width of the element given to the returned callback ref. A callback ref (not
// useRef) so it re-measures when the chart comes back after an empty filter.
function useWidth() {
  const [el, setEl] = useState(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!el) return undefined;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [setEl, width];
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

// One dot per player or school: expected PPA (the price) across, actual PPA up.
// `points` arrive sorted best first; each is { id, label, x, y, fill, href, tip, logo? },
// where `tip` is the tooltip body and `href` where a click goes. With `highlight`
// (a point id), only that point is named and it's drawn larger, on top.
export default function ValueScatter({ points, noun, emptyText, highlight }) {
  const [wrapRef, width] = useWidth();
  const navigate = useNavigate();
  const [hover, setHover] = useState(null);

  const labelled = useMemo(
    () => new Set(highlight != null ? [highlight]
      : [...points.slice(0, LABELLED), ...points.slice(-LABELLED)].map((p) => p.id)),
    [points, highlight],
  );

  if (!points.length) {
    return <p className="nil-empty">{emptyText}</p>;
  }
  const xDomain = extent([...points.map((p) => p.x), 0]);
  const yDomain = extent([...points.map((p) => p.y), 0]);
  // "Got what he paid for": actual = expected, drawn where both axes overlap.
  const diag = [Math.max(xDomain[0], yDomain[0]), Math.min(xDomain[1], yDomain[1])];
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const sx = (v) => MARGIN.left + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotW;
  const sy = (v) => MARGIN.top + (1 - (v - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotH;
  const open = (p) => p.href && navigate(p.href);

  // Hover the dot nearest the pointer, if one is close enough.
  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - box.left;
    const my = e.clientY - box.top;
    let best = null;
    let bestD = HOVER_RADIUS ** 2;
    for (const p of points) {
      const d = (sx(p.x) - mx) ** 2 + (sy(p.y) - my) ** 2;
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    setHover(best);
  };

  // Place direct labels right of the dot, else left; skip any that would still
  // collide with an earlier label (the tooltip always carries the name).
  const placed = [];
  const labelPos = {};
  for (const p of points.filter((q) => labelled.has(q.id))) {
    const w = p.label.length * 6.4;
    const gap = p.logo ? LOGO / 2 + 4 : 8; // clear the logo or dot
    const cx = sx(p.x);
    const cy = sy(p.y);
    const options = [
      { x: cx + gap, anchor: "start", box: [cx + gap, cy - 8, cx + gap + w, cy + 6] },
      { x: cx - gap, anchor: "end", box: [cx - gap - w, cy - 8, cx - gap, cy + 6] },
    ];
    const fits = options.find(({ box }) =>
      box[0] >= MARGIN.left && box[2] <= MARGIN.left + plotW
      && !placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]));
    if (fits) {
      placed.push(fits.box);
      labelPos[p.id] = { x: fits.x, y: cy + 4, anchor: fits.anchor };
    }
  }

  return (
    <div className="nil-scatter" ref={wrapRef}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img"
          className={hover ? "is-hovering" : undefined}
          aria-label={`Scatter plot of each ${noun}'s expected PPA (the price) against actual PPA, with the line where they are equal`}
          onPointerMove={pick}
          onPointerLeave={() => setHover(null)}
          onClick={() => hover && open(hover)}>
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
            Expected: what the rating paid for (PPA) →
          </text>
          <text className="nil-axis-title" transform={`translate(14 ${MARGIN.top + plotH / 2}) rotate(-90)`}
            textAnchor="middle">
            Actual: what was produced (PPA) →
          </text>

          {/* actual = expected: above the line beat his price, below fell short */}
          <line className="nil-diag" x1={sx(diag[0])} y1={sy(diag[0])} x2={sx(diag[1])} y2={sy(diag[1])} />
          <text className="nil-diag-label" x={sx(diag[1]) - 6} y={sy(diag[1]) + 16} textAnchor="end">
            got what they paid for
          </text>
          <text className="nil-quadrant" x={MARGIN.left + 8} y={MARGIN.top + 14}>Positive return on investment</text>
          <text className="nil-quadrant" x={MARGIN.left + plotW - 8} y={MARGIN.top + plotH - 8} textAnchor="end">
            Negative return on investment
          </text>

          {/* points */}
          {points.map((p) => (p.logo ? (
            <image key={p.id} className="nil-dot-logo" href={p.logo} x={sx(p.x) - LOGO / 2} y={sy(p.y) - LOGO / 2}
              width={LOGO} height={LOGO} />
          ) : (
            <circle key={p.id} className="nil-dot nil-dot--player" cx={sx(p.x)} cy={sy(p.y)} r={4}
              style={{ fill: p.fill }} />
          )))}
          {points.filter((p) => p.id === highlight).map((p) => (
            <circle key="highlight" className="nil-dot is-active" cx={sx(p.x)} cy={sy(p.y)} r={7}
              style={{ fill: p.fill }} />
          ))}
          {hover && (hover.logo ? (
            <g>
              <circle className="nil-dot-logo-ring" cx={sx(hover.x)} cy={sy(hover.y)} r={LOGO * 0.8} />
              <image href={hover.logo} x={sx(hover.x) - LOGO * 0.65} y={sy(hover.y) - LOGO * 0.65}
                width={LOGO * 1.3} height={LOGO * 1.3} />
            </g>
          ) : (
            <circle className="nil-dot is-active" cx={sx(hover.x)} cy={sy(hover.y)} r={6.5}
              style={{ fill: hover.fill }} />
          ))}

          {/* labels last, so no dot paints over them */}
          {points.map((p) => labelPos[p.id] && hover?.id !== p.id && (
            <text key={`l${p.id}`} className="nil-dot-label" x={labelPos[p.id].x}
              y={labelPos[p.id].y} textAnchor={labelPos[p.id].anchor}>
              {p.label}
            </text>
          ))}
        </svg>
      )}

      {hover && (
        <div
          className="nil-tooltip"
          style={{
            left: Math.min(sx(hover.x) + 14, width - 230),
            top: Math.max(0, sy(hover.y) - 80),
          }}
        >
          {hover.tip}
        </div>
      )}
    </div>
  );
}
