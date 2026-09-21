export default function Predictions({ participants, predictions }) {
  const people = participants.participants;

  return (
    <section className="cfb-section" aria-labelledby="predictions-heading">
      <h2 id="predictions-heading" className="cfb-section-title">
        Predictions
      </h2>
      <div className="cfb-table-wrap">
        <table className="cfb-table cfb-predictions-table">
          <thead>
            <tr>
              <th scope="col">Category</th>
              {people.map((p) => (
                <th scope="col" key={p.id}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {predictions.categories.map((cat) => {
              const actual = predictions.actual[cat];
              return (
                <tr key={cat}>
                  <th scope="row">{cat}</th>
                  {people.map((p) => {
                    const pick = predictions.participants[p.id]?.picks?.[cat];
                    const isCorrect = actual != null && pick === actual;
                    return (
                      <td key={p.id} className={isCorrect ? "is-correct" : undefined}>
                        {pick ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="cfb-predictions-total">
              <th scope="row">Points</th>
              {people.map((p) => (
                <td key={p.id} className="cfb-num">
                  {predictions.participants[p.id]?.points ?? 0}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}