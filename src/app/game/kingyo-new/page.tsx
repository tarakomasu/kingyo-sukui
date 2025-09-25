"use client";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Ranking from "./components/Ranking";
import HowToPlay from "./components/HowToPlay";

type Tab = "ranking" | "howToPlay";

const KingyoNewTopPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>("ranking");

  return (
    <div
      className="flex flex-col items-center justify-start min-h-screen text-white p-4"
      style={{ backgroundColor: "#528078" }}
    >
      <header className="w-full max-w-md mx-auto text-center py-8">
        <Image
          src="/kingyo-sukui/header/kingyo-header.png"
          alt="金魚すくい"
          width={250}
          height={250}
          className="mx-auto"
        />
        <h1
          className="text-4xl font-bold mt-4 text-white"
          style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.5)" }}
        >
          金魚すくい
        </h1>
      </header>

      <div className="w-full max-w-md mx-auto">
        <div className="flex justify-center border-b border-gray-300">
          <button
            className={`px-4 py-2 text-lg font-semibold transition-colors duration-200 ${
              activeTab === "ranking"
                ? "text-yellow-300 border-b-2 border-yellow-300"
                : "text-gray-100"
            }`}
            onClick={() => setActiveTab("ranking")}
          >
            ランキング
          </button>
          <button
            className={`px-4 py-2 text-lg font-semibold transition-colors duration-200 ${
              activeTab === "howToPlay"
                ? "text-yellow-300 border-b-2 border-yellow-300"
                : "text-gray-100"
            }`}
            onClick={() => setActiveTab("howToPlay")}
          >
            遊び方
          </button>
        </div>

        <div className={`mt-4 p-4 bg-black bg-opacity-20 rounded-lg`}>
          {activeTab === "ranking" && <Ranking />}
          {activeTab === "howToPlay" && <HowToPlay />}
        </div>
      </div>

      <Link
        href="/game/kingyo-new/game"
        className="w-full max-w-md mt-auto pt-4"
      >
        <button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-4 rounded-lg text-2xl shadow-lg transition-transform transform hover:scale-105">
          ゲームスタート
        </button>
      </Link>
    </div>
  );
};

export default KingyoNewTopPage;
