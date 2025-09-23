"use client";

import { useEffect, useState } from "react";

type ToastProps = {
  message: string;
  type?: "success" | "error" | "info";
  durationMs?: number;
  onClose?: () => void;
};

export default function Toast({ message, type = "info", durationMs = 3000, onClose }: ToastProps) {
  const [enter, setEnter] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEnter(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!durationMs) return;
    const id = setTimeout(() => {
      setLeaving(true);
      // allow exit animation to play before unmount signal
      setTimeout(() => onClose?.(), 180);
    }, durationMs);
    return () => clearTimeout(id);
  }, [durationMs, onClose]);

  const bg = type === "success" ? "#10B981" : type === "error" ? "#EF4444" : "#3B82F6";

  const styleToast: React.CSSProperties = {
    ...toast,
    background: bg,
    opacity: enter && !leaving ? 1 : 0,
    transform: enter && !leaving ? "translateY(0)" : "translateY(-16px)",
  };

  return (
    <div style={wrap}>
      <div style={styleToast}>
        {message}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  top: 24,
  display: "flex",
  justifyContent: "center",
  zIndex: 1000,
  pointerEvents: "none",
};

const toast: React.CSSProperties = {
  color: "#fff",
  padding: "10px 16px",
  borderRadius: 999,
  boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
  fontWeight: 700,
  pointerEvents: "auto",
  transition: "transform 180ms ease, opacity 180ms ease",
};
