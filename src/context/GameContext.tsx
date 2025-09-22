"use client";

import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
} from "react";

// Type definitions
interface ScoreEntry {
  userName: string;
  score: number;
}

interface UserScore {
  [gameId: string]: number;
}

interface LeaderboardsData {
  [gameId: string]: ScoreEntry[];
}

interface GameContextType {
  userName: string;
  setUserName: (name: string) => void;
  userScore: UserScore;
  ranking: (gameId: string, topN: number) => ScoreEntry[];
  loading: boolean;
  updateScore: () => Promise<void>;
}

// Create the context
const GameContext = createContext<GameContextType | undefined>(undefined);

// Provider component
export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [userName, setUserName] = useState<string>("");
  const [userScore, setUserScore] = useState<UserScore>({});
  const [leaderboardsData, setLeaderboardsData] = useState<LeaderboardsData>({});
  const [loading, setLoading] = useState<boolean>(false);

  // Function to fetch/update all game data
  const updateScore = useCallback(async () => {
    if (!userName) return;

    setLoading(true);
    try {
      console.log(`Fetching data for user: ${userName}`);
      
      const [scoresRes, leaderboardsRes] = await Promise.all([
        Promise.resolve({ game1: 1200, game2: 500, "kingyo-new": Math.floor(Math.random() * 2000) }),
        Promise.resolve({
          game1: [
            { userName: userName, score: 1500 },
            { userName: "Guest", score: 1000 },
            { userName: "CPU", score: 900 },
          ],
          "kingyo-new": [
            { userName: "CPU", score: 800 },
            { userName: userName, score: Math.floor(Math.random() * 2000) },
            { userName: "Player3", score: 1200 },
          ].sort((a, b) => b.score - a.score),
        }),
      ]);

      setUserScore(scoresRes);
      setLeaderboardsData(leaderboardsRes);
    } catch (error) {
      console.error("Failed to fetch game data:", error);
    } finally {
      setLoading(false);
    }
  }, [userName]);

  // Function to get top N ranking for a specific game
  const ranking = useCallback(
    (gameId: string, topN: number): ScoreEntry[] => {
      const leaderboard = leaderboardsData[gameId] || [];
      return leaderboard.slice(0, topN);
    },
    [leaderboardsData]
  );

  // Automatically fetch data when userName changes
  useEffect(() => {
    if (userName) {
      updateScore();
    }
  }, [userName, updateScore]);

  const value = {
    userName,
    setUserName,
    userScore,
    ranking,
    loading,
    updateScore,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

// Custom hook to use the context
export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};
