import { useState } from "react";
import { useCfbowledgeData } from "./useCfbowledgeData";
import Home from "./Home";
import SeasonLineChart from "./SeasonLineChart";
import ParticipantDetail from "./ParticipantDetail";
import Standings from "./Standings";
import Matchups from "./Matchups";
import Predictions from "./Predictions";
import "./cfbowledge.css";

const TABS = [
  { id: "home", label: "Home" },
  { id: "week", label: "Weekly" },
  { id: "participants", label: "Participants" },
  { id: "predictions", label: "Predictions" },
];

export default function CFBowledgePage() {
  const { data, error } = useCfbowledgeData();
  const [week, setWeek] = useState(null);
  const [tab, setTab] = useState("home");
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);
  const [participantTab, setParticipantTab] = useState(null);

  if (error) {
    return (
      <div className="cfb-page">
        <p className="cfb-error">Couldn't load this week's data ({error}).</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="cfb-page">
        <p className="cfb-loading">Loading the slate…</p>
      </div>
    );
  }

  const weeks = data.picks.weeks;
  const latestPlayedWeek =
    [...weeks].reverse().find((w) =>
      data.participants.participants.some(
        (p) => (data.picks.participants[p.id]?.weeklyTotal?.[w] ?? 0) !== 0
      )
    ) ?? weeks[0];
  const currentWeek = week ?? latestPlayedWeek;
  const currentParticipantTab = participantTab ?? data.participants.participants[0]?.id;

  return (
    <div className="cfb-page">
      <header className="cfb-header">
        <button
          type="button"
          className="cfb-title-btn"
          onClick={() => {
            setSelectedParticipantId(null);
            setTab("home");
          }}
        >
          <h1 className="cfb-title">CFBowledge</h1>
        </button>
        {!selectedParticipantId && (
          <div className="cfb-tab-strip" role="tablist" aria-label="Select view">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={t.id === tab}
                className={`cfb-tab-btn${t.id === tab ? " is-active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="cfb-content">
        {selectedParticipantId ? (
          <ParticipantDetail
            participant={data.participants.participants.find((p) => p.id === selectedParticipantId)}
            picks={data.picks}
            onBack={() => setSelectedParticipantId(null)}
          />
        ) : (
          <>
            {tab === "home" && (
              <>
                <Home
                  participants={data.participants}
                  picks={data.picks}
                  onSelectParticipant={setSelectedParticipantId}
                />
                <SeasonLineChart participants={data.participants} picks={data.picks} />
              </>
            )}

            {tab === "week" && (
              <>
                <div className="cfb-week-strip" role="tablist" aria-label="Select week">
                  {weeks.map((w) => (
                    <button
                      key={w}
                      role="tab"
                      type="button"
                      aria-selected={w === currentWeek}
                      className={`cfb-week-btn${w === currentWeek ? " is-active" : ""}`}
                      onClick={() => setWeek(w)}
                    >
                      {w.replace("Week ", "")}
                    </button>
                  ))}
                </div>

                <Standings participants={data.participants} picks={data.picks} week={currentWeek} />
                <Matchups participants={data.participants} matchups={data.matchups} week={currentWeek} />
              </>
            )}

            {tab === "participants" && (
              <>
                <div className="cfb-week-strip" role="tablist" aria-label="Select participant">
                  {data.participants.participants.map((p) => (
                    <button
                      key={p.id}
                      role="tab"
                      type="button"
                      aria-selected={p.id === currentParticipantTab}
                      className={`cfb-week-btn${p.id === currentParticipantTab ? " is-active" : ""}`}
                      onClick={() => setParticipantTab(p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>

                <ParticipantDetail
                  participant={data.participants.participants.find((p) => p.id === currentParticipantTab)}
                  picks={data.picks}
                />
              </>
            )}

            {tab === "predictions" && (
              <Predictions participants={data.participants} predictions={data.predictions} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
