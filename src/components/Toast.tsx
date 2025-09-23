"use client";

import { useEffect } from "react";

type ToastProps = {
  message: string;
  type?: "success" | "error" | "info";
  durationMs?: number;
  onClose?: () => void;
};

export default function Toast({ message, type = "info", durationMs = 3000, onClose }: ToastProps) {
  useEffect(() => {
    if (!durationMs) return;
    const id = setTimeout(() => onClose?.(), durationMs);
    return () => clearTimeout(id);
  }, [durationMs, onClose]);

  const bg = type === "success" ? "#10B981" : type === "error" ? "#EF4444" : "#3B82F6";

  return (
    <div style={wrap}>
      <div style={{ ...toast, background: bg }}>
        {message}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 24,
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
};
