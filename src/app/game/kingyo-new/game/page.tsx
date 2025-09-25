'use client';

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useGame } from "@/context/GameContext";
import Toast from "@/components/Toast";
import { GameCanvas } from "./canvas-comp/GameCanvas";
import { useRouter } from "next/navigation";

const GAME_DURATION = 60; // seconds
const POI_DURABILITY_MAX = 1000;

// --- Components ---

const Modal = ({
  title,
  score,
  buttons,
}: {
  title: string;
  score: number | null;
  buttons: { text: string; onClick: () => void; className?: string }[];
}) => (
  <div className="absolute inset-0 bg-black bg-opacity-50 flex justify-center items-center z-10">
    <div className="bg-gray-800 border-2 border-yellow-400 p-8 rounded-lg text-center shadow-lg w-full max-w-sm">
      <h2 className="text-4xl font-bold text-yellow-300 mb-4">{title}</h2>
      {score !== null && (
        <p className="text-2xl text-white mb-6">Score: {score}</p>
      )}
      <div className="flex justify-center gap-4">
        {buttons.map((button, index) => (
          <button
            key={index}
            onClick={button.onClick}
            className={`text-lg px-6 py-3 rounded-lg font-semibold transition-transform transform hover:scale-105 ${button.className}`}>
            {button.text}
          </button>
        ))}
      </div>
    </div>
  </div>
);

const GameStatsChip = ({
  score,
  time,
  durability,
  durabilityValue,
}: {
  score: number;
  time: string;
  durability: number;
  durabilityValue: number;
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
          position: "relative",
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
      <span style={{ fontWeight: 700, fontSize: "1.2rem", color: "#000" }}>
        {durabilityValue}/{POI_DURABILITY_MAX}
      </span>
    </div>
  </div>
);

// --- Main Page Component ---

export default function KingyoNewPage() {
  const router = useRouter();
  const [gameState, setGameState] = useState("start"); // 'start', 'playing', 'finished'
  const [gameOverReason, setGameOverReason] = useState(""); // 'time', 'poi'
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [durability, setDurability] = useState(POI_DURABILITY_MAX);
  const [gameId, setGameId] = useState(1);
  const [catchEffect, setCatchEffect] = useState<string | null>(null);

  // --- Score submission via GameContext ---
  const { insertUserScore, userName } = useGame();
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const postedRef = useRef(false);

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

  // Reset post guard and clear messages when transitioning to non-result states
  useEffect(() => {
    if (gameState === "start" || gameState === "playing") {
      postedRef.current = false;
      setSubmitErr(null);
    }
  }, [gameState]);

  // Post score once when finished
  useEffect(() => {
    if (gameState !== "finished" || postedRef.current) return;
    postedRef.current = true;
    const gameTitle = "kingyo-sukui";
    if (!userName) {
      setSubmitMsg(null);
      setSubmitErr("スコア送信に失敗しました（ユーザー名が未設定）");
      return;
    }
    insertUserScore(gameTitle, score)
      .then(() => {
        setSubmitErr(null);
        setSubmitMsg("スコア送信に成功しました");
        setTimeout(() => setSubmitMsg(null), 3000);
      })
      .catch(() => {
        setSubmitMsg(null);
        setSubmitErr("スコア送信に失敗しました");
      });
  }, [gameState, score, insertUserScore, userName]);

  const startGame = useCallback(() => {
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setDurability(POI_DURABILITY_MAX);
    setGameState("playing");
    setGameId((id) => id + 1); // Reset GameCanvas state by changing key
  }, []);

  const handleGoToTop = () => {
    router.push('/game/kingyo-new');
  };

  const handleCatchEffect = useCallback((effect: string) => {
    setCatchEffect(effect);
    setTimeout(() => {
      setCatchEffect(null);
    }, 1000);
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
            durability={(durability / POI_DURABILITY_MAX) * 100}
            durabilityValue={durability}
          />
        )}
      </div>

      {catchEffect && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-yellow-400 z-10" style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.5)" }}>
          {catchEffect}
        </div>
      )}

      <div style={{ flex: 1, position: "relative" }}>
        <GameCanvas
          key={gameId}
          isPlaying={gameState === "playing"}
          onCatch={() => setScore((s) => s + 100)}
          onMiss={() => {}}
          onDurabilityChange={(d) => setDurability(Math.round(d))}
          onPoiBreak={handlePoiBreak}
          onCatchEffect={handleCatchEffect}
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
            buttons={[
              {
                text: "Start Game",
                onClick: startGame,
                className: "bg-red-600 hover:bg-red-700 text-white",
              },
            ]}
          />
        )}
        {gameState === "finished" && (
          <Modal
            title={gameOverReason}
            score={score}
            buttons={[
              {
                text: "トップへ戻る",
                onClick: handleGoToTop,
                className: "bg-gray-600 hover:bg-gray-700 text-white",
              },
              {
                text: "もう一度プレイ",
                onClick: startGame,
                className: "bg-red-600 hover:bg-red-700 text-white",
              },
            ]}
          />
        )}
      </div>
      {/* Toasts for score submission status */}
      {submitMsg && (
        <Toast
          message={submitMsg}
          type="success"
          onClose={() => setSubmitMsg(null)}
        />
      )}
      {submitErr && (
        <Toast
          message={submitErr}
          type="error"
          onClose={() => setSubmitErr(null)}
        />
      )}
    </div>
  );
}
