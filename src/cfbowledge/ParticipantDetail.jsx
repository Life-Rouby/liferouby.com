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

// A "scheduled" week always means unresolved, even though some unplayed future
// weeks carry a pre-filled 0 in `points` from the original spreadsheet import --
// points alone can't tell "not played" from "played and lost", but status can.
// A future bye slot (no real opponent) also reports as "scheduled" rather than
// "bye" (see roster_move.py's add flow), so opponent doubles as the bye check.
function isByeWeek(status, wk) {
  if (status === "bye") return true;
  return status === "scheduled" && (!wk?.opponent || wk.opponent === "-" || wk.opponent === "BYE");
}

function outcomeClass(status, wk) {
  if (isByeWeek(status, wk)) return " outcome-bye";
  if (status === "dropped" || status === "scheduled") return "";
  // Every win formula in scoring.py yields > 0; every loss yields exactly 0 --
  // more reliable than `won`, which is never recorded for older spreadsheet weeks.
  return (wk?.points ?? 0) > 0 ? " outcome-win" : " outcome-loss";
}

function pointsDisplay(status, wk) {
  if (status === "scheduled" && !isByeWeek(status, wk)) return "";
  return wk?.points ?? 0;
}

export default function ParticipantDetail({ participant, picks, onBack }) {
  const weeks = picks.weeks;
  const entry = picks.participants[participant.id];

  if (!entry) {
    return (
      <section className="cfb-section">
        {onBack && (
          <button type="button" className="cfb-back-btn" onClick={onBack}>
            ← Back to Home
          </button>
        )}
        <p className="cfb-empty">No data for {participant.name}.</p>
      </section>
    );
  }

  const teams = [...entry.teams].sort((a, b) => a.slot - b.slot);
  const currentTeams = teams.filter((t) => !t.droppedWeek);
  const droppedTeams = teams.filter((t) => t.droppedWeek);

  function boostClass(t) {
    const boostedWeek = Object.values(t.weeks).find((w) => w.status === "boosted");
    if (!boostedWeek) return "";
    // points stays null until the game is actually played (see fetch_week.py) --
    // a resolved won/lost result isn't always recorded for older, spreadsheet-era
    // weeks, so points (not won) is the reliable "has this happened yet" signal.
    return boostedWeek.points === null ? " is-boosted-upcoming" : " is-boosted-past";
  }

  let running = 0;
  const cumulative = weeks.map((w) => {
    running += entry.weeklyTotal?.[w] ?? 0;
    return running;
  });

  return (
    <>
      {onBack && (
        <button type="button" className="cfb-back-btn" onClick={onBack}>
          ← Back to Home
        </button>
      )}

      <section className="cfb-section" aria-labelledby="participant-heading">
        <h2 id="participant-heading" className="cfb-section-title">
          {participant.name} — Current Teams
        </h2>
        <div className="cfb-team-chip-row">
          {currentTeams.map((t) => (
            <span key={t.team} className={`cfb-team-chip${boostClass(t)}`}>
              {t.team}
            </span>
          ))}
        </div>
      </section>

      <section className="cfb-section" aria-labelledby="participant-weekly-heading">
        <h2 id="participant-weekly-heading" className="cfb-section-title">
          Weekly Results
        </h2>
        <div className="cfb-table-wrap">
          <table className="cfb-table cfb-detail-table">
            <thead>
              <tr>
                <th scope="col" colSpan={2}>
                  Team
                </th>
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
            {teams.map((t) => {
              const total = weeks.reduce((sum, w) => sum + (t.weeks[w]?.points ?? 0), 0);
              return (
                <tbody className="cfb-detail-team" key={t.team}>
                  <tr>
                    <th scope="rowgroup" rowSpan={2} className="cfb-home-name cfb-detail-team-name">
                      {t.team}
                      {t.droppedWeek && (
                        <span className="cfb-detail-dropped-tag">dropped {t.droppedWeek}</span>
                      )}
                    </th>
                    <td className="cfb-detail-label">VS</td>
                    {weeks.map((w) => {
                      const wk = t.weeks[w];
                      const status = wk?.status ?? "scheduled";
                      return (
                        <td
                          key={w}
                          className={`cfb-num cfb-detail-cell status-${status}${outcomeClass(status, wk)}`}
                          title={statusLabel(status, wk?.won)}
                        >
                          {wk?.opponent ?? "-"}
                        </td>
                      );
                    })}
                    <td className="cfb-num cfb-total" rowSpan={2}>
                      {total}
                    </td>
                  </tr>
                  <tr>
                    <td className="cfb-detail-label">Points</td>
                    {weeks.map((w) => {
                      const wk = t.weeks[w];
                      const status = wk?.status ?? "scheduled";
                      return (
                        <td
                          key={w}
                          className={`cfb-num cfb-wk-col cfb-detail-cell status-${status}${outcomeClass(status, wk)}`}
                        >
                          {pointsDisplay(status, wk)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              );
            })}
            <tfoot>
              <tr className="cfb-detail-summary-row">
                <th scope="row" colSpan={2}>
                  Weekly Points
                </th>
                {weeks.map((w) => (
                  <td className="cfb-num cfb-wk-col" key={w}>
                    {entry.weeklyTotal?.[w] ?? 0}
                  </td>
                ))}
                <td className="cfb-num cfb-total">{entry.seasonTotal ?? 0}</td>
              </tr>
              <tr className="cfb-detail-summary-row">
                <th scope="row" colSpan={2}>
                  Current Points
                </th>
                {cumulative.map((c, i) => (
                  <td className="cfb-num cfb-wk-col" key={weeks[i]}>
                    {c}
                  </td>
                ))}
                <td className="cfb-num cfb-total">{entry.seasonTotal ?? 0}</td>
              </tr>
              <tr className="cfb-detail-summary-row">
                <th scope="row" colSpan={2}>
                  Boost Card
                </th>
                {weeks.map((w) => (
                  <td className="cfb-wk-col" key={w}>
                    {entry.boostCard?.[w] ?? "-"}
                  </td>
                ))}
                <td></td>
              </tr>
              <tr className="cfb-detail-summary-row">
                <th scope="row" colSpan={2}>
                  Sabotage Card
                </th>
                {weeks.map((w) => (
                  <td className="cfb-wk-col" key={w}>
                    {entry.sabotageCard?.[w] ?? "-"}
                  </td>
                ))}
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {droppedTeams.length > 0 && (
        <section className="cfb-section" aria-labelledby="participant-dropped-heading">
          <h2 id="participant-dropped-heading" className="cfb-section-title">
            Dropped Teams
          </h2>
          <div className="cfb-team-chip-row">
            {droppedTeams.map((t) => (
              <span key={t.team} className="cfb-team-chip is-dropped">
                {t.team}
                <span className="cfb-detail-dropped-tag">dropped {t.droppedWeek}</span>
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
