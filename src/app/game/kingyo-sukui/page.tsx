"use client";

import { useState, useRef } from "react";
import WaterCanvas from "./components/water";

// 2D Poi Component using DOM elements
function Poi2D({
  x,
  y,
  isPressed,
  isSinking,
}: {
  x: number;
  y: number;
  isPressed: boolean;
  isSinking: boolean;
}) {
  const poiStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    transform: `translate(${x}px, ${y}px)`,
    pointerEvents: "none", // Make sure it doesn't block clicks on the water
  };

  if (isSinking) {
    poiStyle.transform = `translate(${x}px, ${y + 80}px) rotate(15deg)`; // Sink and tilt
  }

  const paperStyle: React.CSSProperties = {
    width: "120px",
    height: "120px",
    backgroundColor: isPressed
      ? "rgba(255, 255, 255, 0.3)"
      : "rgba(255, 255, 255, 0.8)",
    border: "8px solid pink",
    borderRadius: "50%",
    boxShadow: isPressed ? "inset 0 0 20px rgba(0,0,0,0.2)" : "none",
    transform: isPressed ? "scale(0.95)" : "scale(1)",
    transition: "all 0.2s ease",
  };

  const handleStyle: React.CSSProperties = {
    width: "12px",
    height: "80px",
    backgroundColor: "pink",
    position: "absolute",
    left: "calc(50% - 6px)", // Center the handle
    top: "120px", // Position it below the paper
  };

  return (
    <div style={poiStyle}>
      <div style={paperStyle}></div>
      <div style={handleStyle}></div>
    </div>
  );
}

// 2D Goldfish Component
function Goldfish2D({ x, y }: { x: number; y: number }) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width: "50px",
    height: "25px",
    backgroundColor: "orange",
    borderRadius: "50% / 60% 60% 40% 40%",
    boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
    pointerEvents: "none",
  };
  return <div style={style}></div>;
}

export default function Game() {
  const [isPressed, setIsPressed] = useState(false);
  const [isSinking, setIsSinking] = useState(false);
  const [pointer, setPointer] = useState({ x: -100, y: 0 });
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameContainerRef.current) {
      const rect = gameContainerRef.current.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const pageX = (e as any).pageX ?? e.clientX + scrollX;
      const pageY = (e as any).pageY ?? e.clientY + scrollY;
      const x = pageX - (rect.left + scrollX);
      const y = pageY - (rect.top + scrollY);
      setPointer({ x, y });
    }
  };

  const handlePointerDown = () => {
    setIsPressed(true);
    pressTimer.current = setTimeout(() => {
      setIsSinking(true);
    }, 500); // 500ms for long press
  };

  const handlePointerUp = () => {
    setIsPressed(false);
    setIsSinking(false);
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  // Adjust poi position so that the handle tip aligns with the cursor
  // Horizontal: center by half of paper outer (120 + border*2=16) => 68
  // Vertical: paper 120 + handle 80 => 200
  const poiX = pointer.x - 68;
  const poiY = pointer.y - 200;

  return (
    <div
      ref={gameContainerRef}
      style={{
        width: "100vw",
        height: "100vh",
        cursor: "none",
        overflow: "hidden",
      }}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        setIsPressed(false);
        setIsSinking(false);
        if (pressTimer.current) {
          clearTimeout(pressTimer.current);
        }
        setPointer({ x: -1000, y: -1000 }); // Hide poi when leaving
      }}
    >
      {/* Water background - it has its own pointer events for ripples */}
      <WaterCanvas
        className="absolute top-0 left-0 w-full h-full"
        isLongPressing={isSinking}
      />

      {/* Game objects container */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <Goldfish2D x={300} y={400} />
        <Goldfish2D x={500} y={450} />
        <Poi2D x={poiX} y={poiY} isPressed={isPressed} isSinking={isSinking} />
      </div>
    </div>
  );
}
