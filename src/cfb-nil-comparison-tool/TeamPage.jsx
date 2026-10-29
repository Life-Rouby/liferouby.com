import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import TeamLogo from "./TeamLogo";
import {
  equation, fmtIndex, fmtRating, fmtRaw, fmtStars, fmtSubtracted, fmtTenths, rawUnit, fmtInt, fmtPercent, fmtPoints, teamSlug, teamStats, useTeams, useTransfers,
} from "./useNilData";
import "./cfb-nil-comparison-tool.css";

// One-line stat summary at the new school, chosen by position.
function statLine(t) {
  if (!t.production_measured) return "Not scored (only QB, RB, WR and TE have PPA)";
  if (!t.played_after) return "Didn't play";
  const n = (v) => fmtInt(v ?? 0);
  if (t.position_group === "QB") {
    return `${n(t.after_passing_YDS)} pass yds, ${n(t.after_passing_TD)} TD, ${n(t.after_rushing_YDS)} rush yds`;
  }
  if (t.position_group === "RB") {
    return `${n(t.after_rushing_YDS)} rush yds, ${n(t.after_rushing_TD)} TD, ${n(t.after_receiving_YDS)} rec yds`;
  }
  return `${n(t.after_receiving_REC)} rec, ${n(t.after_receiving_YDS)} yds, ${n(t.after_receiving_TD)} TD`;
}

const COLUMNS = [
  { key: "season", label: "Season" },
  { key: "full_name", label: "Player" },
  { key: "rating_display", label: "Portal rating", num: true },
  { key: "position", label: "Pos" },
  { key: "origin", label: "From" },
  // actual − expected = difference, laid out like the leaderboard's equation
  { key: "prod_value_after", label: "Actual", num: true, title: "How he played in his first year after transferring" },
  { op: "−" },
  { key: "prod_expected", label: "Expected", num: true, title: "How well players with his rating at his position usually play" },
  { op: "=" },
  { key: "prod_over_expected", label: "Difference", num: true },
];

const sortValue = (t, key) => t[key];

// One metric inside a summary group: value, optional 95% range, and how it
// compares with the FBS average.
function Metric({ label, value, range, note }) {
  return (
    <div className="nil-metric">
      <span className="nil-metric-label">{label}</span>
      <span className="nil-metric-value">{value}</span>
      {range && <span className="nil-metric-range">Likely between {range}</span>}
      {note && <span className="nil-metric-note">{note}</span>}
    </div>
  );
}

function robustnessText(totals) {
  if (!totals.tier_baseline) return null;
  return totals.tier_consistent
    ? `Stays in the ${totals.tier_baseline} third of schools no matter how we tweak the math`
    : `Usually in the ${totals.tier_baseline} third of schools, but moves when we tweak the math`;
}

// The headline result: production over expected per player (value above price),
// with its range drawn against 0.
function Verdict({ stats, nRanked, robustness }) {
  const lo = stats.prod_over_expected_lo;
  const hi = stats.prod_over_expected_hi;
  const extent = Math.max(4, Math.abs(lo ?? 0), Math.abs(hi ?? 0));
  const step = extent > 50 ? 25 : extent > 20 ? 10 : 2;
  const domain = Math.ceil(extent / step) * step;
  const pos = (v) => `${((v + domain) / (2 * domain)) * 100}%`;
  return (
    <div className="card nil-verdict">
      <span className="nil-metric-label">Value above price, per player</span>
      <span className="nil-verdict-value">
        {fmtPoints(stats.prod_over_expected_mean)}<span className="nil-unit">pts</span>
      </span>
      <div className="nil-verdict-range">
        <div className="nil-range">
          <span className="nil-range-zero" style={{ left: pos(0) }} />
          <span className="nil-range-line" style={{
            left: pos(lo),
            width: `calc(${pos(hi)} - ${pos(lo)})`,
          }} />
          <span className="nil-range-dot" style={{ left: pos(stats.prod_over_expected_mean) }} />
        </div>
        <div className="nil-verdict-axis">
          <span>{fmtPoints(-domain)}</span>
          <span>normal</span>
          <span>{fmtPoints(domain)}</span>
        </div>
      </div>
      <span className="nil-metric-range">
        Likely between {fmtPoints(lo)} and {fmtPoints(hi)}
      </span>
      <span className="nil-metric-note">
        {stats.prod_over_expected_rank ? `Ranked ${stats.prod_over_expected_rank} of ${nRanked} schools` : "Not ranked (too few transfers)"}
        {robustness ? `. ${robustness}.` : ""}
      </span>
    </div>
  );
}

// The school's result in one plain sentence, per player: players rated like them
// usually play at Y, they played at Z, so they beat (or missed) their price by Z − Y.
function SchoolSentence({ team, stats }) {
  const eq = equation(stats.prod_expected_mean, stats.prod_over_expected_mean);
  if (eq.difference == null) return null;
  const beat = eq.difference >= 0;
  return (
    <p className="nil-team-lead">
      {team.team}'s {stats.n_measured} scored transfers (QBs, RBs, WRs and TEs) were rated{" "}
      <strong>{fmtRating(stats.rating_measured_mean)}</strong> on average. Players rated like them
      usually play at <strong>{fmtTenths(eq.expected)} pts</strong>. They played at{" "}
      <strong>{fmtTenths(eq.actual)} pts</strong>, so they {beat ? "beat" : "fell short of"} their
      price by <strong>{fmtTenths(Math.abs(eq.difference)).replace("+", "")} pts</strong> per player.
      {" "}(0 pts = average player at his position.)
    </p>
  );
}

function TransferTable({ transfers }) {
  const [sort, setSort] = useState({ key: "prod_value_after", dir: -1 });
  const sorted = useMemo(() => {
    const val = (t) => sortValue(t, sort.key);
    return [...transfers].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return -sort.dir;
      if (va > vb) return sort.dir;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [transfers, sort]);

  const toggle = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }));

  return (
    <div className="nil-table-wrap">
      <table className="nil-table">
        <thead>
          <tr>
            {COLUMNS.map((c, i) => (c.op ? (
              <th key={`op${i}`} className="nil-eq-op" aria-hidden="true">{c.op}</th>
            ) : (
              <th key={c.key} className={c.num ? "nil-td-num" : undefined} title={c.title} aria-sort={sort.key === c.key ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
                <button type="button" onClick={() => toggle(c.key)}>
                  {c.label}
                  {sort.key === c.key && <span aria-hidden="true">{sort.dir > 0 ? " ↑" : " ↓"}</span>}
                </button>
              </th>
            )))}
            <th className="nil-hide-sm" title="His stat line, and his production in real stats vs. what players rated like him usually produce">At new school</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const eq = equation(t.prod_expected, t.prod_over_expected);
            return (
            <tr key={t.transfer_id}>
              <td>{t.season}</td>
              <td className="nil-td-name">
                {t.full_name}
                {t.transfer_profile === "unproven" && <span className="nil-chip">no prior stats</span>}
              </td>
              <td className="nil-td-num">
                <span className="nil-stars" aria-label={`${t.stars_display} stars`}>{fmtStars(t.stars_display)}</span>{" "}
                {fmtRating(t.rating_display)}
                {t.rating_imputed && <span className="nil-est" title="We estimated this player's portal rating">est.</span>}
              </td>
              <td>{t.position}</td>
              <td>{t.origin}</td>
              <td className="nil-td-num nil-eq-term">
                {fmtTenths(eq.actual)}
                {t.production_measured && !t.played_after && (
                  <span className="nil-est" title="Never got into a game; scored as zero production">didn't play</span>
                )}
              </td>
              <td className="nil-eq-op" aria-hidden="true">{eq.actual != null && "−"}</td>
              <td className="nil-td-num nil-eq-term nil-eq-term--muted">{eq.expected != null ? fmtSubtracted(eq.expected) : "–"}</td>
              <td className="nil-eq-op" aria-hidden="true">{eq.actual != null && "="}</td>
              <td className="nil-td-num">
                {eq.difference != null ? (
                  <span className={`nil-eq-pill nil-eq-pill--${eq.difference >= 0 ? "pos" : "neg"}`}>
                    {fmtTenths(eq.difference)}
                  </span>
                ) : "–"}
              </td>
              <td className="nil-hide-sm nil-td-muted nil-td-wrap">
                {statLine(t)}
                {t.prod_actual_raw != null && (
                  <span className="nil-raw-line">
                    {fmtRaw(t.prod_actual_raw)} {rawUnit(t.prod_ref_group_after)} (rated like him: about {fmtRaw(t.prod_expected_raw)})
                  </span>
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SeasonTable({ team, meta, setSeason }) {
  return (
    <div className="card nil-panel">
      <div className="nil-panel-head"><h2>Year by year</h2></div>
      <div className="nil-table-wrap">
        <table className="nil-table">
          <thead>
            <tr>
              <th>Season</th><th className="nil-td-num">Scored transfers</th><th className="nil-td-num">Avg rating</th>
              <th className="nil-td-num">Hit rate</th><th className="nil-td-num">Quality</th>
              <th className="nil-td-num">Difference</th><th className="nil-td-num nil-hide-sm">Rank that year</th>
            </tr>
          </thead>
          <tbody>
            {meta.seasons.map((s) => {
              const row = team.seasons[s];
              if (!row || row.n_transfers === 0) {
                return <tr key={s}><td>{s}</td><td colSpan={6} className="nil-td-muted">No transfers this year</td></tr>;
              }
              if (!row.n_measured) {
                return <tr key={s}><td>{s}</td><td colSpan={6} className="nil-td-muted">No QB, RB, WR or TE transfers this year</td></tr>;
              }
              return (
                <tr key={s}>
                  <td><button type="button" className="nil-link-btn" onClick={() => setSeason(String(s))}>{s}</button></td>
                  <td className="nil-td-num">{row.n_measured}</td>
                  <td className="nil-td-num">{fmtRating(row.rating_measured_mean)}</td>
                  <td className="nil-td-num">{fmtPercent(row.hit_rate)}</td>
                  <td className="nil-td-num">{fmtIndex(row.prod_quality_mean)}</td>
                  <td className="nil-td-num">{fmtPoints(row.prod_over_expected_mean)}</td>
                  <td className="nil-td-num nil-hide-sm">{row.prod_over_expected_rank ?? "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="nil-table-note">
        Click a year to filter.
      </p>
    </div>
  );
}

export default function TeamPage() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const season = params.get("season") ?? "all";
  const { data, error } = useTeams();
  const transfers = useTransfers();

  const team = data?.teams.find((t) => teamSlug(t.team) === slug);
  const teamTransfers = useMemo(() => {
    if (!team || !transfers.data) return [];
    return transfers.data.filter(
      (t) => t.destination === team.team && (season === "all" || String(t.season) === season),
    );
  }, [team, transfers.data, season]);

  const back = <Link to="/cfb-nil-comparison-tool" className="project-detail-back">← All teams</Link>;

  if (error) return <section className="page nil-page nil-team-page">{back}<p className="nil-empty">Couldn't load the data ({error}).</p></section>;
  if (!data) return <section className="page nil-page nil-team-page"><p className="nil-empty">Loading…</p></section>;
  if (!team) return <section className="page nil-page nil-team-page">{back}<p className="nil-empty">No FBS team matches “{slug}”.</p></section>;

  const stats = teamStats(team, season);
  const { meta } = data;
  const avg = meta.averages;
  const setSeason = (value) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("season");
    else next.set("season", value);
    setParams(next, { replace: true });
  };
  const scopeLabel = season === "all" ? `${meta.seasons[0]}–${meta.seasons.at(-1)}` : season;
  const fewSample = season === "all" ? meta.few_measured_total : meta.few_measured_season;
  const nRanked = data.teams.filter((t) => teamStats(t, season)?.leaderboard_eligible).length;
  const valueRange = (m, fmt) => `${fmt(stats[`${m}_lo`])} and ${fmt(stats[`${m}_hi`])}`;
  const hasStats = stats && stats.n_transfers > 0;

  return (
    <section className="page nil-page nil-team-page">
      {back}
      <div className="nil-team-top">
        <header className="nil-team-header" style={{ "--team-color": team.color || "var(--accent)" }}>
          <TeamLogo team={team} size={64} />
          <div>
            <p className="eyebrow">{team.conference}</p>
            <h1>{team.team}</h1>
            <p className="nil-team-sub">
              Players who transferred in, {scopeLabel} · Scores cover QB, RB, WR and TE only ·{" "}
              <Link to="/cfb-nil-comparison-tool">How to read these numbers</Link>
            </p>
          </div>
        </header>
        <label className="nil-filter">
          <span>Season</span>
          <select value={season} onChange={(e) => setSeason(e.target.value)}>
            <option value="all">All ({meta.seasons[0]}–{meta.seasons.at(-1)})</option>
            {meta.seasons.map((s) => <option key={s} value={String(s)}>{s}</option>)}
          </select>
        </label>
      </div>

      {!hasStats ? (
        <p className="nil-empty">{team.team} didn't bring in any transfers in {scopeLabel}.</p>
      ) : stats.n_measured === 0 ? (
        <p className="nil-empty">
          {team.team} brought in {stats.n_transfers} transfer{stats.n_transfers === 1 ? "" : "s"} in{" "}
          {scopeLabel}, but none at QB, RB, WR or TE, so it isn't scored or ranked.
        </p>
      ) : (
        <>
          {stats.n_measured < fewSample && (
            <p className="nil-note">
              Only {stats.n_measured} scored transfer{stats.n_measured === 1 ? "" : "s"}, so one player
              can swing these numbers a lot.
            </p>
          )}

          <SchoolSentence team={team} stats={stats} />

          <div className="nil-team-summary">
            <Verdict
              stats={stats}
              nRanked={nRanked}
              robustness={season === "all" ? robustnessText(team.totals) : null}
            />

            <div className="card nil-group">
              <h2>Who they brought in</h2>
              <div className="nil-group-metrics">
                <Metric
                  label="Average portal rating"
                  value={fmtRating(stats.rating_measured_mean)}
                  note={`Scored players (QB, RB, WR, TE). Higher = pricier. All schools: ${fmtRating(avg.rating_measured_mean)}`}
                />
                <Metric
                  label="Players brought in"
                  value={stats.n_transfers}
                  note={`${stats.n_measured} scored (QB, RB, WR, TE)`}
                />
                <Metric
                  label="Ratings we estimated"
                  value={fmtPercent(stats.share_imputed)}
                  note="No published rating"
                />
              </div>
            </div>

            <div className="card nil-group">
              <h2>How they played</h2>
              <div className="nil-group-metrics">
                <Metric
                  label="Got into a game"
                  value={fmtPercent(stats.hit_rate)}
                  range={valueRange("hit_rate", fmtPercent)}
                  note={`${stats.n_played_after} of ${stats.n_measured}. All schools: ${fmtPercent(avg.hit_rate)}`}
                />
                <Metric
                  label="Average score when they played"
                  value={fmtIndex(stats.prod_quality_mean)}
                  range={valueRange("prod_quality", fmtIndex)}
                  note={`All schools: ${fmtIndex(avg.prod_quality_mean)}`}
                />
                <Metric
                  label="Better or worse than before?"
                  value={fmtPoints(stats.prod_gain_mean)}
                  note={`Change after switching (${stats.n_gain} played at both)`}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {hasStats && season === "all" && <SeasonTable team={team} meta={meta} setSeason={setSeason} />}

      {hasStats && <div className="card nil-panel">
        <div className="nil-panel-head">
          <h2>Every player</h2>
          <p>
            Actual (his first season at {team.team}) − Expected (typical for his rating) =
            Difference, in pts (0 = average). Didn't play ≈ −5 to −8; positions without PPA show a
            dash; “est.” = estimated rating. Click a column to sort.
          </p>
        </div>
        {transfers.error && <p className="nil-empty">Couldn't load transfers ({transfers.error}).</p>}
        {!transfers.data && !transfers.error && <p className="nil-empty">Loading transfers…</p>}
        {transfers.data && <TransferTable transfers={teamTransfers} />}
      </div>}
    </section>
  );
}
