import { Fragment, useState } from "react";

const STATUS_LABEL = {
  boosted: "Boosted",
  sabotaged: "Sabotaged",
  dropped: "Dropped",
  bye: "Bye",
  scheduled: "Not played",
};

function statusLabel(status, won) {
  if (status === "normal") return won === false ? "Loss" : "Win";
  return STATUS_LABEL[status];
}

function barSegments(status, won) {
  const outcome = won === false ? "loss" : won === true ? "win" : "neutral";
  if (status === "normal") return [outcome];
  if (status === "boosted") return [outcome, "boost"];
  if (status === "sabotaged" || status === "dropped") return ["sabotaged"];
  if (status === "bye") return ["bye"];
  return ["neutral"];
}

export default function Standings({ participants, picks, week }) {
  const [expanded, setExpanded] = useState(null);

  const weekIndex = picks.weeks.indexOf(week);
  const weeksSoFar = picks.weeks.slice(0, weekIndex + 1);

  const rows = participants.participants
    .map((p) => {
      const entry = picks.participants[p.id];
      const total = weeksSoFar.reduce((sum, w) => sum + (entry?.weeklyTotal?.[w] ?? 0), 0);
      return {
        id: p.id,
        name: p.name,
        weekPoints: entry?.weeklyTotal?.[week] ?? 0,
        total,
        teams: entry?.teams ?? [],
      };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <section className="cfb-section" aria-labelledby="standings-heading">
      <h2 id="standings-heading" className="cfb-section-title">
        Standings
      </h2>
      <div className="cfb-table-wrap">
        <table className="cfb-table">
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Name</th>
              <th scope="col">{week}</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isOpen = expanded === r.id;
              return (
                <Fragment key={r.id}>
                  <tr
                    className="cfb-row-clickable"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    aria-expanded={isOpen}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpanded(isOpen ? null : r.id);
                      }
                    }}
                  >
                    <td className="cfb-num">{i + 1}</td>
                    <td>{r.name}</td>
                    <td className="cfb-num">{r.weekPoints}</td>
                    <td className="cfb-num cfb-total">{r.total}</td>
                  </tr>
                  {isOpen && (
                    <tr className="cfb-roster-row">
                      <td colSpan={4}>
                        <ul className="cfb-roster">
                          {r.teams.map((t) => {
                            const wk = t.weeks[week];
                            const status = wk?.status ?? "scheduled";
                            return (
                              <li key={t.team} className={`cfb-roster-item status-${status}`}>
                                <span className="cfb-roster-bar" aria-hidden="true">
                                  {barSegments(status, wk?.won).map((seg, i) => (
                                    <span key={i} className={`cfb-roster-bar-seg cfb-bar-${seg}`} />
                                  ))}
                                </span>
                                <div className="cfb-roster-content">
                                  <span className="cfb-roster-team">{t.team}</span>
                                  <span className="cfb-roster-opp">{wk?.opponent ?? "Bye"}</span>
                                  <span className="cfb-roster-status">{statusLabel(status, wk?.won)}</span>
                                  <span className="cfb-num cfb-roster-points">
                                    {wk?.points ?? "—"}
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
