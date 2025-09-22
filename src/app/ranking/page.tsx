"use client";

import { useGame } from "@/context/GameContext";
import Link from "next/link";
import { useEffect } from "react";

// --- Reusable Components ---

const UserScoreCard = ({
  userName,
  userScore,
}: {
  userName: string;
  userScore: Record<string, number>;
}) => (
  <div style={cardStyle}>
    <h2 style={cardTitleStyle}>{userName}`s Scores</h2>
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {Object.keys(userScore).length > 0 ? (
        Object.entries(userScore).map(([game, score]) => (
          <div key={game} style={scoreRowStyle}>
            <span style={{ textTransform: "capitalize" }}>
              {game.replace("-", " ")}
            </span>
            <span style={{ fontWeight: "bold" }}>{score.toLocaleString()}</span>
          </div>
        ))
      ) : (
        <p style={{ color: "#999" }}>No scores yet.</p>
      )}
    </div>
  </div>
);

const RankingCard = ({
  title,
  data,
}: {
  title: string;
  data: { userName: string; score: number }[];
}) => (
  <div style={cardStyle}>
    <h2 style={cardTitleStyle}>{title}</h2>
    <ul>
      {data.length > 0 ? (
        data.map((entry, index) => (
          <li key={index} style={rankingItemStyle}>
            <span style={rankStyle(index + 1)}>{index + 1}</span>
            <span>{entry.userName}</span>
            <span style={{ marginLeft: "auto", fontWeight: "bold" }}>
              {entry.score.toLocaleString()}
            </span>
          </li>
        ))
      ) : (
        <p style={{ color: "#999", textAlign: "center" }}>
          No ranking data available.
        </p>
      )}
    </ul>
  </div>
);

// --- Main Page Component ---

export default function RankingPage() {
  const { userName, setUserName, userScore, ranking, loading } = useGame();

  // For demonstration purposes, if no user is set, set one.
  useEffect(() => {
    if (!userName) {
      setUserName("Player1");
    }
  }, [userName, setUserName]);

  const kingyoRanking = ranking("kingyo-new", 5);
  const syatekiRanking = ranking("syateki", 5); // Assuming 'syateki' is a gameId

  if (!userName) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p>Please set a user name on the main page to see rankings.</p>
          <Link href="/" style={{ color: "#3498db" }}>
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={containerStyle}>Loading rankings...</div>;
  }

  return (
    <main style={containerStyle}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          width: "100%",
          maxWidth: "600px",
        }}
      >
        <UserScoreCard userName={userName} userScore={userScore} />
        <RankingCard title="Kingyo Sukui Ranking" data={kingyoRanking} />
        <RankingCard title="Syateki Ranking" data={syatekiRanking} />
      </div>
    </main>
  );
}

// --- Styles ---

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "24px",
  background: "#2C2A4A",
  color: "white",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255, 255, 255, 0.05)",
  borderRadius: "12px",
  padding: "20px",
  border: "1px solid rgba(255, 255, 255, 0.1)",
};

const cardTitleStyle: React.CSSProperties = {
  margin: "0 0 16px 0",
  fontSize: "1.5rem",
  fontWeight: "bold",
  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
  paddingBottom: "12px",
};

const scoreRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
};

const rankingItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "12px 0",
  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
  gap: "16px",
};

const rankStyle = (rank: number): React.CSSProperties => ({
  fontWeight: "bold",
  fontSize: "1.2rem",
  width: "30px",
  textAlign: "center",
  color:
    rank === 1
      ? "#FFD700"
      : rank === 2
      ? "#C0C0C0"
      : rank === 3
      ? "#CD7F32"
      : "white",
});
