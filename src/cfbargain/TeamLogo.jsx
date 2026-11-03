import { useState } from "react";

// Team logos are hotlinked from the CollegeFootballData CDN. If one fails to
// load, fall back to a badge in the team's color with its abbreviation.
export default function TeamLogo({ team, size = 28 }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (!team.logo || failed) {
    return (
      <span
        className="nil-logo nil-logo--fallback"
        style={{ ...style, background: team.color || "var(--text-muted)", fontSize: size * 0.32 }}
        aria-hidden="true"
      >
        {(team.abbreviation || team.team).slice(0, 4)}
      </span>
    );
  }
  return (
    <img
      className="nil-logo"
      src={team.logo}
      alt=""
      style={style}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
