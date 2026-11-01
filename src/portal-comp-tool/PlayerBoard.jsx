import { useState } from "react";
import { Link } from "react-router-dom";
import { SortHeader, useSorted } from "./Sorting";
import TeamLogo from "./TeamLogo";
import {
  equation, fmtAmount, fmtRating, fmtStars, fmtSubtracted, fmtTenths, playerHref, rankColor, statLine, teamSlug,
} from "./useNilData";

const PAGE = 50; // rows shown before "Show all"

// His headline yardage at the new school, for sorting the stat-line column.
const mainYards = (t) => {
  if (!t.played_after) return 0;
  const group = t.prod_ref_group_after;
  if (group === "QB") return t.after_passing_YDS ?? 0;
  if (group === "RB") return t.after_rushing_YDS ?? 0;
  return t.after_receiving_YDS ?? 0;
};

// Sortable columns: what each sorts by, and its first-click direction
// (-1 = high to low, 1 = A to Z / low to high).
const SORTS = {
  player: { value: (r) => r.t.full_name, dir: 1 },
  pos: { value: (r) => r.t.prod_ref_group_after, dir: 1 },
  rating: { value: (r) => r.t.rating_display, dir: -1 },
  from: { value: (r) => r.t.origin, dir: 1 },
  to: { value: (r) => r.t.destination, dir: 1 },
  actual: { value: (r) => r.t.prod_value_after, dir: -1 },
  expected: { value: (r) => r.t.prod_expected, dir: -1 },
  difference: { value: (r) => r.t.prod_over_expected, dir: -1 },
  stats: { value: (r) => mainYards(r.t), dir: -1 },
};

// A school as just its logo; the name shows on hover (and to screen readers).
// The new school links to its team page.
function SchoolLogo({ team, name, to }) {
  if (!team) return name;
  const logo = <TeamLogo team={team} size={26} />;
  return to ? (
    <Link className="nil-school" to={to} data-name={team.team} aria-label={team.team}>{logo}</Link>
  ) : (
    <span className="nil-school" data-name={team.team} role="img" aria-label={team.team}>{logo}</span>
  );
}

// Players ranked by actual − expected (value above his price). `rows` arrive
// sorted best first; each is { t: transfer record, team / fromTeam: new and old
// school's team records, or null }. Any column header re-sorts the table; a
// player's rank (and his Difference color) always stays his place by Difference.
export default function PlayerBoard({ rows, season }) {
  const [showAll, setShowAll] = useState(false);
  const { sorted, sort, onSort } = useSorted(rows, SORTS);

  if (!rows.length) {
    return <p className="nil-empty">No scored players for this filter.</p>;
  }
  const shown = showAll ? sorted : sorted.slice(0, PAGE);
  const header = { sort, onSort };

  return (
    <>
      <div className="nil-table-wrap">
        <table className="nil-table nil-player-table">
          <thead>
            <tr>
              <SortHeader id="rank" {...header} title="Rank by Difference">#</SortHeader>
              <SortHeader id="player" {...header} className="nil-td-left">Player</SortHeader>
              <SortHeader id="pos" {...header} title="Position he was scored at (the stats feed's listing)">Pos</SortHeader>
              <SortHeader id="rating" {...header} title="Published portal rating (higher = pricier); est. = we estimated it">Portal rating</SortHeader>
              <SortHeader id="from" {...header} className="nil-td-center nil-hide-sm">From</SortHeader>
              <th className="nil-move-arrow nil-hide-sm" aria-hidden="true" />
              <SortHeader id="to" {...header} className="nil-td-center">To</SortHeader>
              <SortHeader id="actual" {...header} className="nil-tight" title="PPA he produced in his first season at the new school">Actual</SortHeader>
              <th className="nil-eq-op nil-tight" aria-hidden="true">−</th>
              <SortHeader id="expected" {...header} className="nil-tight" title="PPA players with his rating at his position usually produce">Expected</SortHeader>
              <th className="nil-eq-op nil-tight" aria-hidden="true">=</th>
              <SortHeader id="difference" {...header} className="nil-td-left" title="How many points added he beat (+) or missed (−) his price by">Difference</SortHeader>
              <SortHeader id="stats" {...header} className="nil-hide-sm nil-td-left" title="His stat line at the new school (sorts by main yardage)">At new school</SortHeader>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ t, team, fromTeam, rank }) => {
              const eq = equation(t.prod_expected, t.prod_over_expected);
              const group = t.prod_ref_group_after;
              return (
                <tr key={t.transfer_id}>
                  <td className="nil-td-muted">{rank}</td>
                  <td className="nil-td-name nil-td-left">
                    <Link className="nil-player-link" to={playerHref(t)}>{t.full_name}</Link>
                    {t.transfer_profile === "unproven" && <span className="nil-chip">no prior stats</span>}
                  </td>
                  <td>
                    {group}
                    {group !== t.position && (
                      <span className="nil-est" title={`Listed as ${t.position} in the portal`}>portal: {t.position}</span>
                    )}
                  </td>
                  <td>
                    <span className="nil-stars" aria-label={`${t.stars_display} stars`}>{fmtStars(t.stars_display)}</span>{" "}
                    {fmtRating(t.rating_display)}
                    {t.rating_imputed && <span className="nil-est" title="We estimated this player's portal rating">est.</span>}
                  </td>
                  <td className="nil-td-center nil-hide-sm">
                    <SchoolLogo team={fromTeam} name={t.origin} />
                  </td>
                  <td className="nil-move-arrow nil-hide-sm" aria-label="transferred to">→</td>
                  <td className="nil-td-center">
                    <SchoolLogo
                      team={team}
                      name={t.destination}
                      to={team && `/portal-comp-tool/team/${teamSlug(team.team)}?season=${season}`}
                    />
                  </td>
                  <td className="nil-eq-term nil-tight">
                    {fmtAmount(eq.actual)}
                    {!t.played_after && (
                      <span className="nil-dnp" title="Never got into a game; scored as zero production">didn't play</span>
                    )}
                  </td>
                  <td className="nil-eq-op nil-tight" aria-hidden="true">−</td>
                  <td className="nil-eq-term nil-eq-term--muted nil-tight">{fmtSubtracted(eq.expected)}</td>
                  <td className="nil-eq-op nil-tight" aria-hidden="true">=</td>
                  <td className="nil-td-left">
                    <span className="nil-eq-pill" style={rankColor(rank - 1, rows.length)}>{fmtTenths(eq.difference)}</span>
                  </td>
                  <td className="nil-hide-sm nil-td-muted nil-td-wrap nil-td-left">
                    {statLine(t)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > PAGE && (
        <button type="button" className="nil-show-more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? `Show first ${PAGE} only` : `Show all ${rows.length} players`}
        </button>
      )}
    </>
  );
}
