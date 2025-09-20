"use client";
import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

/**
 * ShootingGame.tsx
 * - 元の HTML + p5.js スケッチを React + TypeScript に移植
 * - p5 は動的 import（CSR）
 * - 画面オーバーレイ、設定、コンボ、救済ボス、難易度プリセット、DDA（発展余地）
 *
 * ★使い方（Next.js など）
 *   import ShootingGame from "./ShootingGame";
 *   export default function Page() { return <ShootingGame/> }
 */

type GameState = "title" | "tutorial" | "playing" | "result" | "paused" | "settings";

type Config = {
  SCREEN_WIDTH: number;
  SCREEN_HEIGHT: number;
  GAME_TIME: number;
  FIRE_INTERVAL: number;
  NORMAL_TARGET_COUNT: number;
  DECOY_TARGET_COUNT: number;
  MAX_TARGETS: number;
  TARGET_SPEED_MIN: number; // 画面幅に対する毎秒の移動割合（%ではなく 0-1）
  TARGET_SPEED_MAX: number; // 例: 0.3 = 画面幅の30%/秒
  TARGET_SIZES: { small: number; medium: number; large: number }; // 短辺に対する半径割合（0-1）
  TARGET_SCORES: { small: number; medium: number; large: number; miss: number; boss: number; decoy: number };
  HITBOX_SCALE: number;
  COMBO_ENABLED: boolean;
  COMBO_TIMEOUT: number;
  COMBO_MULTIPLIERS: number[];
  RESCUE_ENABLED: boolean;
  RESCUE_TIME: number;
  RESULT_SCREEN_TIMER: number;
};

const PRESETS: Record<"easy" | "normal" | "hard", Partial<Config>> = {
  easy: { GAME_TIME: 30, HITBOX_SCALE: 1.4, MAX_TARGETS: 4 },
  normal:{ GAME_TIME: 30, HITBOX_SCALE: 1.3, MAX_TARGETS: 5 },
  hard: { GAME_TIME: 25, HITBOX_SCALE: 1.2, MAX_TARGETS: 6 },
};

const DEFAULT_CONFIG: Config = {
  SCREEN_WIDTH: 1280,
  SCREEN_HEIGHT: 720,
  GAME_TIME: 30,
  FIRE_INTERVAL: 200,
  NORMAL_TARGET_COUNT: 40,
  DECOY_TARGET_COUNT: 10,
  MAX_TARGETS: 5,
  TARGET_SPEED_MIN: 6,
  TARGET_SPEED_MAX: 10,
  TARGET_SIZES: { small: 40, medium: 60, large: 80 },
  TARGET_SCORES: { small: 50, medium: 20, large: 10, miss: 1, boss: 300, decoy: -100 },
  HITBOX_SCALE: 1.3,
  COMBO_ENABLED: true,
  COMBO_TIMEOUT: 800,
  COMBO_MULTIPLIERS: [1.0, 1.5, 2.0],
  RESCUE_ENABLED: true,
  RESCUE_TIME: 5,
  RESULT_SCREEN_TIMER: 20,
};

// --- p5 以外のゲーム内部型 ---

type TargetType = "small" | "medium" | "large" | "decoy" | "boss";

type Target = {
  // 位置・速度・半径はすべて正規化座標（0-1）で保持
  x: number; y: number; radius: number; vx: number; vy: number; type: TargetType; angle: number; hp?: number;
};

type Particle = { x:number; y:number; vx:number; vy:number; alpha:number; size:number; color:[number,number,number] };

type GameRuntime = {
  p5?: any; // p5 インスタンス
  // 状態
  gameState: GameState;
  score: number;
  timeLeft: number;
  gameStartTime: number; // millis()
  lastFireTime: number;
  targets: Target[];
  particles: Particle[];
  comboCount: number;
  lastHitTime: number;
  comboMultiplier: number;
  rescueBossSpawned: boolean;
  // spawn
  spawnQueue: { type: TargetType }[];
  nextSpawnTime: number;
  spawnInterval: number;
  // sound
  isMuted: boolean;
  soundReady: boolean;
  hitOsc?: any; fireNoise?: any; decoyOsc?: any; reverb?: any;
};

function clamp(v:number, lo:number, hi:number){ return Math.max(lo, Math.min(hi, v)); }
function rand(a:number, b:number){ return a + Math.random()*(b-a); }

const ShootingGame: React.FC = () => {
  const canvasParentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameRuntime>({
    gameState: "title",
    score: 0,
    timeLeft: DEFAULT_CONFIG.GAME_TIME,
    gameStartTime: 0,
    lastFireTime: 0,
    targets: [],
    particles: [],
    comboCount: 0,
    lastHitTime: 0,
    comboMultiplier: DEFAULT_CONFIG.COMBO_MULTIPLIERS[0],
    rescueBossSpawned: false,
    spawnQueue: [],
    nextSpawnTime: 0,
    spawnInterval: 0,
    isMuted: false,
    soundReady: false,
  });

  const [config, setConfig] = useState<Config>({ ...DEFAULT_CONFIG });
  const [uiState, setUiState] = useState<{gameState:GameState; score:number; timeLeft:number; comboText:string}>(
    { gameState: "title", score: 0, timeLeft: config.GAME_TIME, comboText: "" }
  );

  // ---- p5 初期化（CSRのみ） ----
  useEffect(() => {
    let p5Instance: any;
    let mounted = true;

    (async () => {
      if (!mounted) return;
      // @ts-ignore - p5 の型解決は環境により不安定なため無視
      const p5 = (await import("p5")).default;
      // p5.sound は必ずしもモジュール解決できないためベストエフォート
      try {
        // @ts-ignore - モジュール宣言がないため無視
        await import("p5/lib/addons/p5.sound");
      } catch(e) {
        console.warn("p5.sound の読み込みに失敗。サウンドは無効化します", e);
      }

      const sketch = (p:any) => {
        // --- util (React state を触らずに gameRef 経由で高速更新) ---
        const g = gameRef.current;

        p.setup = () => {
          const c = p.createCanvas(typeof window !== 'undefined' ? window.innerWidth : DEFAULT_CONFIG.SCREEN_WIDTH, typeof window !== 'undefined' ? window.innerHeight : DEFAULT_CONFIG.SCREEN_HEIGHT);
          p.pixelDensity(1);
          if (canvasParentRef.current) c.parent(canvasParentRef.current);
          p.textAlign(p.CENTER, p.CENTER);
          p.rectMode(p.CENTER);
          p.noStroke();

          g.p5 = p;
          // sound init（存在する環境でのみ）
          try {
            // @ts-ignore
            g.hitOsc = new p5.Oscillator("triangle"); g.hitOsc.amp(0); g.hitOsc.start();
            // @ts-ignore
            g.fireNoise = new p5.Noise("white"); g.fireNoise.amp(0); g.fireNoise.start();
            // @ts-ignore
            g.decoyOsc = new p5.Oscillator("sawtooth"); g.decoyOsc.amp(0); g.decoyOsc.start();
            // @ts-ignore
            g.reverb = new p5.Reverb();
            g.soundReady = true;
          } catch {
            g.soundReady = false;
          }

          toTitle();
        };

        p.draw = () => {
          p.background(50, 60, 80);
          if (g.gameState === "playing") {
            updateGame(p);
            drawGame(p);
          }
        };

        // 画面サイズ変更時にキャンバスと座標系を同期
        p.windowResized = () => {
          try {
            const w = typeof window !== 'undefined' ? window.innerWidth : DEFAULT_CONFIG.SCREEN_WIDTH;
            const h = typeof window !== 'undefined' ? window.innerHeight : DEFAULT_CONFIG.SCREEN_HEIGHT;
            p.pixelDensity(1);
            p.resizeCanvas(w, h);
          } catch {}
        };

        p.mousePressed = () => {
          if (g.gameState !== "playing") return;
          const now = p.millis();
          if (now - g.lastFireTime < config.FIRE_INTERVAL) return;
          g.lastFireTime = now;
          playFireSound();

          let hit = false;
          for (let i = g.targets.length - 1; i >= 0; i--) {
            const t = g.targets[i];
            const d = p.dist(p.mouseX, p.mouseY, t.x, t.y);
            if (d < t.radius * config.HITBOX_SCALE) {
              hit = true;
              if (t.type === "decoy") {
                g.score += config.TARGET_SCORES.decoy;
                playDecoyHitSound();
                createExplosion(p, t.x, t.y, t.radius, [100,100,100]);
                resetCombo();
              } else if (t.type === "boss") {
                t.hp = (t.hp ?? 10) - 1;
                playHitSound();
                createExplosion(p, t.x, t.y, t.radius);
                if (t.hp! <= 0) {
                  const base = (config.TARGET_SCORES as any)[t.type] || 0;
                  const earned = Math.floor(base * g.comboMultiplier);
                  g.score += earned;
                  if (config.COMBO_ENABLED) updateCombo(p);
                  g.targets.splice(i,1);
                }
              } else {
                const base = (config.TARGET_SCORES as any)[t.type] || 0;
                const earned = Math.floor(base * g.comboMultiplier);
                g.score += earned;
                if (config.COMBO_ENABLED) updateCombo(p);
                playHitSound();
                createExplosion(p, t.x, t.y, t.radius);
                g.targets.splice(i,1);
              }
              break;
            }
          }
          if (!hit) {
            g.score += config.TARGET_SCORES.miss;
            resetCombo();
          }
          syncUi();
        };

        p.keyPressed = () => {
          if (p.keyCode === p.ESCAPE) {
            if (p.fullscreen()) p.fullscreen(false); else togglePause();
          }
          if (p.key.toLowerCase() === 'm') {
            g.isMuted = !g.isMuted;
            try { if (g.soundReady) p.masterVolume(g.isMuted ? 0 : 0.5); } catch {}
          }
        };

        // --- game funcs ---
        function toTitle(){
          g.gameState = "title";
          p.noLoop();
          g.targets = []; g.particles = [];
          g.score = 0; g.timeLeft = config.GAME_TIME; g.comboCount=0; g.comboMultiplier=config.COMBO_MULTIPLIERS[0];
          syncUi();
        }

        function startTutorial(){
          g.gameState = "tutorial";
          syncUi();
          setTimeout(startGame, 3000);
        }

        function startGame(){
          g.gameState = "playing";
          g.score = 0;
          g.timeLeft = config.GAME_TIME;
          g.gameStartTime = p.millis();
          g.targets = []; g.particles = [];
          g.comboCount = 0; g.lastHitTime = 0; g.comboMultiplier = config.COMBO_MULTIPLIERS[0];
          g.rescueBossSpawned = false;

          // spawn queue
          createSpawnQueue();
          const total = config.NORMAL_TARGET_COUNT + config.DECOY_TARGET_COUNT;
          g.spawnInterval = (config.GAME_TIME * 1000) / Math.max(1,total);
          g.nextSpawnTime = p.millis() + g.spawnInterval;
          syncUi();
          p.loop();
        }

        function endGame(){
          g.gameState = "result";
          syncUi();
          let left = config.RESULT_SCREEN_TIMER;
          const id = setInterval(() => {
            if (g.gameState !== "result") { clearInterval(id); return; }
            left--;
            if (left <= 0) { clearInterval(id); toTitle(); }
          }, 1000);
        }

        function togglePause(){
          if (g.gameState === "playing") { g.gameState = "paused"; p.noLoop(); }
          else if (g.gameState === "paused") { g.gameState = "playing"; p.loop(); }
          syncUi();
        }

        function updateGame(p:any){
          const now = p.millis();
          const elapsed = (now - g.gameStartTime)/1000;
          g.timeLeft = clamp(config.GAME_TIME - elapsed, 0, 999);
          if (g.timeLeft <= 0){ g.timeLeft = 0; endGame(); return; }

          // spawn
          if (g.spawnQueue.length > 0 && g.targets.length < config.MAX_TARGETS && now >= g.nextSpawnTime){
            spawnFromQueue();
            g.nextSpawnTime = now + g.spawnInterval;
          }
          // rescue boss
          if (config.RESCUE_ENABLED && !g.rescueBossSpawned && g.timeLeft <= config.RESCUE_TIME){
            spawnRescueBoss();
            g.rescueBossSpawned = true;
          }
          // combo timeout
          if (config.COMBO_ENABLED && g.comboCount>0 && now - g.lastHitTime > config.COMBO_TIMEOUT){
            resetCombo();
          }

          // move targets
          for (let i=g.targets.length-1;i>=0;i--){
            const t = g.targets[i];
            t.x += t.vx; t.y += t.vy; t.angle += 0.05;
            if (t.x < -t.radius*2 || t.x > p.width + t.radius*2 || t.y < -t.radius*2 || t.y > p.height + t.radius*2){
              g.targets.splice(i,1);
            }
          }
          // particles
          for (let i=g.particles.length-1;i>=0;i--){
            const pp = g.particles[i];
            pp.x += pp.vx; pp.y += pp.vy; pp.vy += 0.1; pp.alpha -= 5;
            if (pp.alpha <= 0) g.particles.splice(i,1);
          }

          syncUiThrottled();
        }

        function drawGame(p:any){
          // sight
          p.stroke(255,0,0); p.strokeWeight(2); p.noFill();
          p.ellipse(p.mouseX,p.mouseY,40,40); p.line(p.mouseX-30,p.mouseY,p.mouseX+30,p.mouseY); p.line(p.mouseX,p.mouseY-30,p.mouseX,p.mouseY+30); p.noStroke();

          // targets
          for (const t of g.targets){
            p.push(); p.translate(t.x,t.y); p.rotate(t.angle);
            if (t.type === "decoy"){
              p.fill(40,40,40); p.ellipse(0,0,t.radius*2,t.radius*2);
              p.fill(230); p.ellipse(0,-t.radius*0.1,t.radius*1.2,t.radius*1.4); p.rect(0,t.radius*0.5,t.radius,t.radius*0.3);
              p.fill(0); p.ellipse(-t.radius*0.3,-t.radius*0.2,t.radius*0.35,t.radius*0.45); p.ellipse(t.radius*0.3,-t.radius*0.2,t.radius*0.35,t.radius*0.45);
              p.triangle(0,0,-t.radius*0.15,t.radius*0.2,t.radius*0.15,t.radius*0.2);
            } else if (t.type === "boss"){
              p.fill(220,50,50); p.ellipse(0,0,t.radius*2,t.radius*2);
              p.fill(255,255,0); p.textSize(t.radius/2); p.text('ボス',0,0);
            } else {
              p.fill(220,50,50); p.ellipse(0,0,t.radius*2,t.radius*2);
              p.fill(255); p.ellipse(0,0,t.radius*1.5,t.radius*1.5);
              p.fill(220,50,50); p.ellipse(0,0,t.radius,t.radius);
            }
            p.pop();
          }

          // particles
          for (const pp of g.particles){
            p.noStroke(); p.fill(pp.color[0], pp.color[1], pp.color[2], pp.alpha); p.ellipse(pp.x, pp.y, pp.size, pp.size);
          }
        }

        function createSpawnQueue(){
          g.spawnQueue = [];
          const types: TargetType[] = ["small","medium","large"];
          for (let i=0;i<config.NORMAL_TARGET_COUNT;i++) g.spawnQueue.push({ type: types[Math.floor(Math.random()*types.length)] });
          for (let i=0;i<config.DECOY_TARGET_COUNT;i++) g.spawnQueue.push({ type: "decoy" });
          // shuffle
          for (let i=g.spawnQueue.length-1; i>0; i--){
            const j = Math.floor(Math.random()*(i+1));
            [g.spawnQueue[i], g.spawnQueue[j]] = [g.spawnQueue[j], g.spawnQueue[i]];
          }
        }

        function spawnFromQueue(){
          if (g.spawnQueue.length===0) return;
          const item = g.spawnQueue.shift()!;
          const type = item.type;
          let radius:number, speed:number;
          if (type === "decoy"){
            radius = 60; speed = rand(config.TARGET_SPEED_MIN+1, config.TARGET_SPEED_MAX+2);
          } else if (type === "boss"){
            radius = 200; speed = 1;
          } else {
            radius = (config.TARGET_SIZES as any)[type];
            speed = rand(config.TARGET_SPEED_MIN, config.TARGET_SPEED_MAX);
          }

          const y = rand(radius, p.height - radius);
          const fromLeft = Math.random() > 0.5;
          const x = fromLeft ? -radius : p.width + radius;
          const vx = fromLeft ? speed : -speed;
          const vy = rand(-1,1);

          g.targets.push({ x, y, radius, vx, vy, type, angle: 0 });
        }

        function spawnRescueBoss(){ g.targets.push({ x: p.width/2, y: -200, radius: 200, vx: 0, vy: 1, type: "boss", angle: 0, hp: 10 }); }

        function createExplosion(p:any, x:number, y:number, size:number, color?:[number,number,number]){
          for (let i=0;i<30;i++){
            g.particles.push({ x, y, vx: rand(-5,5), vy: rand(-5,5), alpha:255, size: rand(size/5,size/3), color: color || [rand(200,255), rand(150,255), 0] });
          }
        }

        function updateCombo(p:any){
          g.comboCount++; g.lastHitTime = p.millis();
          const idx = Math.min(g.comboCount-1, config.COMBO_MULTIPLIERS.length-1);
          g.comboMultiplier = config.COMBO_MULTIPLIERS[idx];
        }
        function resetCombo(){ g.comboCount = 0; g.comboMultiplier = config.COMBO_MULTIPLIERS[0]; }

        function playHitSound(){ if (!g.soundReady || g.isMuted) return; try{ g.hitOsc!.freq(rand(600,800)); g.hitOsc!.freq(100,0.2); g.hitOsc!.fade(0.5,0.01); g.hitOsc!.fade(0,0.2,0.01); g.reverb!.process(g.hitOsc,2,3);}catch{} }
        function playFireSound(){ if (!g.soundReady || g.isMuted) return; try{ g.fireNoise!.amp(0.1,0.01); g.fireNoise!.amp(0,0.05,0.01);}catch{} }
        function playDecoyHitSound(){ if (!g.soundReady || g.isMuted) return; try{ g.decoyOsc!.freq(120); g.decoyOsc!.fade(0.4,0.05); g.decoyOsc!.fade(0,0.3,0.05); g.reverb!.process(g.decoyOsc,2,2);}catch{} }

        // --- UI sync ---
        let lastUi = 0;
        function syncUi(){
          setUiState({
            gameState: g.gameState,
            score: g.score,
            timeLeft: Math.ceil(g.timeLeft),
            comboText: (config.COMBO_ENABLED && g.comboCount>0) ? `${g.comboCount}コンボ x${g.comboMultiplier.toFixed(1)}` : "",
          });
        }
        function syncUiThrottled(){
          const now = p.millis();
          if (now - lastUi > 60){ lastUi = now; syncUi(); }
        }

        // --- expose small handlers to React ---
        (window as any).__shooting_internals__ = {
          startTutorial, togglePause, startGame, toTitle,
          openSettings: ()=>{ g.gameState = "settings"; syncUi(); },
          closeSettings: (prev:GameState)=>{ g.gameState = prev; syncUi(); if (prev === "playing") p.loop(); else p.noLoop(); },
        };
      };

      p5Instance = new p5(sketch);
    })();

    return () => { mounted = false; try { p5Instance?.remove?.(); } catch {} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- React 側の UI ハンドラ ---
  const startFromTitle = () => (window as any).__shooting_internals__?.startTutorial?.();
  const resume = () => (window as any).__shooting_internals__?.togglePause?.();
  const backToTitle = () => (window as any).__shooting_internals__?.toTitle?.();
  const openSettings = () => (window as any).__shooting_internals__?.openSettings?.();
  const closeSettings = () => (window as any).__shooting_internals__?.closeSettings?.(prevStateRef.current);

  // settings の双方向バインド
  const prevStateRef = useRef<GameState>("title");
  useEffect(()=>{ prevStateRef.current = uiState.gameState; }, [uiState.gameState]);

  const bindSlider = (key: keyof Config, _step = 1) => ({
    value: config[key] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setConfig(c => ({ ...c, [key]: parseFloat(e.target.value) })),
  });
  const bindCheck = (key: keyof Config) => ({
    checked: (config[key] as unknown) as boolean,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setConfig(c => ({ ...c, [key]: e.target.checked })),
  });

  const applyPreset = (name: "easy"|"normal"|"hard") => {
    const p = PRESETS[name];
    setConfig(c => ({ ...c, ...p } as Config));
  };

  // --- スタイル（元CSSを TSX に移植/調整） ---
  return (
    <div style={{ margin:0, padding:0, overflow: "auto",   minHeight: "100vh", backgroundColor:"#222", color:"#fff", fontFamily:"Hiragino Sans, Meiryo, sans-serif", display:"flex", justifyContent:"center", alignItems:"center" }}>
      <div id="game-container" style={{ width:"100vw", height:"100vh", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", position:"relative" }}>
        {/* time display */}
        <div id="time-display" style={{ position:"absolute", top:20, right:40, zIndex:5, fontSize:60, fontWeight:"bold", color:"#fff", textShadow:"3px 3px 0 #000", visibility: uiState.gameState==="playing"?"visible":"hidden", pointerEvents:"none" }}>
          じかん: {uiState.timeLeft}
        </div>

        {/* canvas host */}
        <div id="canvas-wrapper" ref={canvasParentRef} style={{ border:"2px solid #fff", boxShadow:"0 0 20px rgba(255,255,255,0.5)" }} />

        {/* info bar */}
        <div id="info-bar" style={{ position:"absolute", bottom:"env(safe-area-inset-bottom, 0px)", left:"50%", transform:"translateX(-50%)", zIndex:100, width:"100%", maxWidth:1280, height:100, backgroundColor:"#333", border:"2px solid #fff", borderTop:"none", display: uiState.gameState==="playing"?"flex":"none", justifyContent:"space-between", alignItems:"center", padding:"0 40px", boxSizing:"border-box", fontSize:48, fontWeight:"bold", pointerEvents:"none" }}>
          <div style={{ minWidth:300, width:300 }} />
          <div id="score" style={{ fontSize:80, color:"#ffeb3b", textShadow:"4px 4px 0 #c7b82c", flexGrow:1, textAlign:"center" }}>{uiState.score}てん</div>
          <div id="combo-display" style={{ minWidth:300, width:300, textAlign:"right" }}>{uiState.comboText}</div>
        </div>

        {/* title overlay */}
        {uiState.gameState === "title" && (
          <Overlay>
            <h1>わくわく！<br/>射的ゲーム</h1>
            <Btn onClick={startFromTitle}>すたーと</Btn> 
          </Overlay>
        )}

        {/* tutorial overlay */}
        {uiState.gameState === "tutorial" && (
          <Overlay dim="rgba(0,0,0,0)">
            <div style={{ backgroundColor:"rgba(0,0,0,0.8)", padding:30, borderRadius:20, fontSize:50 }}>
              <p>クリックで はっしゃ！</p>
              <p>まとに あてよう！</p>
            </div>
          </Overlay>
        )}

        {/* paused overlay */}
        {uiState.gameState === "paused" && (
          <Overlay>
            <h1>ちょっと きゅうけい</h1>
            <Btn onClick={resume}>つづける</Btn>
            <Btn style={{ background:'#e74c3c', borderColor:'#c0392b', boxShadow:'0 10px 0 #962d22' }} onClick={backToTitle}>たいとるへ</Btn>
          </Overlay>
        )}

        {/* result overlay */}
        {uiState.gameState === "result" && (
          <Overlay>
            <h1>けっか はっぴょう！</h1>
            <p style={{ fontSize:40, margin:10 }}>あなたの とくてんは...</p>
            <div id="result-score" style={{ fontSize:150, color:'#ffeb3b', margin:20, fontWeight:'bold' }}>{uiState.score}</div>
            <p style={{ fontSize:40, margin:10 }}>しょうごう</p>
            <div id="result-title" style={{ fontSize:60, color:'#48dbfb' }}>{ uiState.score>1500?"てきやめいじん": uiState.score>500?"うでまえあり":"しゅぎょうちゅう" }</div>
            <Btn onClick={backToTitle}>たいとるへ</Btn>
          </Overlay>
        )}
        </div>
      {/* グローバル style 調整（ヘッダの大見出しなど） */}
      <style>{`
        h1 { font-size: 100px; margin: 20px 0; text-shadow: 5px 5px 0 #000; text-align: center; }
        p { font-size: 40px; margin: 10px 0; text-align: center; }
      `}</style>
    </div>
  );
};

// --- UI 小物 ---
const Overlay: React.FC<React.PropsWithChildren<{ dim?: string; style?: React.CSSProperties }>> = ({ children, dim = "rgba(0,0,0,0.8)", style }) => (
  <div style={{ position:"absolute", inset:0, backgroundColor:dim, display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", textAlign:"center", zIndex:10, ...(style||{}) }}>
    {children}
  </div>
);

const Btn: React.FC<React.PropsWithChildren<{ onClick?:()=>void; style?:React.CSSProperties; small?:boolean }>> = ({ children, onClick, style, small }) => (
  <button onClick={onClick} style={{
    background: "linear-gradient(145deg, #f0932b, #e67e22)",
    border: "5px solid #d35400", borderRadius: 20, color:"white",
    padding: small?"10px 20px":"15px 30px", fontSize: small?24:48, fontWeight:"bold",
    cursor:"pointer", height: small?60:100, minWidth: small?150:300, marginTop: small?0:40,
    boxShadow:"0 10px 0 #a04000", transition:"all .1s ease-in-out", ...style,
  }} onMouseEnter={(e)=>{ (e.currentTarget as HTMLButtonElement).style.transform='translateY(5px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow='0 5px 0 #a04000'; }}
     onMouseLeave={(e)=>{ (e.currentTarget as HTMLButtonElement).style.transform=''; (e.currentTarget as HTMLButtonElement).style.boxShadow='0 10px 0 #a04000'; }}
     onMouseDown={(e)=>{ (e.currentTarget as HTMLButtonElement).style.transform='translateY(10px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow='0 0 0 #a04000'; }}
     onMouseUp={(e)=>{ (e.currentTarget as HTMLButtonElement).style.transform='translateY(5px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow='0 5px 0 #a04000'; }}>
    {children}
  </button>
);

export default dynamic(() => Promise.resolve(ShootingGame), { ssr: false });
