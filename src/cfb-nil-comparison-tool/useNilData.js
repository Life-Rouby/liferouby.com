import { useEffect, useState } from "react";

// Data files written by projects/cfb-nil-comparison-tool/src/export_site_data.py.
// Each file is fetched once per page load and shared between views.
const cache = {};

function loadJson(name) {
  if (!cache[name]) {
    cache[name] = fetch(`/data/cfb-nil-comparison-tool/${name}.json`).then((res) => {
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
export function teamStats(team, season) {
  return season === "all" ? team.totals : team.seasons[season] ?? null;
}

// --- formatting ---
// Cost and production are 0-centered ratings (0 = average, + above, - below,
// 10 = one standard deviation), always shown with their sign. Rates are 0-1 fractions.

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

// The actual − expected = difference equation, shared by the leaderboard and the
// player table. Expected and the difference are rounded to tenths first and actual
// is their sum, so the equation shown always adds up.
export const tenths = (v) => (v == null ? null : Math.round(v * 10) / 10);
export const fmtTenths = (v) => {
  if (v == null) return "–";
  const r = Math.round(v * 10) / 10;
  return r > 0 ? `+${r.toFixed(1)}` : r < 0 ? `−${(-r).toFixed(1)}` : "0.0";
};
// The subtracted term gets parentheses when negative: +0.3 − (−1.2) = +1.5.
export const fmtSubtracted = (v) => (v != null && Math.round(v * 10) < 0 ? `(${fmtTenths(v)})` : fmtTenths(v));
export const equation = (expectedValue, difference) => {
  const exp = tenths(expectedValue);
  const diff = tenths(difference);
  return { expected: exp, difference: diff, actual: exp == null || diff == null ? null : exp + diff };
};

// Real-stat translation of production points: total PPA ("points added").
export const rawUnit = () => "points added";
export const fmtRaw = (v) => (v == null ? "–" : Math.round(v).toLocaleString());

export const fmtInt = (v) => (v == null ? "–" : Math.round(v).toLocaleString());
