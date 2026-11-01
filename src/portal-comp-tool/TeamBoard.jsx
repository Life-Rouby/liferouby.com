import { Link } from "react-router-dom";
import TeamLogo from "./TeamLogo";
import { SortHeader, useSorted } from "./Sorting";
import { equation, fmtAmount, fmtRating, fmtSubtracted, fmtTenths, rankColor, teamSlug } from "./useNilData";

// Sortable columns: what each sorts by, and its first-click direction.
const SORTS = {
  school: { value: (r) => r.name, dir: 1 },
  players: { value: (r) => r.n, dir: -1 },
  rating: { value: (r) => r.rating, dir: -1 },
  actual: { value: (r) => r.actual, dir: -1 },
  expected: { value: (r) => r.expected, dir: -1 },
  difference: { value: (r) => r.difference, dir: -1 },
};

// Schools ranked by their transfers' average actual − expected, per player.
// `rows` arrive sorted best first; each is { name, team, n, nPlayed, rating,
// actual, expected, difference } over the players in the current filters.
export default function TeamBoard({ rows, season }) {
  const { sorted, sort, onSort } = useSorted(rows, SORTS);
  if (!rows.length) {
    return <p className="nil-empty">No scored transfers for this filter.</p>;
  }
  const header = { sort, onSort };

  return (
    <div className="nil-table-wrap">
      <table className="nil-table nil-player-table">
        <thead>
          <tr>
            <SortHeader id="rank" {...header} title="Rank by Difference">#</SortHeader>
            <SortHeader id="school" {...header} className="nil-td-left">School</SortHeader>
            <SortHeader id="players" {...header} className="nil-td-center" title="Scored transfers in these filters">Players</SortHeader>
            <SortHeader id="rating" {...header} className="nil-td-center nil-hide-sm" title="Average published portal rating (higher = pricier)">Avg rating</SortHeader>
            <SortHeader id="actual" {...header} className="nil-tight" title="Average PPA its transfers produced">Actual</SortHeader>
            <th className="nil-eq-op nil-tight" aria-hidden="true">−</th>
            <SortHeader id="expected" {...header} className="nil-tight" title="Average PPA players with those ratings usually produce">Expected</SortHeader>
            <th className="nil-eq-op nil-tight" aria-hidden="true">=</th>
            <SortHeader id="difference" {...header} className="nil-td-left" title="Return on investment per player, in PPA">Difference</SortHeader>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const eq = equation(r.expected, r.difference);
            return (
              <tr key={r.name}>
                <td className="nil-td-muted">{r.rank}</td>
                <td className="nil-td-name nil-td-left">
                  {r.team ? (
                    <Link className="nil-team-link" to={`/portal-comp-tool/team/${teamSlug(r.name)}?season=${season}`}>
                      <TeamLogo team={r.team} size={24} />
                      {r.name}
                    </Link>
                  ) : r.name}
                </td>
                <td className="nil-td-center">
                  {r.n}
                  {r.nPlayed < r.n && <span className="nil-dnp">{r.n - r.nPlayed} didn't play</span>}
                </td>
                <td className="nil-td-center nil-hide-sm">{fmtRating(r.rating)}</td>
                <td className="nil-eq-term nil-tight">{fmtAmount(eq.actual)}</td>
                <td className="nil-eq-op nil-tight" aria-hidden="true">−</td>
                <td className="nil-eq-term nil-eq-term--muted nil-tight">{fmtSubtracted(eq.expected)}</td>
                <td className="nil-eq-op nil-tight" aria-hidden="true">=</td>
                <td className="nil-td-left">
                  <span className="nil-eq-pill" style={rankColor(r.rank - 1, rows.length)}>{fmtTenths(eq.difference)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
