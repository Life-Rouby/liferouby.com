export default function Matchups({ participants, matchups, week }) {
  const nameById = Object.fromEntries(participants.participants.map((p) => [p.id, p.name]));
  const games = matchups.weeks[week] ?? [];

  return (
    <section className="cfb-section" aria-labelledby="matchups-heading">
      <h2 id="matchups-heading" className="cfb-section-title">
        Matchups
      </h2>
      {games.length === 0 ? (
        <p className="cfb-empty">No matchups set for {week} yet.</p>
      ) : (
        <div className="cfb-matchup-grid">
          {games.map((g, i) => {
            const p1Wins = g.winner && g.winner === g.participant1;
            const p2Wins = g.winner && g.winner === g.participant2;
            return (
              <article className="cfb-matchup-card" key={i}>
                <div className={`cfb-matchup-side${p1Wins ? " is-winner" : ""}`}>
                  <span className="cfb-matchup-owner">{nameById[g.participant1] ?? g.participant1}</span>
                  <span className="cfb-matchup-team">{g.team1}</span>
                </div>
                <div className="cfb-matchup-at">
                  <span>@</span>
                  {g.spread != null && (
                    <span className="cfb-matchup-spread">
                      {g.spread > 0 ? `+${g.spread}` : g.spread}
                    </span>
                  )}
                </div>
                <div className={`cfb-matchup-side${p2Wins ? " is-winner" : ""}`}>
                  <span className="cfb-matchup-owner">{nameById[g.participant2] ?? g.participant2}</span>
                  <span className="cfb-matchup-team">{g.team2}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}