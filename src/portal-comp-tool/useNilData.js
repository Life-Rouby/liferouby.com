import { useEffect, useState } from "react";

// Data files written by projects/portal-comp-tool/src/export_site_data.py.
// Each file is fetched once per page load and shared between views.
const cache = {};

function loadJson(name) {
  if (!cache[name]) {
    cache[name] = fetch(`/data/portal-comp-tool/${name}.json`).then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${name}.json (status ${res.status})`);
      return res.json();
    });
    cache[name].catch(() => delete cache[name]); // allow a retry after a failure
  }
  return cache[name];
}

function useJson(name, transform) {
  const [state, setState] = useState({ data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    loadJson(name)
      .then((json) => !cancelled && setState({ data: transform ? transform(json) : json, error: null }))
      .catch((err) => !cancelled && setState({ data: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [name, transform]);

  return state;
}

export function useTeams() {
  return useJson("teams");
}

// transfers.json is column-oriented ({ columns, rows }); turn it into records.
function toRecords({ columns, rows }) {
  return rows.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

export function useTransfers() {
  return useJson("transfers", toRecords);
}

export function teamSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Stats for the selected scope: "all" = 2021-2025 totals, otherwise one season.
// A transfer's own page: its id, then the name for a readable URL.
export const playerHref = (t) => `/portal-comp-tool/player/${t.transfer_id}-${teamSlug(t.full_name)}`;

export function teamStats(team, season) {
  return season === "all" ? team.totals : team.seasons[season] ?? null;
}

// --- formatting ---
// Cost is a 0-centered rating (0 = average, + above, - below, 10 = one standard
// deviation). Production is raw PPA ("points added"). Signed values always show
// their sign. Rates are 0-1 fractions.

export const fmtIndex = (v) => {
  if (v == null) return "–";
  const r = Math.round(v);
  return r > 0 ? `+${r}` : r < 0 ? `−${-r}` : "0";
};
// Published portal rating, as recruiting sites show it: .940 (no leading zero).
export const fmtRating = (v) => (v == null ? "–" : v.toFixed(3).replace(/^0/, ""));
export const fmtStars = (n) => (n == null ? "" : "★".repeat(n));
export const fmtPercent = (v) => (v == null ? "–" : `${Math.round(v * 100)}%`);
export const fmtPoints = (v) => {
  if (v == null) return "–";
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
};

// The actual − expected = difference equation, shared by every table and the guide.
// Actual and expected are rounded to tenths first and the difference is theirs, so
// the equation shown always adds up and actual matches the published PPA.
export const tenths = (v) => (v == null ? null : Math.round(v * 10) / 10);
export const fmtTenths = (v) => {
  if (v == null) return "–";
  const r = Math.round(v * 10) / 10;
  return r > 0 ? `+${r.toFixed(1)}` : r < 0 ? `−${(-r).toFixed(1)}` : "0.0";
};
// Actual and expected amounts: tenths, a "−" when negative but no "+".
export const fmtAmount = (v) => fmtTenths(v).replace("+", "");
// The subtracted term gets parentheses when negative: 0.3 − (−1.2) = +1.5.
export const fmtSubtracted = (v) => (v != null && Math.round(v * 10) < 0 ? `(${fmtAmount(v)})` : fmtAmount(v));
export const equation = (expectedValue, difference) => {
  if (expectedValue == null || difference == null) return { expected: null, difference: null, actual: null };
  const exp = tenths(expectedValue);
  const act = tenths(expectedValue + difference); // actual PPA is a published number: shown as is
  return { expected: exp, difference: tenths(act - exp), actual: act };
};

// Whole points added, for plain-English sentences.
export const fmtRaw = (v) => (v == null ? "–" : Math.round(v).toLocaleString());

export const fmtInt = (v) => (v == null ? "–" : Math.round(v).toLocaleString());

// The four positions PPA covers, in display order, with plural labels for filters.
export const POSITIONS = [
  { id: "QB", label: "Quarterbacks" },
  { id: "RB", label: "Running backs" },
  { id: "WR", label: "Wide receivers" },
  { id: "TE", label: "Tight ends" },
];

// One-line stat summary at the new school, chosen by position.
export function statLine(t) {
  if (!t.production_measured) return "Not scored (only QB, RB, WR and TE have PPA)";
  if (!t.played_after) return "Didn't play";
  const n = (v) => fmtInt(v ?? 0);
  const group = t.prod_ref_group_after ?? t.position_group;
  if (group === "QB") {
    return `${n(t.after_passing_YDS)} pass yds, ${n(t.after_passing_TD)} TD, ${n(t.after_rushing_YDS)} rush yds`;
  }
  if (group === "RB") {
    return `${n(t.after_rushing_YDS)} rush yds, ${n(t.after_rushing_TD)} TD, ${n(t.after_receiving_YDS)} rec yds`;
  }
  return `${n(t.after_receiving_REC)} rec, ${n(t.after_receiving_YDS)} yds, ${n(t.after_receiving_TD)} TD`;
}

// Difference pill color by place in the list shown: best = green, worst = red,
// through yellow in the middle. A light tint behind dark text of the same hue.
const rankHue = (i, n) => Math.round((n > 1 ? 1 - i / (n - 1) : 1) * 130); // 130 = best (green), 0 = worst (red)

export function rankColor(i, n) {
  const hue = rankHue(i, n);
  return { background: `hsl(${hue} 65% 86%)`, color: `hsl(${hue} 70% 22%)` };
}

// The same scale as a solid color, for chart dots.
export const rankFill = (i, n) => `hsl(${rankHue(i, n)} 70% 45%)`;
