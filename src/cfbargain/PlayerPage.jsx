import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import TeamLogo from "./TeamLogo";
import ValueScatter from "./ValueScatter";
import {
  equation, fmtAmount, fmtRating, fmtStars, fmtTenths, playerHref, POSITIONS, rankFill, statLine, teamSlug,
  useTeams, useTransfers,
} from "./useNilData";
import "./cfbargain.css";

const ordinal = (n) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
};

const positionLabel = (id) => POSITIONS.find((p) => p.id === id)?.label.toLowerCase() ?? id;

// A school's logo and name, linking to its page for that season when it's FBS.
function School({ team, name, season }) {
  if (!team) return <span>{name}</span>;
  return (
    <Link className="nil-team-link" to={`/cfbargain/team/${teamSlug(team.team)}?season=${season}`}>
      <TeamLogo team={team} size={28} />
      {team.team}
    </Link>
  );
}

// One transfer: his price, what he was expected to add, what he added, and
// where that puts him among the same year's transfers at his position.
// Reached at /cfbargain/player/:id, where :id starts with the transfer_id.
export default function PlayerPage() {
  const { id } = useParams();
  const transferId = Number.parseInt(id, 10);
  const { data, error } = useTeams();
  const transfers = useTransfers();
  const t = transfers.data?.find((r) => r.transfer_id === transferId);

  // Every scored transfer at his position that season, best first: his rank and the chart.
  const peers = useMemo(() => {
    if (!t?.production_measured) return [];
    return transfers.data
      .filter((r) => r.production_measured && r.season === t.season
        && r.prod_ref_group_after === t.prod_ref_group_after)
      .sort((a, b) => b.prod_over_expected - a.prod_over_expected || a.full_name.localeCompare(b.full_name));
  }, [transfers.data, t]);

  // His other moves: same name, chained by school (one move's new school is the next one's old).
  const otherMoves = useMemo(() => {
    if (!t) return [];
    return transfers.data
      .filter((r) => r.transfer_id !== t.transfer_id && r.full_name === t.full_name
        && (r.origin === t.destination || r.destination === t.origin))
      .sort((a, b) => a.season - b.season);
  }, [transfers.data, t]);

  const back = <Link to="/cfbargain" className="project-detail-back">← All transfers</Link>;
  const loadError = error ?? transfers.error;
  if (loadError) return <section className="page nil-page nil-team-page">{back}<p className="nil-empty">Couldn't load the data ({loadError}).</p></section>;
  if (!data || !transfers.data) return <section className="page nil-page nil-team-page"><p className="nil-empty">Loading…</p></section>;
  if (!t) return <section className="page nil-page nil-team-page">{back}<p className="nil-empty">No transfer matches “{id}”.</p></section>;

  const teams = new Map(data.teams.map((x) => [x.team, x]));
  const toTeam = teams.get(t.destination) ?? null;
  const fromTeam = teams.get(t.origin) ?? null;
  const group = t.prod_ref_group_after ?? t.position_group;
  const eq = equation(t.prod_expected, t.prod_over_expected);
  const rank = peers.findIndex((r) => r.transfer_id === t.transfer_id) + 1;
  const beat = eq.difference >= 0;

  const points = peers.map((r, i) => ({
    id: r.transfer_id,
    label: r.full_name,
    x: r.prod_expected,
    y: r.prod_value_after,
    fill: r.transfer_id === t.transfer_id ? "var(--accent)" : rankFill(i, peers.length),
    href: r.transfer_id === t.transfer_id ? null : playerHref(r),
    tip: (() => {
      const e = equation(r.prod_expected, r.prod_over_expected);
      return (
        <>
          <strong>{r.full_name}</strong>
          <span className="nil-tooltip-sub">{r.origin} → {r.destination}</span>
          <dl>
            <div><dt>Portal rating</dt><dd>{fmtStars(r.stars_display)} {fmtRating(r.rating_display)}</dd></div>
            <div><dt>Expected</dt><dd>{fmtAmount(e.expected)}</dd></div>
            <div><dt>Actual</dt><dd>{fmtAmount(e.actual)}{!r.played_after && " (didn't play)"}</dd></div>
            <div><dt>Difference</dt><dd>{fmtTenths(e.difference)}</dd></div>
          </dl>
          {r.transfer_id !== t.transfer_id && <span className="nil-tooltip-hint">Click to see his page</span>}
        </>
      );
    })(),
  }));

  return (
    <section className="page nil-page nil-team-page">
      {back}
      <header className="nil-team-header nil-player-header" style={{ "--team-color": toTeam?.color || "var(--accent)" }}>
        {toTeam && <TeamLogo team={toTeam} size={64} />}
        <div>
          <p className="eyebrow">{group} · {t.season} transfer</p>
          <h1>{t.full_name}</h1>
          <p className="nil-team-sub nil-player-move">
            <School team={fromTeam} name={t.origin} season={t.season} />
            <span aria-label="transferred to">→</span>
            <School team={toTeam} name={t.destination} season={t.season} />
          </p>
        </div>
      </header>

      {!t.production_measured ? (
        <p className="nil-empty">
          Only QBs, RBs, WRs and TEs have PPA, so {t.full_name} ({t.position}) isn't scored. Portal
          rating: {fmtStars(t.stars_display)} {fmtRating(t.rating_display)}
          {t.rating_imputed && " (estimated)"}.
        </p>
      ) : (
        <>
          <div className="card nil-panel">
            <div className="nil-guide-chain">
              <div>
                <span className="nil-guide-label">Portal rating</span>
                <span className="nil-guide-value">{fmtRating(t.rating_display)}</span>
                <span className="nil-guide-note">
                  {fmtStars(t.stars_display)}
                  {t.rating_imputed && " · estimated: no published rating"}
                </span>
              </div>
              <div>
                <span className="nil-guide-label">Expected PPA</span>
                <span className="nil-guide-value">{fmtAmount(eq.expected)}</span>
                <span className="nil-guide-note">Typical for {group}s with his rating</span>
              </div>
              <div>
                <span className="nil-guide-label">Actual PPA</span>
                <span className="nil-guide-value">{fmtAmount(eq.actual)}</span>
                <span className="nil-guide-note">{t.played_after ? `His ${t.season} season` : "Didn't play: counted as 0"}</span>
              </div>
              <div className="is-result">
                <span className="nil-guide-label">{beat ? "Beat expectations by" : "Fell short by"}</span>
                <span className="nil-guide-value">{fmtTenths(eq.difference)}<span className="nil-unit">PPA</span></span>
                <span className="nil-guide-note">{fmtAmount(eq.actual)} actual − {fmtAmount(eq.expected)} expected</span>
              </div>
            </div>

            <p className="nil-guide-plain">
              <strong>In plain English:</strong> {group}s rated like him usually add about{" "}
              {fmtAmount(eq.expected)} PPA. He added {fmtAmount(eq.actual)}, so he{" "}
              {beat ? "beat" : "fell short of"} his price by {fmtAmount(Math.abs(eq.difference))} PPA:{" "}
              a {beat ? "positive" : "negative"} return on investment for {t.destination}.
            </p>
            {rank > 0 && (
              <p className="nil-guide-plain">
                <strong>Rank:</strong> {ordinal(rank)} of {peers.length} {positionLabel(group)} who
                transferred in {t.season}.
              </p>
            )}
          </div>

          <div className="nil-player-grid">
            <div className="card nil-panel">
              <div className="nil-panel-head">
                <h2>Before and after</h2>
              </div>
              <dl className="nil-player-facts">
                <div>
                  <dt>Year before, at {t.origin}</dt>
                  <dd>{t.played_before ? `${fmtAmount(t.prod_index_before)} PPA` : "Didn't play"}</dd>
                </div>
                <div>
                  <dt>First year at {t.destination}</dt>
                  <dd>{t.played_after ? `${fmtAmount(t.after_totalPPA_all)} PPA` : "Didn't play"}</dd>
                </div>
                {t.played_before && t.played_after && (
                  <div>
                    <dt>Change</dt>
                    <dd>{fmtTenths(t.after_totalPPA_all - t.prod_index_before)} PPA</dd>
                  </div>
                )}
                <div>
                  <dt>Stat line at {t.destination}</dt>
                  <dd>{statLine(t)}</dd>
                </div>
                {t.position !== group && (
                  <div>
                    <dt>Position</dt>
                    <dd>Listed as {t.position} in the portal, scored as a {group}</dd>
                  </div>
                )}
              </dl>
            </div>

            {otherMoves.length > 0 && (
              <div className="card nil-panel">
                <div className="nil-panel-head">
                  <h2>His other transfers</h2>
                </div>
                <ul className="nil-player-moves">
                  {otherMoves.map((r) => {
                    const e = equation(r.prod_expected, r.prod_over_expected);
                    return (
                      <li key={r.transfer_id}>
                        <Link to={playerHref(r)}>{r.season}: {r.origin} → {r.destination}</Link>
                        {r.production_measured && <span className="nil-td-muted"> · {fmtTenths(e.difference)} PPA vs. expected</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="card nil-panel">
            <div className="nil-panel-head">
              <h2>Every {t.season} {group} transfer</h2>
              <p>
                Each dot is a {group} who transferred in {t.season}: across is what his rating paid for
                (expected PPA), up is what he produced (actual PPA). {t.full_name} is the large orange
                dot. Click another dot to open that player.
              </p>
            </div>
            <ValueScatter points={points} noun="player" highlight={t.transfer_id}
              emptyText="No other scored transfers at his position that season." />
          </div>
        </>
      )}
    </section>
  );
}
