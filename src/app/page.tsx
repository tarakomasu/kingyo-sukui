"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";

/** 表示用の型 */
type Stall = {
  name: string;
  img: string;          // /yatai/*.png
  playable?: boolean;    // 金魚すくい/射的のみ true
  href?: string;         // playable のときだけ使用
  // ground（下半分）内での相対位置（%）。left は 0〜100、top は 0〜100。
  // ground の左上を (0,0)、右下を (100,100) として配置します。
  leftPct?: number;
  topPct?: number;
  aspectRatio?: number;  // 画像の横/縦 比（未指定は 1）
};

/** 屋台アイコンの基本サイズ（px） */
const STALL_SIZE_VW = 45;  // Increase the percentage to make images larger

/** 常時表示（芝生の左右） */
const LEFT_STALL: Stall = {
  name: "きんぎょすくい",
  img: "/yatai/金魚掬い.PNG",
  playable: true,
  href: "/game/kingyo-new",
  leftPct: 8,
  topPct: 18, // ground 内の上からの%（下に行くほど数値が大きい）
  aspectRatio: 708/908,
};
const RIGHT_STALL: Stall = {
  name: "しゃてき",
  img: "/yatai/射的.PNG",
  playable: true,
  href: "/game/syateki",
  leftPct: 92,
  topPct: 18,
  aspectRatio: 824/834,
};

// ステップ1で表示する左右の屋台（置き換え）
const YAMANEKO_LEFT: Stall = { name: "やまねこしゃてき", img: "/yatai/やまねこしゃてき.png", href: "/game/yamaneko-syateki", playable: true, aspectRatio: 922/562 }; // Adjust aspect ratio to match original
const BON_ODORI_RIGHT: Stall = { name: "", img: "/yatai/やぐら.png" };

/** ↑キーで増える「次の屋台」（画像のみ） */
const NEXT_STALLS: Stall[] = [
  { name: "やまねこしゃてき", img: "/yatai/やまねこしゃてき.png", href: "/game/yamaneko-syateki", leftPct: 60, topPct: 45 },
  { name: "", img: "/yatai/被写体2.png", leftPct: 40, topPct: 30 },
];

function FestivalBackgroundWithYataiInner() {
  const rootRef = useRef<HTMLDivElement>(null);
  // ペアインデックス（常に2つだけ表示）
  const [step, setStep] = useState(0);

  // フォーカス可能にしてキーハンドリング
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setStep((s) => (s < 1 ? 1 : 1));
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setStep((s) => (s > 0 ? 0 : 0));
      }
    };
    // ルートにフォーカスを当てておく（初回のみ）
    el.focus();
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="background-container" ref={rootRef} tabIndex={0} aria-label="お祭り会場 背景。上向き矢印キーで進みます。">
      {/* === 夜空と提灯 === */}
      <div className="sky">
        {/* 上半分：夜空 */}
        <div className="sky-content">
          {/* 提灯は削除 */}
        </div>
        <div className="lantern-area" style={{ position: "absolute", top: 0, width: "100%", display: "flex", justifyContent: "space-around", zIndex: 2 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="lantern" style={{ width: "15%", maxWidth: 120 }}>
              <svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" aria-label="lantern">
                <line x1="50" y1="0" x2="50" y2="40" stroke="black" strokeWidth="2" />
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <ellipse cx="50" cy="80" rx="45" ry="50" fill="#D32F2F" />
                <ellipse cx="50" cy="80" rx="35" ry="40" fill="#FBC02D" filter="url(#glow)" />
                <path d="M 5,80 Q 50,50 95,80" stroke="#C62828" strokeWidth="4" fill="none" />
                <path d="M 5,80 Q 50,110 95,80" stroke="#C62828" strokeWidth="4" fill="none" />
                <rect x="20" y="125" width="60" height="5" fill="#3E2723" />
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* === 地面と道（下半分） === */}
      <div className="ground">
        {/* 中央の道 */}
        <div className="path" />
      </div>

      {/* === 屋台のオーバーレイ（背景の上に重ねる） === */}
      <div className="overlay" aria-hidden={false}>

        {/* ステップに応じて、左右に2つだけ表示 */}
        {step === 0 ? (
          <>
            <StallOnGround stall={LEFT_STALL} side="left" />
            <StallOnGround stall={RIGHT_STALL} side="right" />
          </>
        ) : (
          <>
            <StallOnGround stall={YAMANEKO_LEFT} side="left" />
            <StallOnGround stall={BON_ODORI_RIGHT} side="right" />
          </>
        )}

        {/* ヒント */}
        <div className="hint">
          {step === 0 ? "↑キーで すすむ" : "↓キーで もどる"}
        </div>
      </div>

      {/* --- styled-jsx --- */}
      <style jsx>{`
        :global(html),
        :global(body) {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .background-container {
          width: 100%;
          height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
          outline: none; /* tabIndex=0 のフォーカス枠はカスタムで出すなら調整 */
        }
        .background-container:focus-visible {
          box-shadow: inset 0 0 0 3px rgba(56, 189, 248, 0.6);
        }

        /* 上半分：夜空 */
        .sky {
          flex: 1;
          background: linear-gradient(to bottom, #191970, #2c2a4a);
          position: relative;
          z-index: 1;
          overflow: hidden;
        }
        .sky-content {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          pointer-events: none; /* 提灯はクリックを無効化 */
        }
        .lantern {
          position: relative;
          top: -20px;
          animation: sway 5s ease-in-out infinite alternate;
        }
        .lantern:nth-child(2) { animation-delay: -1s; }
        .lantern:nth-child(3) { animation-delay: -3s; }
        .lantern:nth-child(4) { animation-delay: -2s; }
        .lantern:nth-child(5) { animation-delay: -4s; }
        @keyframes sway {
          from { transform: rotate(-3deg) translateX(-5px); }
          to { transform: rotate(3deg) translateX(5px); }
        }

        /* 下半分：地面 */
        .ground {
          height: 50%;
          background-color: #388e3c;
          background-image:
            repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 10px),
            repeating-linear-gradient(-45deg, rgba(0,0,0,0.05) 0, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 10px);
          position: relative;
          z-index: 2;
          border-top: 5px solid #2e7d32;
          overflow: hidden;
        }
        .path {
          width: 80%;
          height: 100%;
          background-color: #a1887f;
          background-image: repeating-linear-gradient(60deg, rgba(0,0,0,0.05) 0, rgba(0,0,0,0.05) 2px, transparent 2px, transparent 15px);
          margin: 0 auto;
          position: relative;
          clip-path: polygon(30% 0, 70% 0, 100% 100%, 0% 100%);
          border-left: 10px dotted rgba(0,0,0,0.1);
          border-right: 10px dotted rgba(0,0,0,0.1);
        }
        .hint {
          position: absolute;
          left: 50%;
          bottom: 8%;
          transform: translateX(-50%);
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(2,132,199,0.2);
          padding: 8px 12px;
          border-radius: 12px;
          font-size: 14px;
          color: #0c4a6e;
          box-shadow: 0 6px 16px rgba(0,0,0,0.1);
          animation: pulse 1.8s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50% { transform: translateX(-50%) scale(1.05); }
        }

        /* 屋台のオーバーレイ（全面レイヤー） */
        .overlay {
          position: absolute;
          inset: 0;
          z-index: 3; /* sky(1), ground(2) の上 */
          pointer-events: none; /* 個別要素で有効化 */
        }
      `}</style>
    </div>
  );
}

/** ground 内に屋台を描画する小コンポーネント */
function StallOnGround({ stall, side }: { stall: Stall; side?: "left" | "right" }) {
  const sizeVw = STALL_SIZE_VW;
  const ar = stall.aspectRatio ?? 1; // 横/縦

  const box = (
    <div className="box" aria-label={`${stall.name}${stall.playable ? "（あそべます）" : "（画像）"}`}>
      <div className="imgWrap">
        <Image
          src={stall.img}
          alt={stall.name}
          width={Math.round((stall.aspectRatio ?? 1) * 1000)}
          height={1000}
          sizes={`${sizeVw}vw`}
          className="img"
          priority={stall.playable}
          style={{ width: `${sizeVw}vw`, height: "auto", display: "block" }}
        />
      </div>
      <div className="label">{stall.name}</div>
      <style jsx>{`
        .box {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0;
          background: transparent;
          border: none;
          border-radius: 0;
          box-shadow: none;
          user-select: none;
        }
        .imgWrap {
          width: ${sizeVw}vw;
          max-width: 720px;
        }
        .img {
          object-fit: contain; /* 念のため維持 */
          display: block;
        }
      `}</style>
    </div>
  );

  // 配置：ground 内の相対%（leftPct/topPct）か、サイド配置のデフォルト位置
  const left = stall.leftPct ?? (side === "left" ? 8 : side === "right" ? 92 : 50);
  const top = stall.topPct ?? 18;

  // ground の高さは全体の 50% なので、topPct(0-100) を全体座標に変換する
  const topGlobalPct = 50 + top / 2; // 50% + (topPctの半分)

  const wrapperStyle: React.CSSProperties = {
    position: "absolute",
    left: `${left}%`,
    top: `${topGlobalPct}%`,
    transform: "translate(-50%, -50%)",
    pointerEvents: "auto", // overlay で無効化したイベントを要素で復活
  };

  // 金魚＆射的（playable）はリンク、それ以外は静的表示
  if (stall.playable && stall.href) {
    return (
      <Link href={stall.href} style={wrapperStyle} className="stall-link" aria-label={`${stall.name} を ひらく`}>
        {box}
        <style jsx>{`
          .stall-link:focus-visible {
            outline: 4px solid rgba(56, 189, 248, 0.6);
            border-radius: 20px;
          }
          .stall-link:hover .box {
            transform: translateY(-1px);
            transition: transform 0.15s ease;
          }
        `}</style>
      </Link>
    );
  }
  return <div style={wrapperStyle}>{box}</div>;
}

export default dynamic(
  () => Promise.resolve(FestivalBackgroundWithYataiInner),
  { ssr: false }
);
