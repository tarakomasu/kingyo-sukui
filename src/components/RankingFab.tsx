"use client";

import { useMemo, useState } from "react";
import { useGame } from "@/context/GameContext";

export default function RankingFab() {
  const { userName, userScore, userScoreRank, leaderboardsData, loading, setUserName } = useGame() as ReturnType<typeof useGame> & { setUserName: (name: string) => void };
  const [open, setOpen] = useState(false);

  const games = useMemo(() => Object.keys(leaderboardsData || {}), [leaderboardsData]);

  return (
    <>
      {/* FAB */}
      <button
        aria-label="ランキングを見る"
        onClick={() => setOpen(true)}
        style={fabStyle}
      >
        🏆 ランキング
      </button>

      {/* Drawer/Panel */}
      {open && (
        <div style={backdropStyle} onClick={() => setOpen(false)}>
          <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
            <div style={panelHeaderStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>🏆</span>
                <h3 style={{ margin: 0 }}>ランキングを見る</h3>
              </div>
              <button style={closeBtnStyle} onClick={() => setOpen(false)}>✕</button>
            </div>

            <div style={{ padding: "8px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "6px 0", color: "#666" }}>
                <div>ユーザー名: <strong>{userName || "(未設定)"}</strong></div>
                <button
                  onClick={() => {
                    try {
                      if (userName) localStorage.setItem("rename_prev_user_name", userName);
                      localStorage.setItem("rename_in_progress", "1");
                    } catch {}
                    setUserName("");
                    setOpen(false);
                  }}
                  style={changeBtnStyle}
                >
                  なまえをかえる
                </button>
              </div>
              {loading && <p style={{ margin: "6px 0", color: "#666" }}>読み込み中...</p>}

              <div style={listStyle}>
                {games.length === 0 && (
                  <p style={{ margin: 0, color: "#666" }}>まだランキング情報がありません。</p>
                )}
                {games.map((g) => {
                  const score = userScore[g];
                  const rank = userScoreRank[g];
                  return (
                    <div key={g} style={itemStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{g}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>あなたの記録</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700 }}>{score ?? "-"}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>{rank ? `第 ${rank} 位` : "順位なし"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const fabStyle: React.CSSProperties = {
  position: "fixed",
  right: 16,
  top: 16,
  zIndex: 999,
  padding: "12px 16px",
  borderRadius: 999,
  border: "none",
  background: "#F59E0B",
  color: "#111",
  fontWeight: 700,
  boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
  cursor: "pointer",
};

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  zIndex: 1000,
  display: "flex",
  justifyContent: "flex-end",
};

const panelStyle: React.CSSProperties = {
  width: "min(92vw, 420px)",
  height: "100%",
  background: "#fff",
  color: "#111",
  boxShadow: "-8px 0 24px rgba(0,0,0,0.2)",
  display: "flex",
  flexDirection: "column",
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  borderBottom: "1px solid #eee",
};

const closeBtnStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 20,
  cursor: "pointer",
};

const changeBtnStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  background: "#fff",
  color: "#333",
  borderRadius: 8,
  fontSize: 12,
  padding: "6px 10px",
  cursor: "pointer",
};

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginTop: 8,
};

const itemStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  border: "1px solid #eee",
  background: "#fafafa",
};
