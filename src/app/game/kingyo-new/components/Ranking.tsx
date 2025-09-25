"use client";

import { useGame } from "@/context/GameContext";
import { useEffect } from "react";

const Ranking = () => {
  const {
    ranking,
    loading,
    error,
    updateScore,
    userName,
    userScore,
    userScoreRank,
  } = useGame();

  useEffect(() => {
    // Fetch scores when the component mounts or userName changes
    updateScore();
  }, [updateScore, userName]);

  const scores = ranking("kingyo-sukui", 10);
  const myScore = userScore["kingyo-sukui"];
  const myRank = userScoreRank["kingyo-sukui"];

  if (loading && scores.length === 0) {
    return <div className="text-center text-gray-400">読み込み中...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500">エラー: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => updateScore()}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-gray-500"
        >
          {loading ? "更新中..." : "ランキングを更新"}
        </button>
      </div>

      {userName && myScore !== undefined && (
        <div className="p-4 bg-yellow-600 bg-opacity-30 border-2 border-yellow-500 rounded-lg">
          <h3 className="text-lg font-bold text-center text-yellow-300">
            あなたのスコア
          </h3>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center">
              <span className="text-lg font-bold text-yellow-400 w-12">
                {myRank}位
              </span>
              <span className="ml-4 text-white">{userName}</span>
            </div>
            <span className="text-xl font-semibold text-green-400">
              {myScore}点
            </span>
          </div>
        </div>
      )}

      {scores.length > 0 ? (
        <ul className="space-y-2">
          {scores.map((score, index) => (
            <li
              key={score.id}
              className="flex items-center justify-between bg-gray-800 p-3 rounded-lg"
            >
              <div className="flex items-center">
                <span className="text-lg font-bold text-yellow-400 w-8">
                  {index + 1}位
                </span>
                <span className="ml-4 text-white">{score.user_name}</span>
              </div>
              <span className="text-xl font-semibold text-green-400">
                {score.score}点
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-gray-500">
          まだランキングがありません。
        </p>
      )}
    </div>
  );
};

export default Ranking;
