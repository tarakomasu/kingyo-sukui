"use client";

import { useGame } from "@/context/GameContext";
import { useState } from "react";

// A reusable component to display objects neatly.
const CodeBlock = ({ data, title }: { data: any; title: string }) => (
  <div style={styles.block}>
    <h3 style={styles.blockTitle}>{title}</h3>
    <pre style={styles.pre}>
      <code>{JSON.stringify(data, null, 2)}</code>
    </pre>
  </div>
);

/**
 * This page serves as a live demonstration and documentation for how to use the `GameContext`.
 * It shows all the state and functions provided by the context and allows for interaction.
 */
export default function ContextExamplePage() {
  // 1. Destructure all state and functions from the useGame() hook.
  const {
    userName,
    setUserName,
    userScore,
    userScoreRank,
    leaderboardsData,
    ranking,
    loading,
    error,
    insertUserScore,
    updateScore,
  } = useGame();

  // Local state for the interactive form elements on this example page.
  const [nameInput, setNameInput] = useState("taro");
  const [gameIdInput, setGameIdInput] = useState("kingyo-sukui");
  const [scoreInput, setScoreInput] = useState(Math.round(Math.random() * 1000));
  const [rankingGameId, setRankingGameId] = useState("syateki");
  const [rankingTopN, setRankingTopN] = useState(5);

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>GameContext 使用サンプル</h1>
      <p style={styles.p}>
        このページは `GameContext` の機能と使い方を示すサンプルです。
      </p>

      {/* Section 1: Loading and Error State */}
      <div style={styles.section}>
        <h2 style={styles.h2}>1. 状態表示 (Loading & Error)</h2>
        <p>現在のコンテキストの状態です。データ取得中は `loading` が true になります。</p>
        <p>Loading: <strong>{loading.toString()}</strong></p>
        <p>Error: <strong>{error ? error : "null"}</strong></p>
      </div>

      {/* Section 2: User Management */}
      <div style={styles.section}>
        <h2 style={styles.h2}>2. ユーザー管理 (`userName`, `setUserName`)</h2>
        <p>現在のユーザー: <strong>{userName || "(Not Set)"}</strong></p>
        <p>新しいユーザー名を入力して `setUserName` を呼び出すと、そのユーザーのデータが自動的に読み込まれます。</p>
        <div style={styles.inputGroup}>
          <input 
            style={styles.input}
            value={nameInput} 
            onChange={(e) => setNameInput(e.target.value)} 
            placeholder="Enter user name"
          />
          <button style={styles.button} onClick={() => setUserName(nameInput)} disabled={loading}>
            ユーザーを設定
          </button>
        </div>
      </div>

      {/* Section 3: Displaying User-Specific Data */}
      <div style={styles.section}>
        <h2 style={styles.h2}>3. ユーザーデータの表示 (`userScore`, `userScoreRank`)</h2>
        <p>`userName` が設定されると、そのユーザーのハイスコアと、各ゲームでの全体順位が自動的に設定されます。</p>
        <div style={styles.grid}>
          <CodeBlock data={userScore} title="userScore (ユーザーのハイスコア)" />
          <CodeBlock data={userScoreRank} title="userScoreRank (ユーザーの順位)" />
        </div>
      </div>

      {/* Section 4: Inserting a New Score */}
      <div style={styles.section}>
        <h2 style={styles.h2}>4. スコアの追加 (`insertUserScore`)</h2>
        <p>
          `insertUserScore(gameId, score)` を呼び出すと、現在のユーザーの新しいスコアがデータベースに登録されます。
          <br />
          成功すると、自動的に `updateScore()` が呼ばれて全体のデータが更新されます。
        </p>
        <div style={styles.inputGroup}>
          <input style={styles.input} value={gameIdInput} onChange={(e) => setGameIdInput(e.target.value)} placeholder="Game ID" />
          <input style={styles.input} type="number" value={scoreInput} onChange={(e) => setScoreInput(Number(e.target.value))} placeholder="Score" />
          <button style={styles.button} onClick={() => insertUserScore(gameIdInput, scoreInput)} disabled={loading}>
            スコアを登録
          </button>
        </div>
      </div>

      {/* Section 5: Displaying Leaderboards */}
      <div style={styles.section}>
        <h2 style={styles.h2}>5. ランキングの表示 (`leaderboardsData`, `ranking`)</h2>
        <p>`leaderboardsData` には、すべてのゲームの完全なランキングデータが格納されています。</p>
        <p>`ranking(gameId, topN)` は、その中から指定したゲームの上位N件を簡単に取り出すためのヘルパー関数です。</p>
        <div style={styles.inputGroup}>
          <input style={styles.input} value={rankingGameId} onChange={(e) => setRankingGameId(e.target.value)} placeholder="Game ID" />
          <input style={styles.input} type="number" value={rankingTopN} onChange={(e) => setRankingTopN(Number(e.target.value))} placeholder="Top N" />
        </div>
        <CodeBlock data={ranking(rankingGameId, rankingTopN)} title={`ranking("${rankingGameId}", ${rankingTopN}) の結果`} />
        <CodeBlock data={leaderboardsData} title="leaderboardsData (すべてのランキングデータ)" />
      </div>

      {/* Section 6: Manual Update */}
      <div style={styles.section}>
        <h2 style={styles.h2}>6. 手動更新 (`updateScore`)</h2>
        <p>`updateScore()` を呼び出すと、サーバーからすべてのデータを手動で再取得できます。</p>
        <button style={styles.button} onClick={updateScore} disabled={loading}>
          {loading ? "更新中..." : "データを再取得"}
        </button>
      </div>
    </div>
  );
}

// --- Styles ---

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "sans-serif",
    padding: "24px",
    color: "#333",
    background: "#f9f9f9",
  },
  h1: {
    fontSize: "2rem",
    borderBottom: "2px solid #eee",
    paddingBottom: "8px",
  },
  h2: {
    fontSize: "1.5rem",
    marginTop: "32px",
    borderBottom: "1px solid #eee",
    paddingBottom: "8px",
  },
  p: {
    lineHeight: 1.6,
    color: "#555",
  },
  section: {
    background: "white",
    padding: "16px",
    borderRadius: "8px",
    marginTop: "16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "16px",
  },
  block: {
    background: "#2d2d2d",
    color: "white",
    borderRadius: "4px",
    padding: "16px",
  },
  blockTitle: {
    margin: "0 0 8px 0",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#a9dc76",
  },
  pre: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    fontSize: "0.9rem",
  },
  inputGroup: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  input: {
    padding: "8px 12px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "1rem",
  },
  button: {
    padding: "8px 16px",
    border: "none",
    background: "#007acc",
    color: "white",
    borderRadius: "4px",
    fontSize: "1rem",
    cursor: "pointer",
  },
};