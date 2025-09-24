"use client";

import { useMemo, useState } from "react";
import { useGame } from "@/context/GameContext";

export default function RankingFab() {
  const { userName, userScore, userScoreRank, leaderboardsData, loading, setUserName, ranking } = useGame() as ReturnType<typeof useGame> & { setUserName: (name: string) => void };
  const [open, setOpen] = useState(false);

  const games = useMemo(() => Object.keys(leaderboardsData || {}), [leaderboardsData]);

  function gameEmoji(title: string) {
    const t = title.toLowerCase();
    if (t.includes("kingyo")) return "🐟🏮";
    if (t.includes("goldfish")) return "🐠🎆";
    if (t.includes("射的") || t.includes("syateki")) return "🎯🏮";
    return "🎪🎈";
  }

  function displayTitle(id: string) {
    switch (id) {
      case "kingyo-sukui":
      case "kingyo":
        return "金魚すくい";
      case "syateki":
        return "射的";
      case "yamaneko-syateki-long":
        return "やまねこ射的（遠距離）";
      case "yamaneko-syateki-mid":
        return "やまねこ射的（中距離）";
      default:
        return id; // その他はDBのまま表示
    }
  }

  function rankBadgeColor(rank: number) {
    if (rank === 1) return "linear-gradient(135deg,#FFD700,#FFC107)"; // gold
    if (rank === 2) return "linear-gradient(135deg,#C0C0C0,#E0E0E0)"; // silver
    if (rank === 3) return "linear-gradient(135deg,#CD7F32,#D1904B)"; // bronze
    return "#eee";
  }

  function topRowBg(idx: number) {
    if (idx === 0) return "rgba(255,215,0,0.15)";
    if (idx === 1) return "rgba(192,192,192,0.15)";
    if (idx === 2) return "rgba(205,127,50,0.15)";
    return "#fff";
  }

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

            <div style={panelScrollAreaStyle}>
              {/* User summary section */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "4px 0 12px", color: "#444" }}>
                <div style={{ fontSize: 14 }}>いまのなまえ: <strong style={{ fontSize: 15 }}>{userName || "(未設定)"}</strong></div>
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
                >なまえをかえる</button>
              </div>
              {loading && <p style={{ margin: "4px 0 12px", color: "#666" }}>読み込み中...</p>}

              <h4 style={sectionTitleStyle}>あなたの順位まとめ</h4>
              <div style={userRankListStyle}>
                {games.length === 0 && (
                  <div style={{ fontSize: 12, color: "#666" }}>まだスコアがありません。</div>
                )}
                {games.map(g => {
                  const rank = userScoreRank[g];
                  const score = userScore[g];
                  return (
                    <div key={`summary-${g}`} style={userRankRowStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{gameEmoji(g)}</span>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{displayTitle(g)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          background: rank ? rankBadgeColor(rank) : "#ddd",
                          color: rank && rank <= 3 ? "#111" : "#333",
                          minWidth: 58,
                          textAlign: "center",
                        }}>{rank ? `第 ${rank} 位` : "-"}</span>
                        <span style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>{score ?? "-"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <h4 style={{ ...sectionTitleStyle, marginTop: 20 }}>リーダーボード</h4>
              <div style={listStyle}>
                {games.length === 0 && (
                  <p style={{ margin: 0, color: "#666" }}>まだランキング情報がありません。</p>
                )}
                {games.map((g) => {
                  const top = ranking ? ranking(g, 5) : [];
                  return (
                    <div key={g} style={itemStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span>{gameEmoji(g)}</span>
                        <div style={{ fontWeight: 700 }}>{displayTitle(g)}</div>
                      </div>
                      <div style={topListStyle}>
                        {top.length === 0 && (
                          <div style={{ color: "#777", fontSize: 12 }}>データなし</div>
                        )}
                        {top.map((row, idx) => {
                          const isSelf = userName && row.user_name === userName;
                          return (
                            <div
                              key={`${g}-${row.id || row.user_name}-${idx}`}
                              style={{
                                ...topRowStyle,
                                background: topRowBg(idx),
                                border: idx < 3 ? "1px solid rgba(0,0,0,0.08)" : "1px solid #eee",
                                boxShadow: idx < 3 ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                                ...(isSelf ? {
                                  border: "2px solid #dc2626",
                                  position: "relative",
                                } : {}),
                              }}
                            >
                              <span style={{
                                ...rankBadgeStyle,
                                background: rankBadgeColor(idx + 1),
                                color: idx < 3 ? "#111" : "#333",
                              }}>{idx + 1}</span>
                              <span style={{ flex: 1, fontWeight: idx < 3 ? 700 : 500 }}>
                                {row.user_name}
                                {isSelf && <span style={{ marginLeft: 6, fontSize: 10, color: '#dc2626', fontWeight: 700 }}>あなた</span>}
                              </span>
                              <span style={{ fontWeight: 700 }}>{row.score.toLocaleString?.() ?? row.score}</span>
                            </div>
                          );
                        })}
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
  overflow: "hidden",
};

const panelScrollAreaStyle: React.CSSProperties = {
  padding: "8px 16px",
  flex: 1,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  minHeight: 0,
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

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 6px",
  fontSize: 13,
  letterSpacing: "0.5px",
  fontWeight: 700,
  color: "#333",
  textTransform: "uppercase",
};

const userRankListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginBottom: 12,
};

const userRankRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 10px",
  borderRadius: 8,
  background: "#f7f7f7",
  border: "1px solid #ececec",
};

const topListStyle: React.CSSProperties = {
  marginTop: 8,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const topRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  padding: "6px 8px",
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 6,
};

const rankBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  borderRadius: 999,
  background: "#eee",
  fontWeight: 700,
};

const itemStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  border: "1px solid #eee",
  background: "#fafafa",
};
