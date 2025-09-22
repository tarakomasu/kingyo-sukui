"use client";

import { useEffect, useMemo, useState } from "react";
import { useGame } from "@/context/GameContext";

export default function UserNameModal() {
  const { userName, setUserName, loading } = useGame();
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [mode, setMode] = useState<"choice" | "new">("choice");
  const [checking, setChecking] = useState(false);
  const [skipCheck, setSkipCheck] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Load saved name from localStorage on mount (do not auto-apply)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("game_user_name") || "";
      setSavedName(saved);
    } catch {
      // ignore
    }
  }, []);

  // Open modal only when there's no username
  useEffect(() => {
    setOpen(!userName);
  }, [userName]);

  const disabled = useMemo(() => loading || checking || !name.trim(), [loading, checking, name]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setDupError(null);
    if (skipCheck) {
      try {
        localStorage.setItem("game_user_name", trimmed);
      } catch {}
      setUserName(trimmed);
      return;
    }
    setChecking(true);
    try {
      const qs = new URLSearchParams({ limit: "1", user_name: trimmed, orderBy: "created_at" });
      const res = await fetch(`/api/scores?${qs.toString()}`);
      if (!res.ok) throw new Error("名前チェックに失敗しました");
      const rows: any[] = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        setDupError("このなまえは既に使われています。別のなまえにしてね。");
        return;
      }
      try {
        localStorage.setItem("game_user_name", trimmed);
      } catch {}
      setUserName(trimmed);
    } catch (e) {
      setDupError("名前チェックに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setChecking(false);
    }
  };

  if (!open) return null;

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="username-title">
        {mode === "choice" ? (
          <>
            <h2 id="username-title" style={styles.title}>おなまえをえらんでね</h2>
            {savedName ? (
              <p style={styles.desc}>前回のなまえ: <strong>{savedName}</strong></p>
            ) : (
              <p style={styles.desc}>はじめてのひとは新しいなまえをえらんでね。</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                style={styles.button}
                onClick={() => {
                  setMode("new");
                  setSkipCheck(false);
                  setName("");
                  setDupError(null);
                }}
              >
                あたらしい名前を使う
              </button>
              <button
                style={styles.secondaryButton}
                onClick={() => {
                  setMode("new");
                  setSkipCheck(true);
                  setName(savedName);
                  setDupError(null);
                }}
              >
                前回と同じ名前を使う
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="username-title" style={styles.title}>おなまえを入力してね</h2>
            <p style={styles.desc}>ランキングに表示するなまえを入力します。</p>
            <div style={styles.row}>
              <input
                style={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="たろう など"
                maxLength={20}
                autoFocus
              />
            </div>
            {dupError && (
              <p style={{ color: "#B91C1C", marginTop: 8 }}>{dupError}</p>
            )}
            <div style={styles.actionsRow}>
              <button
                style={styles.secondaryButton}
                onClick={() => setMode("choice")}
              >
                もどる
              </button>
              <button style={styles.button} onClick={handleSubmit} disabled={disabled}>
                登録
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    width: "min(92vw, 520px)",
    background: "#ffffff",
    color: "#222",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  title: {
    fontSize: "1.25rem",
    margin: 0,
    marginBottom: 8,
  },
  desc: {
    margin: 0,
    marginBottom: 12,
    color: "#555",
    fontSize: "0.95rem",
  },
  row: {
    display: "flex",
    gap: 8,
  },
  actionsRow: {
    display: "flex",
    gap: 8,
    marginTop: 12,
    justifyContent: "flex-end",
  },
  input: {
    flex: 1,
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: 8,
    fontSize: "1rem",
    outline: "none",
  },
  button: {
    padding: "10px 16px",
    border: "none",
    background: "#007acc",
    color: "white",
    borderRadius: 8,
    fontSize: "1rem",
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "10px 16px",
    border: "1px solid #ccc",
    background: "#fff",
    color: "#333",
    borderRadius: 8,
    fontSize: "1rem",
    cursor: "pointer",
  },
};
