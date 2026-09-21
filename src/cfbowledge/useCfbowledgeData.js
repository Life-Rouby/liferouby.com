import { useEffect, useState } from "react";

const FILES = ["participants", "picks", "matchups", "predictions"];

// Fetches every data file from /data/*.json (served from public/data/ by Vite)
// and returns it as one object once everything has loaded.
export function useCfbowledgeData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      FILES.map((name) =>
        fetch(`/data/${name}.json`).then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to load ${name}.json (status ${res.status})`);
          }
          return res.json();
        })
      )
    )
      .then(([participants, picks, matchups, predictions]) => {
        if (!cancelled) {
          setData({ participants, picks, matchups, predictions });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error };
}
