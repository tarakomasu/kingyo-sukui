"use client";

import React, { useState } from "react";
import { GameCanvas } from "./game/GameCanvas";

export default function KingyoNewPage() {
  const [score, setScore] = useState(0);
  const [caught, setCaught] = useState(0);
  const [missed, setMissed] = useState(0);

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
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        <GameCanvas
          onCatch={() => {
            setScore((s) => s + 100);
            setCaught((c) => c + 1);
          }}
          onMiss={() => setMissed((m) => m + 1)}
          config={{
            spawnIntervalMs: 1400,
            maxFish: 12,
            fishSpeedMin: 40,
            fishSpeedMax: 120,
            poiRadius: 60,
          }}
        />
      </div>
    </div>
  );
}
