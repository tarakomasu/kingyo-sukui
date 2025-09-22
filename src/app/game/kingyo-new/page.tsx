"use client";

import React, { useState, useEffect, useCallback } from "react";
import { GameCanvas } from "./game/GameCanvas";

const GAME_DURATION = 60; // seconds
const POI_DURABILITY_MAX = 100;

// --- Components ---

const Modal = ({
  title,
  score,
  buttonText,
  onButtonClick,
}: {
  title: string;
  score: number | null;
  buttonText: string;
  onButtonClick: () => void;
}) => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    }}
  >
    <div
      style={{
        background: "white",
        padding: "24px 40px",
        borderRadius: "12px",
        textAlign: "center",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}
    >
      <h2 style={{ fontSize: "2.5rem", margin: "0 0 16px" }}>{title}</h2>
      {score !== null && (
        <p style={{ fontSize: "1.5rem", margin: "0 0 24px" }}>Score: {score}</p>
      )}
      <button
        onClick={onButtonClick}
        style={{
          fontSize: "1.2rem",
          padding: "12px 24px",
          borderRadius: "8px",
          border: "none",
          background: "#2a9df4",
          color: "white",
          cursor: "pointer",
        }}
      >
        {buttonText}
      </button>
    </div>
  </div>
);

const GameStatsChip = ({
  score,
  time,
  durability,
}: {
  score: number;
  time: string;
  durability: number;
}) => (
  <div
    style={{
      padding: "8px 20px",
      background: "rgba(255, 255, 255, 0.8)",
      borderRadius: "20px",
      backdropFilter: "blur(5px)",
      border: "1px solid rgba(255, 255, 255, 0.9)",
      display: "flex",
      alignItems: "center",
      gap: "16px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    }}
  >
    {/* Score */}
    <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
      <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#555" }}>
        SCORE
      </span>
      <span style={{ fontWeight: 700, fontSize: "1.2rem", color: "#000" }}>
        {score}
      </span>
    </div>

    <div style={{ width: "1px", height: "24px", background: "#ddd" }} />

    {/* Time */}
    <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
      <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#555" }}>
        TIME
      </span>
      <span style={{ fontWeight: 700, fontSize: "1.2rem", color: "#000" }}>
        {time}
      </span>
    </div>

    <div style={{ width: "1px", height: "24px", background: "#ddd" }} />

    {/* Durability */}
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#555" }}>
        HP
      </span>
      <div
        style={{
          width: "80px",
          height: "10px",
          background: "#e0e0e0",
          borderRadius: "5px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${durability}%`,
            height: "100%",
            background: `linear-gradient(to right, ${
              durability > 50
                ? "#4caf50"
                : durability > 20
                ? "#ffeb3b"
                : "#f44336"
            }, ${
              durability > 50
                ? "#8bc34a"
                : durability > 20
                ? "#ffc107"
                : "#e57373"
            })`,
            transition: "width 0.2s ease-out, background 0.5s ease",
          }}
        ></div>
      </div>
    </div>
  </div>
);

// --- Main Page Component ---

export default function KingyoNewPage() {
  const [gameState, setGameState] = useState("start"); // 'start', 'playing', 'finished'
  const [gameOverReason, setGameOverReason] = useState(""); // 'time', 'poi'
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [durability, setDurability] = useState(POI_DURABILITY_MAX);
  const [gameId, setGameId] = useState(1);

  // Effect to handle mobile viewport height
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    return () => window.removeEventListener("resize", setVh);
  }, []);

  // Game timer
  useEffect(() => {
    if (gameState !== "playing") return;

    if (timeLeft <= 0) {
      setGameState("finished");
      setGameOverReason("Time's Up!");
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  const startGame = useCallback(() => {
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setDurability(POI_DURABILITY_MAX);
    setGameState("playing");
    setGameId((id) => id + 1); // Reset GameCanvas state by changing key
  }, []);

  const handlePoiBreak = useCallback(() => {
    if (gameState === "playing") {
      setGameState("finished");
      setGameOverReason("Poi Broke!");
    }
  }, [gameState]);

  return (
    <div
      style={{
        width: "100vw",
        height: "calc(var(--vh, 1vh) * 100)", // Use dynamic vh
        overflow: "hidden",
        background: "#e6f7ff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 5,
        }}
      >
        {gameState === "playing" && (
          <GameStatsChip
            score={score}
            time={`${timeLeft}s`}
            durability={durability}
          />
        )}
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        <GameCanvas
          key={gameId}
          isPlaying={gameState === "playing"}
          onCatch={() => setScore((s) => s + 100)}
          onMiss={() => {}}
          onDurabilityChange={setDurability}
          onPoiBreak={handlePoiBreak}
          config={{
            spawnIntervalMs: 1400,
            maxFish: 12,
            fishSpeedMin: 40,
            fishSpeedMax: 120,
            poiRadius: 60,
          }}
        />
        {gameState === "start" && (
          <Modal
            title="Kingyo Sukui"
            score={null}
            buttonText="Start Game"
            onButtonClick={startGame}
          />
        )}
        {gameState === "finished" && (
          <Modal
            title={gameOverReason}
            score={score}
            buttonText="Restart Game"
            onButtonClick={startGame}
          />
        )}
      </div>
    </div>
  );
}
