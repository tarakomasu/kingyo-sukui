"use client";

import { useGame } from "@/context/GameContext";
import { useEffect } from "react";

export default function ScoreBoard() {
  const { userName, setUserName, userScore, ranking, updateScore, loading } =
    useGame();

  // On component mount, set a user name to trigger the data fetch in the context.
  useEffect(() => {
    setUserName("Guest");
  }, [setUserName]); // Dependency array ensures this runs only once.

  // Display a loading state until the initial data is fetched.
  if (loading && Object.keys(userScore).length === 0) {
    return <div>Loading scores...</div>;
  }

  return (
    <div style={{ padding: "20px", color: "black", background: "white" }}>
      <h2>{userName} さんのスコア</h2>
      <p>Game1: {userScore["game1"] || "N/A"}</p>
      <p>Game2: {userScore["game2"] || "N/A"}</p>

      <button onClick={updateScore} disabled={loading}>
        {loading ? "Refreshing..." : "スコア挿入後にリフレッシュ"}
      </button>

      <h3>Game1 ランキング</h3>
      <ul>
        {(ranking("game1", 10) ?? []).map((entry, index) => (
          <li key={index.toString()}>
            {entry.userName}: {entry.score.toString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
