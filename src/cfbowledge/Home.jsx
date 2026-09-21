const WEEK_COLOR_STOPS = [
  { t: 0, rgb: [224, 176, 168] }, // worst - red
  { t: 0.5, rgb: [221, 199, 157] }, // mid - gold
  { t: 1, rgb: [165, 202, 184] }, // best - green
];

function weekCellColor(t) {
  const [a, b] =
    t <= 0.5
      ? [WEEK_COLOR_STOPS[0], WEEK_COLOR_STOPS[1]]
      : [WEEK_COLOR_STOPS[1], WEEK_COLOR_STOPS[2]];
  const span = b.t - a.t;
  const localT = span === 0 ? 0 : (t - a.t) / span;
  const rgb = a.rgb.map((v, i) => Math.round(v + (b.rgb[i] - v) * localT));
  return `rgb(${rgb.join(", ")})`;
}

export default function Home({ participants, picks, onSelectParticipant }) {
  const weeks = picks.weeks;

  const rows = participants.participants
    .map((p) => {
      const entry = picks.participants[p.id];
      return {
        id: p.id,
        name: p.name,
        weekPoints: weeks.map((w) => entry?.weeklyTotal?.[w] ?? 0),
        total: entry?.seasonTotal ?? 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  const weekStats = weeks.map((_, i) => {
    const vals = rows.map((r) => r.weekPoints[i]);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  });

  return (
    <section className="cfb-section" aria-labelledby="home-heading">
      <h2 id="home-heading" className="cfb-section-title">
        Weekly
      </h2>
      <div className="cfb-table-wrap">
        <table className="cfb-table cfb-home-table">
          <thead>
            <tr>
              <th scope="col">Place</th>
              <th scope="col">Name</th>
              {weeks.map((w) => (
                <th scope="col" className="cfb-num cfb-wk-col" key={w}>
                  {w.replace("Week ", "Wk ")}
                </th>
              ))}
              <th scope="col" className="cfb-num">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="cfb-num">{i + 1}</td>
                <th scope="row" className="cfb-home-name">
                  <button
                    type="button"
                    className="cfb-home-name-btn"
                    onClick={() => onSelectParticipant(r.id)}
                  >
                    {r.name}
                  </button>
                </th>
                {r.weekPoints.map((pts, i) => {
                  const { min, max } = weekStats[i];
                  const played = max > 0;
                  const t = !played ? null : max === min ? 1 : (pts - min) / (max - min);
                  return (
                    <td
                      className={
                        "cfb-num cfb-wk-col" +
                        (played && pts === max ? " cfb-wk-winner" : "")
                      }
                      style={played ? { backgroundColor: weekCellColor(t) } : undefined}
                      key={weeks[i]}
                    >
                      {pts}
                    </td>
                  );
                })}
                <td className="cfb-num cfb-total">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
