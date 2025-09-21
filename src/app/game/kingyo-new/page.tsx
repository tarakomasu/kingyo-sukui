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

const DurabilityBar = ({ value }: { value: number }) => (
  <div
    style={{
      position: "absolute",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "300px",
      height: "20px",
      background: "#e0e0e0",
      borderRadius: "10px",
      overflow: "hidden",
      border: "2px solid white",
    }}
  >
    <div
      style={{
        width: `${value}%`,
        height: "100%",
        background: "linear-gradient(to right, #4caf50, #8bc34a)",
        transition: "width 0.2s ease-out",
      }}
    />
  </div>
);

// --- Main Page Component ---

export default function KingyoNewPage() {
  const [gameState, setGameState] = useState("start"); // 'start', 'playing', 'finished'
  const [gameOverReason, setGameOverReason] = useState(""); // 'time', 'poi'
  const [score, setScore] = useState(0);
  const [caught, setCaught] = useState(0);
  const [missed, setMissed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [durability, setDurability] = useState(POI_DURABILITY_MAX);
  const [gameId, setGameId] = useState(1);

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
    setCaught(0);
    setMissed(0);
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

  const handleCatch = useCallback(() => {
    setScore((s) => s + 100);
    setCaught((c) => c + 1);
  }, []);

  const handleMiss = useCallback(() => {
    setMissed((m) => m + 1);
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#e6f7ff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          gap: 16,
          alignItems: "center",
          background: "#ffffffbb",
          backdropFilter: "blur(4px)",
          borderBottom: "1px solid #dbeafe",
        }}
      >
        <span style={{ fontWeight: 700 }}>Kingyo-sukui</span>
        <span>Score: {score}</span>
        <span>Caught: {caught}</span>
        <span>Missed: {missed}</span>
        <span style={{ marginLeft: "auto" }}>Time: {timeLeft}s</span>
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        <GameCanvas
          key={gameId}
          isPlaying={gameState === "playing"}
          onCatch={handleCatch}
          onMiss={handleMiss}
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
        {gameState === "playing" && <DurabilityBar value={durability} />}
      </div>
    </div>
  );
}
