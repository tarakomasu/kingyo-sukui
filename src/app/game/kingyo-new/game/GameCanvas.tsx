export type Vector2 = { x: number; y: number };

export type Fish = {
  id: string;
  position: Vector2;
  velocity: Vector2;
  radius: number;
};

export type Ripple = { x: number; y: number; t: number; life: number };

export type GameConfig = {
  spawnIntervalMs: number;
  maxFish: number;
  fishSpeedMin: number;
  fishSpeedMax: number;
  poiRadius: number;
};

export type GameCanvasProps = {
  onCatch: () => void;
  onMiss: () => void;
  config: GameConfig;
};

import React, { useEffect, useRef, useState, useCallback } from "react";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function length(a: Vector2, b: Vector2) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  onCatch,
  onMiss,
  config,
}) => {
  const gameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [pointer, setPointer] = useState<Vector2>({ x: -9999, y: -9999 });
  const fishRef = useRef<Fish[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);
  const lastSpawnRef = useRef<number>(0);
  const isSunkRef = useRef<boolean>(false);
  const bottomImageRef = useRef<HTMLImageElement | null>(null);
  const fishImageRef = useRef<HTMLImageElement | null>(null);
  const [isBottomImageLoaded, setIsBottomImageLoaded] = useState(false);
  const [isFishImageLoaded, setIsFishImageLoaded] = useState(false);

  // Stabilize callbacks
  const onCatchRef = useRef(onCatch);
  const onMissRef = useRef(onMiss);
  useEffect(() => {
    onCatchRef.current = onCatch;
    onMissRef.current = onMiss;
  }, [onCatch, onMiss]);

  // Load images
  useEffect(() => {
    const bottomImg = new Image();
    bottomImg.src = "/kingyo-sukui/back/hinoki3.png";
    bottomImg.onload = () => {
      bottomImageRef.current = bottomImg;
      setIsBottomImageLoaded(true);
    };

    const fishImg = new Image();
    fishImg.src = "/kingyo-sukui/kingyos/1758358301464.png";
    fishImg.onload = () => {
      fishImageRef.current = fishImg;
      setIsFishImageLoaded(true);
    };
  }, []);

  const drawBackground = useCallback(() => {
    const bgCanvas = backgroundCanvasRef.current;
    if (!bgCanvas || !bottomImageRef.current) return;
    const bgCtx = bgCanvas.getContext("2d");
    if (!bgCtx) return;

    const dpr = window.devicePixelRatio || 1;
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = bgCanvas.width / dpr;
    const h = bgCanvas.height / dpr;

    const pattern = bgCtx.createPattern(bottomImageRef.current, "repeat");
    if (pattern) {
      bgCtx.fillStyle = pattern;
      bgCtx.fillRect(0, 0, w, h);
    }

    const grad = bgCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(162, 212, 243, 0.2)");
    grad.addColorStop(1, "rgba(74, 144, 226, 0.2)");
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, w, h);
  }, []);

  useEffect(() => {
    if (isBottomImageLoaded) {
      drawBackground();
    }
  }, [isBottomImageLoaded, drawBackground]);

  // Resize canvases
  useEffect(() => {
    const gameCanvas = gameCanvasRef.current;
    const bgCanvas = backgroundCanvasRef.current;
    if (!gameCanvas || !bgCanvas) return;

    const resize = () => {
      const parent = gameCanvas.parentElement as HTMLElement;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      [gameCanvas, bgCanvas].forEach((canvas) => {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      });
      drawBackground();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(gameCanvas.parentElement as Element);
    return () => ro.disconnect();
  }, [drawBackground]);

  // Pointer handling
  useEffect(() => {
    const canvas = gameCanvasRef.current;
    if (!canvas) return;
    const canvasEl = canvas;

    function toLocal(e: PointerEvent): Vector2 {
      const rect = canvasEl.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function onMove(e: PointerEvent) {
      setPointer(toLocal(e));
    }
    function onLeave() {
      setPointer({ x: -9999, y: -9999 });
    }

    canvasEl.addEventListener("pointermove", onMove);
    canvasEl.addEventListener("pointerleave", onLeave);
    return () => {
      canvasEl.removeEventListener("pointermove", onMove);
      canvasEl.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  // Spawning and Main Game Loop
  useEffect(() => {
    if (!isFishImageLoaded) return; // Wait for fish image

    const canvas = gameCanvasRef.current;
    if (!canvas) return;
    const canvasEl = canvas;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    const ctxEl = ctx;

    const dpr = window.devicePixelRatio || 1;
    let last = performance.now();

    function spawn(now: number) {
      const rect = canvasEl.getBoundingClientRect();
      if (fishRef.current.length >= config.maxFish) return;
      if (now - lastSpawnRef.current < config.spawnIntervalMs) return;
      lastSpawnRef.current = now;
      const side = Math.random() < 0.5 ? "left" : "right";
      const y = randomRange(80, rect.height - 80);
      const speed =
        randomRange(config.fishSpeedMin, config.fishSpeedMax) *
        (side === "left" ? 1 : -1);
      const radius = randomRange(25, 40);
      const x = side === "left" ? -radius - 10 : rect.width + radius + 10;
      fishRef.current.push({
        id: Math.random().toString(36).slice(2),
        position: { x, y },
        velocity: { x: speed, y: randomRange(-20, 20) },
        radius,
      });
    }

    function update(dt: number, now: number) {
      spawn(now);
      fishRef.current = fishRef.current
        .map((f) => {
          const nx = f.position.x + f.velocity.x * dt;
          const ny = clamp(
            f.position.y + f.velocity.y * dt,
            40,
            canvasEl.height / dpr - 40
          );
          const newVy =
            ny <= 40 || ny >= canvasEl.height / dpr - 40
              ? -f.velocity.y
              : f.velocity.y;
          return {
            ...f,
            position: { x: nx, y: ny },
            velocity: { ...f.velocity, y: newVy },
          };
        })
        .filter(
          (f) =>
            f.position.x > -100 && f.position.x < canvasEl.width / dpr + 100
        );

      ripplesRef.current.forEach((r) => (r.t += dt));
      ripplesRef.current = ripplesRef.current.filter((r) => r.t < r.life);
    }

    function render(now: number) {
      const w = canvasEl.width / dpr;
      const h = canvasEl.height / dpr;
      ctxEl.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxEl.clearRect(0, 0, w, h);

      const highlightGrad = ctxEl.createLinearGradient(0, 0, w, h);
      const offset = Math.sin(now / 1200) * 0.3 + 0.5;
      highlightGrad.addColorStop(offset - 0.2, "rgba(255,255,255,0.0)");
      highlightGrad.addColorStop(offset, "rgba(255,255,255,0.25)");
      highlightGrad.addColorStop(offset + 0.2, "rgba(255,255,255,0.0)");
      ctxEl.fillStyle = highlightGrad;
      ctxEl.fillRect(0, 0, w, h);

      ripplesRef.current.forEach((r) => {
        const age = r.t;
        const radius = age * 90;
        const alpha = Math.max(0, 0.35 * (1 - age / r.life));
        ctxEl.beginPath();
        ctxEl.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctxEl.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctxEl.lineWidth = 1.5;
        ctxEl.stroke();
      });

      // Draw fish images
      if (fishImageRef.current) {
        for (const f of fishRef.current) {
          ctxEl.save();
          ctxEl.translate(f.position.x, f.position.y);
          const angle = Math.atan2(f.velocity.y, f.velocity.x);
          ctxEl.rotate(angle);
          // Flip image if moving left
          if (f.velocity.x < 0) {
            ctxEl.scale(1, -1);
          }
          ctxEl.drawImage(
            fishImageRef.current,
            -f.radius,
            -f.radius,
            f.radius * 2,
            f.radius * 2
          );
          ctxEl.restore();
        }
      }

      if (pointer.x > -1000) {
        const isSunk = isSunkRef.current;
        ctxEl.beginPath();
        const r = config.poiRadius + (isSunk ? 6 : 0);
        const alpha = isSunk ? 1.0 : 0.6;
        ctxEl.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctxEl.lineWidth = isSunk ? 5 : 3;
        ctxEl.arc(pointer.x, pointer.y, r, 0, Math.PI * 2);
        ctxEl.stroke();
        if (isSunk) {
          ctxEl.beginPath();
          ctxEl.fillStyle = `rgba(120, 180, 255, 0.08)`;
          ctxEl.arc(pointer.x, pointer.y, r - 2, 0, Math.PI * 2);
          ctxEl.fill();
        }
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt, now);
      render(now);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [config, pointer, drawBackground, isFishImageLoaded]);

  function addRipple(x: number, y: number) {
    ripplesRef.current.push({ x, y, t: 0, life: 2.5 });
    if (ripplesRef.current.length > 6) ripplesRef.current.shift();
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={backgroundCanvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 0,
          width: "100%",
          height: "100%",
        }}
      />
      <canvas
        ref={gameCanvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 1,
          width: "100%",
          height: "100%",
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          const el = e.currentTarget as HTMLCanvasElement;
          el.setPointerCapture(e.pointerId);
          isSunkRef.current = true;
          const rect = el.getBoundingClientRect();
          addRipple(e.clientX - rect.left, e.clientY - rect.top);
        }}
        onPointerUp={(e) => {
          const el = e.currentTarget as HTMLCanvasElement;
          el.releasePointerCapture(e.pointerId);
          if (isSunkRef.current) {
            const initialFishCount = fishRef.current.length;
            const fishCaught = fishRef.current.filter((f) => {
              const isHit =
                length(f.position, pointer) <= f.radius + config.poiRadius;
              return isHit;
            });
            fishRef.current = fishRef.current.filter(
              (f) => !fishCaught.includes(f)
            );

            if (fishCaught.length > 0) {
              fishCaught.forEach(() => onCatchRef.current());
            } else {
              onMissRef.current();
            }
          }
          isSunkRef.current = false;
        }}
      />
    </div>
  );
};
