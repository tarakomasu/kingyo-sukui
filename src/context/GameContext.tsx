"use client";

import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
} from "react";

// --- Type Definitions ---

// The full score object, matching the database row
interface ScoreRow {
  id: string;
  user_name: string;
  game_title: string;
  score: number;
  created_at: string;
}

interface UserScore {
  [gameId: string]: number;
}

interface UserScoreRank {
  [gameId: string]: number;
}

interface AllLeaderboards {
  [gameId: string]: ScoreRow[];
}

interface GameContextType {
  userName: string;
  setUserName: (name: string) => void;
  userScore: UserScore;
  userScoreRank: UserScoreRank;
  leaderboardsData: AllLeaderboards;
  ranking: (gameId: string, topN: number) => ScoreRow[];
  loading: boolean;
  error: string | null;
  insertUserScore: (gameId: string, score: number) => Promise<void>;
  updateScore: () => Promise<void>;
}

// --- Context Creation ---

const GameContext = createContext<GameContextType | undefined>(undefined);

// --- Provider Component ---

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [userName, setUserName] = useState<string>("");
  const [userScore, setUserScore] = useState<UserScore>({});
  const [userScoreRank, setUserScoreRank] = useState<UserScoreRank>({});
  const [leaderboardsData, setLeaderboardsData] = useState<AllLeaderboards>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches all score data and processes it to update the context state.
   */
  const updateScore = useCallback(async () => {
    if (!userName) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/scores?limit=2000&orderBy=score`);
      if (!res.ok) {
        throw new Error(`Failed to fetch scores: ${res.statusText}`);
      }
      const allScores: ScoreRow[] = await res.json();

      const leaderboards: AllLeaderboards = {};
      const scores: UserScore = {};
      const ranks: UserScoreRank = {};

      // First, group all scores by game to create leaderboards
      for (const row of allScores) {
        if (!leaderboards[row.game_title]) {
          leaderboards[row.game_title] = [];
        }
        leaderboards[row.game_title].push(row); // Store the full ScoreRow object
      }

      // Then, iterate through the created leaderboards to find user's score and rank
      for (const gameId in leaderboards) {
        const gameLeaderboard = leaderboards[gameId];
        
        const userIndex = gameLeaderboard.findIndex(
          (entry) => entry.user_name === userName
        );
        if (userIndex !== -1) {
          ranks[gameId] = userIndex + 1;
          scores[gameId] = gameLeaderboard[userIndex].score;
        }
      }
      
      setLeaderboardsData(leaderboards);
      setUserScore(scores);
      setUserScoreRank(ranks);

    } catch (err: any) {
      console.error("Failed to update score data:", err);
      setError(err.message || "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  }, [userName]);

  /**
   * Inserts a new score for the current user and refreshes the data.
   */
  const insertUserScore = useCallback(
    async (gameId: string, score: number) => {
      if (!userName) {
        console.error("Cannot insert score without a user name.");
        return;
      }
      try {
        const response = await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_name: userName,
            game_title: gameId,
            score: score,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to submit score.");
        }

        await updateScore();
      } catch (err: any) {
        console.error("Failed to insert user score:", err);
        setError(err.message || "Failed to submit score.");
      }
    },
    [userName, updateScore]
  );

  /**
   * Returns the top N scores for a given game.
   */
  const ranking = useCallback(
    (gameId: string, topN: number): ScoreRow[] => {
      const leaderboard = leaderboardsData[gameId] || [];
      return leaderboard.slice(0, topN);
    },
    [leaderboardsData]
  );

  // Automatically fetch data when the userName changes.
  useEffect(() => {
    if (userName) {
      updateScore();
    }
  }, [userName, updateScore]);

  // --- Context Value ---

  const value = {
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
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

// --- Custom Hook ---

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};