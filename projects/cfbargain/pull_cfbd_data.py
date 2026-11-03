"""
Pull raw data from the CollegeFootballData.com API for the transfer portal ROI project.

Setup:
    1. Get a free API key at https://collegefootballdata.com/key
    2. pip install requests pandas
    3. export CFBD_API_KEY="your_key_here"   (Windows: set CFBD_API_KEY=your_key_here)
    4. python pull_cfbd_data.py

The free tier is limited to 1,000 calls per month, so every response is cached
to data/raw/ and skipped on later runs. A full pull is about 35 calls.
"""

import json
import os
import time
from pathlib import Path

import pandas as pd
import requests

API_KEY = os.environ.get("CFBD_API_KEY")
BASE_URL = "https://api.collegefootballdata.com"
RAW_DIR = Path("data/raw")

# Portal classes to study. Production is pulled one year earlier as well,
# so each transfer has a "before" season to compare against.
PORTAL_YEARS = range(2021, 2026)
STAT_YEARS = range(2020, 2026)

# name -> (endpoint, years, extra params)
ENDPOINTS = {
    "portal":      ("/player/portal",         PORTAL_YEARS, {}),
    "ppa":         ("/ppa/players/season",    STAT_YEARS,   {}),
    "usage":       ("/player/usage",          STAT_YEARS,   {}),
    "stats":       ("/stats/player/season",   STAT_YEARS,   {}),
    "recruiting":  ("/recruiting/players",    STAT_YEARS,   {"classification": "HighSchool"}),
    "teams_fbs":   ("/teams/fbs",             STAT_YEARS,   {}),
}


def fetch(endpoint: str, params: dict) -> list:
    headers = {"Authorization": f"Bearer {API_KEY}", "Accept": "application/json"}
    resp = requests.get(BASE_URL + endpoint, headers=headers, params=params, timeout=60)
    resp.raise_for_status()
    return resp.json()


def pull_all() -> None:
    if not API_KEY:
        raise SystemExit("Set the CFBD_API_KEY environment variable first.")
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    calls = 0
    for name, (endpoint, years, extra) in ENDPOINTS.items():
        for year in years:
            out_path = RAW_DIR / f"{name}_{year}.json"
            if out_path.exists():
                continue  # cached, don't spend an API call
            print(f"Fetching {name} {year} ...")
            data = fetch(endpoint, {"year": year, **extra})
            out_path.write_text(json.dumps(data))
            calls += 1
            time.sleep(0.5)  # be polite to the API
    print(f"Done. Used {calls} API calls this run.")


def load(name: str) -> pd.DataFrame:
    """Combine every cached year of one dataset into a single DataFrame."""
    frames = []
    for path in sorted(RAW_DIR.glob(f"{name}_*.json")):
        df = pd.json_normalize(json.loads(path.read_text()))
        df["pull_year"] = int(path.stem.split("_")[-1])
        frames.append(df)
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


if __name__ == "__main__":
    pull_all()
    portal = load("portal")
    print(f"\nPortal entries: {len(portal):,}")
    print(portal.columns.tolist())
    print(portal.head())
