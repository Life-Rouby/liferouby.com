import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import CostScatter from "./CostScatter";
import Leaderboard from "./Leaderboard";
import ReadingGuide from "./ReadingGuide";
import { fmtIndex, fmtInt, fmtPercent, teamStats, useTeams } from "./useNilData";
import "./cfb-nil-comparison-tool.css";

const VIEWS = [
  { id: "leaderboard", label: "Rankings" },
  { id: "scatter", label: "Price vs. results" },
];

// CFB NIL comparison: how much on-field production each FBS program got from the
// transfers it brought in, relative to what those players cost. Reachable at
// /cfb-nil-comparison-tool but intentionally not listed on the Projects page yet.
export default function CFBNilComparisonToolPage() {
  const { data, error } = useTeams();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "scatter" ? "scatter" : "leaderboard";
  // One season at a time, defaulting to the latest; an unknown ?season= falls back to it.
  const seasons = data?.meta.seasons.map(String) ?? [];
  const latestSeason = seasons.at(-1) ?? null;
  const season = seasons.includes(params.get("season")) ? params.get("season") : latestSeason;
  const conference = params.get("conf") ?? "all";

  const setParam = (key, value, fallback) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const scoped = useMemo(() => {
    if (!data) return [];
    return data.teams
      .map((team) => {
        const stats = teamStats(team, season);
        const conf = stats?.conference;
        return { team, stats, conf };
      })
      .filter(({ stats }) => stats);  // every FBS team that season, scored or not
  }, [data, season]);

  const conferences = useMemo(() => [...new Set(scoped.map((r) => r.conf))].sort(), [scoped]);
  const rows = scoped
    .filter((r) => conference === "all" || r.conf === conference)
    // Ranked schools first, by rank; schools with nothing to score after, A to Z.
    .sort((a, b) => {
      const ra = a.stats.leaderboard_eligible ? a.stats.prod_over_expected_rank : Infinity;
      const rb = b.stats.leaderboard_eligible ? b.stats.prod_over_expected_rank : Infinity;
      return ra - rb || a.team.team.localeCompare(b.team.team);
    });

  if (error) {
    return <section className="page nil-page"><p className="nil-empty">Couldn't load the data ({error}).</p></section>;
  }
  if (!data) {
    return <section className="page nil-page"><p className="nil-empty">Loading…</p></section>;
  }

  const { meta } = data;
  const years = `${meta.seasons[0]}–${meta.seasons.at(-1)}`;
  const totalTransfers = data.teams.reduce((sum, t) => sum + t.totals.n_transfers, 0);
  const scoredTransfers = data.teams.reduce((sum, t) => sum + (t.totals.n_measured ?? 0), 0);
  const fewSample = meta.few_measured_season;

  return (
    <section className="page nil-page">
      <header className="page-header nil-header">
        <p className="eyebrow">College football · Transfer portal</p>
        <h1>CFB NIL Comparison Tool</h1>
        <p className="page-intro">
          Which schools got the best results from the transfer portal for what they paid?
        </p>
        <p className="nil-scope">
          Scores cover quarterbacks, running backs, wide receivers and tight ends only: the four
          positions PPA tracks. Other transfers don't count for or against a school.
        </p>
      </header>

      <div className="nil-stats nil-stats--four">
        <div className="card nil-stat">
          <span className="nil-stat-label">Players who switched schools</span>
          <span className="nil-stat-value">{fmtInt(totalTransfers)}</span>
          <span className="nil-stat-note">FBS to FBS, {years}</span>
        </div>
        <div className="card nil-stat">
          <span className="nil-stat-label">Got into a game at their new school</span>
          <span className="nil-stat-value">{fmtPercent(meta.averages.hit_rate)}</span>
          <span className="nil-stat-note">Of the players scored</span>
        </div>
        <div className="card nil-stat">
          <span className="nil-stat-label">Average score when they played</span>
          <span className="nil-stat-value">
            {fmtIndex(meta.averages.prod_quality_mean)}<span className="nil-unit">pts</span>
          </span>
          <span className="nil-stat-note">0 = average player at his position</span>
        </div>
        <div className="card nil-stat">
          <span className="nil-stat-label">Players scored</span>
          <span className="nil-stat-value">{fmtInt(scoredTransfers)}</span>
          <span className="nil-stat-note">QBs, RBs, WRs and TEs (the positions with PPA)</span>
        </div>
      </div>

      <ReadingGuide example={meta.example} scale={meta.index} units={meta.units} />

      <div className="nil-layout-main">
        <div className="nil-filters">
          <label className="nil-filter">
            <span>Season</span>
            <select value={season} onChange={(e) => setParam("season", e.target.value, latestSeason)}>
              {meta.seasons.map((s) => <option key={s} value={String(s)}>{s}</option>)}
            </select>
          </label>
          <label className="nil-filter">
            <span>Conference</span>
            <select value={conference} onChange={(e) => setParam("conf", e.target.value, "all")}>
              <option value="all">All conferences</option>
              {conferences.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="nil-tabs" role="tablist" aria-label="Select view">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={v.id === view}
                className={v.id === view ? "nav-link nav-link--active" : "nav-link"}
                onClick={() => setParam("view", v.id, "leaderboard")}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card nil-panel">
          {view === "leaderboard" ? (
            <>
              <div className="nil-panel-head">
                <h2>Which schools got the most for their money?</h2>
                <p>
                  Ranked by value above price per player: actual − expected, averaged over the
                  school's scored transfers, in pts (0 = average). The gray line is the likely
                  range; schools under {fewSample} scored transfers are tagged. Click a school to see
                  its players.
                </p>
              </div>
              <Leaderboard rows={rows} season={season} fewSample={fewSample} />
            </>
          ) : (
            <>
              <div className="nil-panel-head">
                <h2>Price vs. results</h2>
                <p>
                  Each dot is a school, per player. Across: what its transfers' ratings paid for
                  (expected pts). Up: what they produced (actual pts). Dots above the diagonal beat
                  their price; the distance above it is the school's leaderboard score. Click a dot
                  to open the school.
                </p>
              </div>
              <CostScatter rows={rows.filter((r) => r.stats.leaderboard_eligible)} averages={meta.averages} season={season} />
            </>
          )}
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
            version of EPA: how much each play changed his team's expected points, summed over the
            season and compared with everyone at his position. Record seasons are capped. PPA only
            covers QB, RB, WR and TE; other positions count toward cost but aren't scored.
          </p>
          <p>
            <strong>Expected score.</strong> Where his rating lands on a trend line through every
            transfer at his position.
          </p>
          <p>
            <strong>School score.</strong> The average of its transfers' differences: value above
            price per player (each player's price is already built into his expected score). Schools
            bring in about 3 scored transfers a season, so one player can swing a lot; the gray line
            shows how much.
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
