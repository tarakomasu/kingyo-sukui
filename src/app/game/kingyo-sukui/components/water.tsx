import React, { useRef, useEffect } from "react";

// 金魚すくいゲーム用の水面コンポーネント
// - 上から見た視点を意識
// - 光の反射を表現（揺れるハイライト）
// - タップした位置に静かに波紋が広がる
// - 派手な波は無く、穏やかな表現に

type Ripple = { x: number; y: number; t: number; life: number };

export default function GoldfishWater({
  className = "w-full h-64",
  isLongPressing = false,
}: {
  className?: string;
  isLongPressing?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const ripplesRef = useRef<Ripple[]>([]);

  useEffect(() => {
    const canvasEl = canvasRef.current as HTMLCanvasElement | null;
    if (!canvasEl) return;
    const ctx2d = canvasEl.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx2d) return;
    const canvasElSafe: HTMLCanvasElement = canvasEl;
    const ctx2dSafe: CanvasRenderingContext2D = ctx2d;

    let dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    function resize() {
      const rect = canvasElSafe.getBoundingClientRect();
      canvasElSafe.width = Math.round(rect.width * dpr);
      canvasElSafe.height = Math.round(rect.height * dpr);
      ctx2dSafe.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    function addRipple(x: number, y: number) {
      ripplesRef.current.push({ x, y, t: 0, life: 2.5 }); // 2.5秒で減衰
      if (ripplesRef.current.length > 6) ripplesRef.current.shift();
    }

    function onPointer(e: PointerEvent) {
      if (isLongPressing) return;
      const rect = canvasElSafe.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      addRipple(x, y);
    }

    canvasElSafe.addEventListener("pointerdown", onPointer);

    let last = performance.now();

    function render(now: number) {
      const dt = (now - last) / 1000;
      last = now;

      ripplesRef.current.forEach((r: Ripple) => (r.t += dt));
      ripplesRef.current = ripplesRef.current.filter(
        (r: Ripple) => r.t < r.life
      );

      const w = canvasElSafe.width / dpr;
      const h = canvasElSafe.height / dpr;
      ctx2dSafe.clearRect(0, 0, w, h);

      // 水のベース色
      const grad = ctx2dSafe.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#a2d4f3");
      grad.addColorStop(1, "#4a90e2");
      ctx2dSafe.fillStyle = grad;
      ctx2dSafe.fillRect(0, 0, w, h);

      // 光の反射（動くハイライト）
      const highlightGrad = ctx2dSafe.createLinearGradient(0, 0, w, h);
      const offset = Math.sin(now / 1200) * 0.3 + 0.5;
      highlightGrad.addColorStop(offset - 0.2, "rgba(255,255,255,0.15)");
      highlightGrad.addColorStop(offset, "rgba(255,255,255,0.35)");
      highlightGrad.addColorStop(offset + 0.2, "rgba(255,255,255,0.1)");
      ctx2dSafe.fillStyle = highlightGrad;
      ctx2dSafe.fillRect(0, 0, w, h);

      // 波紋の描画
      ripplesRef.current.forEach((r: Ripple) => {
        const age = r.t;
        const radius = age * 90; // 波紋の広がる速さ
        const alpha = Math.max(0, 0.35 * (1 - age / r.life));

        ctx2dSafe.beginPath();
        ctx2dSafe.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctx2dSafe.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx2dSafe.lineWidth = 1.5;
        ctx2dSafe.stroke();
      });

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      canvasElSafe.removeEventListener("pointerdown", onPointer);
    };
  }, [isLongPressing]);

  return (
    <div
      className={className}
      style={{ position: "relative", overflow: "hidden" }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "manipulation",
        }}
      />
    </div>
  );
}
