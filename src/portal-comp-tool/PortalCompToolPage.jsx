import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PlayerBoard from "./PlayerBoard";
import ReadingGuide from "./ReadingGuide";
import TeamBoard from "./TeamBoard";
import ValueScatter from "./ValueScatter";
import {
  equation, fmtAmount, fmtRating, fmtStars, fmtTenths, playerHref, POSITIONS, rankFill, teamSlug, useTeams,
  useTransfers,
} from "./useNilData";
import "./portal-comp-tool.css";

const VIEWS = [
  { id: "players", label: "Players" },
  { id: "teams", label: "Teams" },
];

// A one-click filter: every option visible as a pill, the chosen one highlighted.
function Pills({ label, value, options, onChange }) {
  return (
    <div className="nil-filter">
      <span id={`nil-pills-${label}`}>{label}</span>
      <div className="nil-pills" role="radiogroup" aria-labelledby={`nil-pills-${label}`}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={o.id === value}
            title={o.title}
            className={o.id === value ? "nil-pill is-active" : "nil-pill"}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// A whole-number box that only commits valid values (lo..hi); while typing it
// can be blank, and on blur it snaps back to the committed value.
function CountInput({ value, lo, hi, label, onChange }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      type="number"
      inputMode="numeric"
      min={lo}
      max={hi}
      value={draft}
      aria-label={label}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Number.parseInt(e.target.value, 10);
        if (n >= lo && n <= hi) onChange(n);
      }}
      onBlur={() => setDraft(String(value))}
    />
  );
}

// Parse a positive whole number from the URL, or null.
const countParam = (v) => (/^\d+$/.test(v ?? "") && Number(v) >= 1 ? Number(v) : null);

const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;

// Per-school averages over the players in the current filters, best first.
function teamRows(rows) {
  const bySchool = new Map();
  for (const r of rows) {
    const name = r.team?.team ?? r.t.destination;
    if (!bySchool.has(name)) bySchool.set(name, { name, team: r.team, players: [] });
    bySchool.get(name).players.push(r.t);
  }
  return [...bySchool.values()]
    .map(({ name, team, players }) => ({
      name,
      team,
      n: players.length,
      nPlayed: players.filter((t) => t.played_after).length,
      rating: mean(players.map((t) => t.rating_display)),
      actual: mean(players.map((t) => t.prod_value_after)),
      expected: mean(players.map((t) => t.prod_expected)),
      difference: mean(players.map((t) => t.prod_over_expected)),
    }))
    .sort((a, b) => b.difference - a.difference || a.name.localeCompare(b.name));
}

// Tooltip body: name, a sub line, and its actual − expected = difference.
function Tip({ title, sub, rating, expected, difference, extra, hint }) {
  const eq = equation(expected, difference);
  return (
    <>
      <strong>{title}</strong>
      <span className="nil-tooltip-sub">{sub}</span>
      <dl>
        <div><dt>{rating[0]}</dt><dd>{rating[1]}</dd></div>
        <div><dt>Expected</dt><dd>{fmtAmount(eq.expected)}</dd></div>
        <div><dt>Actual</dt><dd>{fmtAmount(eq.actual)}{extra}</dd></div>
        <div><dt>Difference</dt><dd>{fmtTenths(eq.difference)}</dd></div>
      </dl>
      <span className="nil-tooltip-hint">{hint}</span>
    </>
  );
}

// CFB Portal Comparison Tool: which transfers outplayed (or fell short of) what their portal
// rating says they cost, one player at a time; school pages keep the per-school view.
// Reachable at /portal-comp-tool but intentionally not listed on the Projects page yet.
export default function PortalCompToolPage() {
  const { data, error } = useTeams();
  const transfers = useTransfers();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "teams" ? "teams" : "players";
  // One season at a time, defaulting to the latest; an unknown ?season= falls back to it.
  const seasons = data?.meta.seasons.map(String) ?? [];
  const latestSeason = seasons.at(-1) ?? null;
  const season = seasons.includes(params.get("season")) ? params.get("season") : latestSeason;
  // Quarterbacks by default: raw PPA is much bigger for QBs, so a mixed list is mostly QBs.
  const posParam = params.get("pos");
  const position = posParam === "all" || POSITIONS.some((p) => p.id === posParam) ? posParam : "QB";
  // The Players view's position, kept while on Teams so switching back restores it.
  const playersPosition = useRef("QB");
  const conference = params.get("conf") ?? "all";
  // Teams view: hide schools with fewer scored transfers than this (1 = show all).
  // Teams view: keep schools with between min and max scored transfers (max null = no cap).
  const minParam = countParam(params.get("min")) ?? 1;
  const maxParam = countParam(params.get("max"));

  const setParam = (key, value, fallback) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  // Every scored transfer that season (QB, RB, WR, TE), with his old and new
  // schools' team records and the new school's conference.
  const scoped = useMemo(() => {
    if (!data || !transfers.data) return [];
    const teams = new Map(data.teams.map((t) => [t.team, t]));
    return transfers.data
      .filter((t) => t.production_measured && String(t.season) === season)
      .map((t) => {
        const team = teams.get(t.destination) ?? null;
        return { t, team, fromTeam: teams.get(t.origin) ?? null, conf: team?.seasons[season]?.conference ?? null };
      });
  }, [data, transfers.data, season]);

  const conferences = useMemo(
    () => [...new Set(scoped.map((r) => r.conf).filter(Boolean))].sort(),
    [scoped],
  );
  // Best value above price first; ties A to Z.
  const rows = scoped
    .filter((r) => position === "all" || r.t.prod_ref_group_after === position)
    .filter((r) => conference === "all" || r.conf === conference)
    .sort((a, b) => b.t.prod_over_expected - a.t.prod_over_expected
      || a.t.full_name.localeCompare(b.t.full_name));
  const allSchools = teamRows(rows);
  const most = Math.max(1, ...allSchools.map((s) => s.n));
  // Clamp to what these filters have, so the boxes never show an impossible range.
  const maxTransfers = Math.min(maxParam ?? most, most);
  const minTransfers = Math.min(minParam, maxTransfers);
  const schools = allSchools.filter((s) => s.n >= minTransfers && s.n <= maxTransfers);
  // Set the range; the other end moves if needed so min never passes max.
  const setTransfers = (lo, hi) => {
    const next = new URLSearchParams(params);
    if (lo <= 1) next.delete("min");
    else next.set("min", String(lo));
    if (hi >= most) next.delete("max");
    else next.set("max", String(hi));
    setParams(next, { replace: true });
  };
  const schoolHref = (name) => `/portal-comp-tool/team/${teamSlug(name)}?season=${season}`;

  // Chart dots, colored by rank like the table's Difference pills.
  const points = view === "players"
    ? rows.map(({ t, team }, i) => ({
      id: t.transfer_id,
      label: t.full_name,
      x: t.prod_expected,
      y: t.prod_value_after,
      fill: rankFill(i, rows.length),
      href: playerHref(t),
      tip: (
        <Tip title={t.full_name} sub={`${t.prod_ref_group_after} · ${t.origin} → ${team?.team ?? t.destination}`}
          rating={["Portal rating", `${fmtStars(t.stars_display)} ${fmtRating(t.rating_display)}`]}
          expected={t.prod_expected} difference={t.prod_over_expected}
          extra={!t.played_after && " (didn't play)"} hint="Click to see his page" />
      ),
    }))
    : schools.map((s, i) => ({
      id: s.name,
      label: s.name,
      x: s.expected,
      y: s.actual,
      fill: rankFill(i, schools.length),
      logo: s.team?.logo,
      href: s.team && schoolHref(s.name),
      tip: (
        <Tip title={s.name} sub={`${s.n} scored transfer${s.n === 1 ? "" : "s"} · averages per player`}
          rating={["Avg rating", fmtRating(s.rating)]} expected={s.expected} difference={s.difference}
          hint="Click to see this school's transfers" />
      ),
    }));

  const loadError = error ?? transfers.error;
  if (loadError) {
    return <section className="page nil-page"><p className="nil-empty">Couldn't load the data ({loadError}).</p></section>;
  }
  if (!data || !transfers.data) {
    return <section className="page nil-page"><p className="nil-empty">Loading…</p></section>;
  }

  const { meta } = data;
  const years = `${meta.seasons[0]}–${meta.seasons.at(-1)}`;
  const totalTransfers = data.teams.reduce((sum, t) => sum + t.totals.n_transfers, 0);
  const scoredTransfers = data.teams.reduce((sum, t) => sum + (t.totals.n_measured ?? 0), 0);

  return (
    <section className="page nil-page">
      <header className="page-header nil-header">
        <p className="eyebrow">College football · Transfer portal</p>
        <h1>CFB Portal Comparison Tool</h1>
        <p className="page-intro">
          Which quarterbacks, running backs, wide receivers and tight end transfers played better than their portal rating said they would?
        </p>
      </header>

      <ReadingGuide example={meta.example} scale={meta.index} />

      <div className="nil-layout-main">
        <div className="nil-filters">
          <Pills
            label="Position"
            value={position}
            options={[...POSITIONS.map((p) => ({ id: p.id, label: p.id, title: p.label })),
              { id: "all", label: "All", title: "All positions" }]}
            onChange={(id) => setParam("pos", id, "QB")}
          />
          <Pills
            label="Season"
            value={season}
            options={seasons.map((s) => ({ id: s, label: s }))}
            onChange={(id) => setParam("season", id, latestSeason)}
          />
          <label className="nil-filter">
            <span>Conference</span>
            <select value={conference} onChange={(e) => setParam("conf", e.target.value, "all")}>
              <option value="all">All conferences</option>
              {conferences.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {view === "teams" && (
            <div className="nil-filter">
              <span>Transfers per school</span>
              <div className="nil-count-range">
                <CountInput value={minTransfers} lo={1} hi={most} label="Minimum scored transfers"
                  onChange={(n) => setTransfers(n, Math.max(n, maxTransfers))} />
                <span>to</span>
                <CountInput value={maxTransfers} lo={1} hi={most} label="Maximum scored transfers"
                  onChange={(n) => setTransfers(Math.min(minTransfers, n), n)} />
              </div>
            </div>
          )}
          <div className="nil-tabs" role="tablist" aria-label="Select view">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={v.id === view}
                className={v.id === view ? "nav-link nav-link--active" : "nav-link"}
                onClick={() => {
                  // Teams compare whole transfer classes, so switching to them shows every
                  // position; switching back to Players restores the position picked there.
                  if (v.id === view) return;
                  const next = new URLSearchParams(params);
                  if (v.id === "teams") {
                    playersPosition.current = position;
                    next.set("view", "teams");
                    next.set("pos", "all");
                  } else {
                    next.delete("view");
                    if (playersPosition.current === "QB") next.delete("pos");
                    else next.set("pos", playersPosition.current);
                  }
                  setParams(next, { replace: true });
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card nil-panel">
          {view === "players" ? (
            <div className="nil-panel-head">
              <h2>Which transfers gave the best return on investment?</h2>
              <p>
                <strong>This page shows which transfers brought the best return on investment to
                their new team</strong>: players who performed better than what the team paid for. A
                player's portal rating is his price, so a player near the top gave his team a better
                return on investment than players at that price usually do.
              </p>
              <p>
                In the chart, each dot is a player: across is what his rating paid for (expected PPA),
                up is what he produced (actual PPA). Dots above the diagonal gave a positive return on
                investment. The table ranks players by actual − expected PPA: how many more (+) or
                fewer (−) points he added than players with his rating usually do. Players who didn't
                play count as 0. Click a dot or a name to open that player, or a school to see all its transfers.
                {position === "all" && " With all positions shown, QBs fill the top and bottom: they're part of far more plays."}
              </p>
            </div>
          ) : (
            <div className="nil-panel-head">
              <h2>Which schools got the best return on investment?</h2>
              <p>
                <strong>This page shows which schools got the most out of the transfers they brought
                in</strong>, averaged per player over the transfers in these filters.
              </p>
              <p>
                In the chart, each dot is a school: across is what its transfers' ratings paid for
                (average expected PPA), up is what they produced (average actual PPA). Dots above the
                diagonal got a positive return on investment. The table ranks schools by average
                actual − expected PPA per player. A school with only one or two transfers can swing a
                lot: use the Transfers per school filter to hide schools with only a few. Click a dot or a school
                to see its transfers.
              </p>
            </div>
          )}
          <ValueScatter
            points={points}
            noun={view === "players" ? "player" : "school"}
            emptyText="No scored transfers for this filter."
          />
          <div className="nil-panel-table">
            {view === "players"
              ? <PlayerBoard key={`${season}-${position}-${conference}`} rows={rows} season={season} />
              : <TeamBoard key={`${season}-${position}-${conference}-${minTransfers}-${maxTransfers}`} rows={schools} season={season} />}
          </div>
        </div>
      </div>

      <details className="card nil-method">
        <summary>How we got these numbers</summary>
        <div className="nil-method-body">
          <p>
            <strong>Portal rating.</strong> The published recruiting rating (.750–1.000, with
            stars). For the math it's compared with that year's other transfers. About 1 in 4 had no
            rating, so we estimated one from stars, prior production and position.
          </p>
          <p>
            <strong>How well he played.</strong> PPA (predicted points added), the college
            version of EPA: how much each play he was part of changed his team's expected points,
            summed over his first season at the new school. It's shown as published, with no
            rescaling or cap. PPA only covers QB, RB, WR and TE.
          </p>
          <p>
            <strong>Expected PPA.</strong> Where his rating lands on a trend line through every
            transfer at his position.
          </p>
          <p>
            <strong>Ranking.</strong> Players are ranked by actual − expected. Each school's page
            also averages it over that school's transfers (about 3 scored a season, so one player
            can swing a lot).
          </p>
          <p>
            <strong>Keep in mind.</strong> Portal ratings stand in for price; they aren't actual
            NIL pay. FBS-to-FBS moves only; 2021 data looks incomplete. Data: CollegeFootballData.com.
          </p>
        </div>
      </details>
    </section>
  );
}
