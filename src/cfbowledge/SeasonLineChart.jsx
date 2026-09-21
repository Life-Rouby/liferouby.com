import { useMemo, useRef, useState } from "react";

// Fixed categorical order — color follows the participant, never their rank,
// so a line keeps its color even as standings shift week to week.
const SERIES_COLORS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

const WIDTH = 900;
const HEIGHT = 440;
const MARGIN = { top: 24, right: 132, bottom: 36, left: 44 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const MIN_LABEL_GAP = 15;

function niceMax(value) {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const steps = [1, 2, 2.5, 5, 10];
  for (const step of steps) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

export default function SeasonLineChart({ participants, picks }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  const { weeks, series, yMax } = useMemo(() => {
    const allWeeks = picks.weeks;

    const lastPlayed = allWeeks.reduce((last, w, i) => {
      const anyScore = participants.participants.some((p) => {
        const entry = picks.participants[p.id];
        return (entry?.weeklyTotal?.[w] ?? 0) !== 0;
      });
      return anyScore ? i : last;
    }, 0);

    const trimmedWeeks = allWeeks.slice(0, lastPlayed + 1);

    const series = participants.participants.map((p, i) => {
      const entry = picks.participants[p.id];
      let running = 0;
      const cumulative = trimmedWeeks.map((w) => {
        running += entry?.weeklyTotal?.[w] ?? 0;
        return running;
      });
      return {
        id: p.id,
        name: p.name,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        cumulative,
        final: cumulative[cumulative.length - 1] ?? 0,
      };
    });

    const rawMax = Math.max(1, ...series.map((s) => Math.max(...s.cumulative, 0)));
    const yMax = niceMax(rawMax * 1.05);

    return { weeks: trimmedWeeks, series, yMax };
  }, [participants, picks]);

  if (weeks.length < 2) {
    return (
      <section className="cfb-section" aria-labelledby="chart-heading">
        <h2 id="chart-heading" className="cfb-section-title">
          Season So Far
        </h2>
        <p className="cfb-empty">Not enough weeks played yet to chart a trend.</p>
      </section>
    );
  }

  const xForIndex = (i) => MARGIN.left + (i / (weeks.length - 1)) * PLOT_W;
  const yForValue = (v) => MARGIN.top + PLOT_H - (v / yMax) * PLOT_H;

  // Space out end labels vertically so overlapping finishers stay legible.
  const labelPositions = useMemo(() => {
    const items = series
      .map((s) => ({ id: s.id, y: yForValue(s.final) }))
      .sort((a, b) => a.y - b.y);

    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const cur = items[i];
      if (cur.y - prev.y < MIN_LABEL_GAP) {
        cur.y = prev.y + MIN_LABEL_GAP;
      }
    }
    // If pushing down ran past the bottom, pull the whole stack back up.
    const overflow = items[items.length - 1].y - (MARGIN.top + PLOT_H);
    if (overflow > 0) {
      items.forEach((it) => (it.y -= overflow));
    }

    const map = {};
    items.forEach((it) => (map[it.id] = it.y));
    return map;
  }, [series]);

  const yTicks = 5;
  const gridValues = Array.from({ length: yTicks + 1 }, (_, i) => (yMax / yTicks) * i);

  const handleMove = (evt) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const px = (evt.clientX - rect.left) * scaleX;
    const relative = (px - MARGIN.left) / PLOT_W;
    const idx = Math.round(relative * (weeks.length - 1));
    setHoverIndex(Math.min(weeks.length - 1, Math.max(0, idx)));
  };

  const hovered = hoverIndex != null;
  const hoverX = hovered ? xForIndex(hoverIndex) : 0;
  const tooltipRows = hovered
    ? [...series].sort((a, b) => b.cumulative[hoverIndex] - a.cumulative[hoverIndex])
    : [];
  const tooltipOnRight = hovered && hoverX < WIDTH - 210;

  return (
    <section className="cfb-section" aria-labelledby="chart-heading">
      <h2 id="chart-heading" className="cfb-section-title">
        Season So Far
      </h2>
      <div className="cfb-chart-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="cfb-chart-svg"
          role="img"
          aria-label="Line chart of cumulative points per participant by week"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {gridValues.map((v) => (
            <g key={v}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + PLOT_W}
                y1={yForValue(v)}
                y2={yForValue(v)}
                className="cfb-chart-grid"
              />
              <text x={MARGIN.left - 10} y={yForValue(v)} className="cfb-chart-axis-label" textAnchor="end" dominantBaseline="middle">
                {Math.round(v)}
              </text>
            </g>
          ))}

          {weeks.map((w, i) => (
            <text
              key={w}
              x={xForIndex(i)}
              y={MARGIN.top + PLOT_H + 22}
              className="cfb-chart-axis-label"
              textAnchor="middle"
            >
              {w.replace("Week ", "Wk ")}
            </text>
          ))}

          {hovered && (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_H}
              className="cfb-chart-crosshair"
            />
          )}

          {series.map((s) => {
            const d = s.cumulative
              .map((v, i) => `${i === 0 ? "M" : "L"}${xForIndex(i)},${yForValue(v)}`)
              .join(" ");
            return (
              <path
                key={s.id}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={hovered ? 2 : 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={hovered ? 0.35 : 1}
              />
            );
          })}

          {hovered &&
            series.map((s) => (
              <circle
                key={s.id}
                cx={hoverX}
                cy={yForValue(s.cumulative[hoverIndex])}
                r={4.5}
                fill={s.color}
                stroke="var(--cfb-bg)"
                strokeWidth={1.5}
              />
            ))}

          {series.map((s) => {
            const endY = yForValue(s.final);
            const labelY = labelPositions[s.id];
            return (
              <g key={s.id}>
                <circle cx={xForIndex(weeks.length - 1)} cy={endY} r={4} fill={s.color} />
                {Math.abs(labelY - endY) > 1 && (
                  <line
                    x1={xForIndex(weeks.length - 1) + 6}
                    y1={endY}
                    x2={xForIndex(weeks.length - 1) + 14}
                    y2={labelY}
                    className="cfb-chart-leader"
                  />
                )}
                <text
                  x={xForIndex(weeks.length - 1) + (Math.abs(labelY - endY) > 1 ? 18 : 10)}
                  y={labelY}
                  className="cfb-chart-end-label"
                  dominantBaseline="middle"
                >
                  {s.name}
                </text>
              </g>
            );
          })}
        </svg>

        {hovered && (
          <div
            className="cfb-chart-tooltip"
            style={{
              left: `${(hoverX / WIDTH) * 100}%`,
              transform: tooltipOnRight ? "translateX(12px)" : "translateX(calc(-100% - 12px))",
            }}
          >
            <div className="cfb-chart-tooltip-title">{weeks[hoverIndex]}</div>
            {tooltipRows.map((s) => (
              <div className="cfb-chart-tooltip-row" key={s.id}>
                <span className="cfb-chart-tooltip-dot" style={{ background: s.color }} />
                <span className="cfb-chart-tooltip-name">{s.name}</span>
                <span className="cfb-chart-tooltip-value">{s.cumulative[hoverIndex]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
