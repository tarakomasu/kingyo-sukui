"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls, OrbitControls } from "@react-three/drei";
import { Physics, useBox, usePlane, useSphere } from "@react-three/cannon";
import * as THREE from "three";

type GameState = "TOP" | "PLAYING" | "PAUSED" | "GAMEOVER";
type DistanceKey = "near" | "normal" | "far";

const STALL_DIST: Record<DistanceKey, number> = { near: -20, normal: -30, far: -45 };

// Registry to look up physics API for prize meshes by mesh UUID
const PRIZE_API_MAP: Map<string, { applyImpulse: (impulse: [number, number, number], relativePoint: [number, number, number]) => void }>
    = new Map();

function useWind(enabled: boolean, playing: boolean) {
    const [vec, setVec] = useState(() => new THREE.Vector3(0, 0, 0));
    const [angle, setAngle] = useState(0);
    const [strength, setStrength] = useState(0);
    const [showPopup, setShowPopup] = useState(false);

    useEffect(() => {
        if (!enabled) {
            setVec(new THREE.Vector3(0, 0, 0));
            return;
        }
        const id = setInterval(() => {
            const s = Math.random() * 5;
            const a = Math.random() * Math.PI * 2;
            setStrength(s);
            setAngle(a);
            setVec(new THREE.Vector3(Math.cos(a) * s, 0, Math.sin(a) * s));
            if (playing) {
                setShowPopup(true);
                setTimeout(() => setShowPopup(false), 2500);
            }
        }, 5000);
        return () => clearInterval(id);
    }, [enabled, playing]);

    return { vec, angle, strength, showPopup };
}

function getWindDirText(angle: number) {
    const degrees = (angle * 180) / Math.PI;
    const dirs = ["E", "NE", "N", "NW", "W", "SW", "S", "SE"];
    const idx = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
    return dirs[idx];
}

    function getComboComment(combo: number) {
        if (combo >= 20) return "神業ニャ！";
        if (combo >= 15) return "超すごいニャ！";
        if (combo >= 10) return "やるニャ～！";
        if (combo >= 5) return "いい感じニャ";
        if (combo >= 2) return "ナイス！";
        return "";
    }

function Ground() {
    const [ref] = usePlane(() => ({ rotation: [-Math.PI / 2, 0, 0], position: [0, 0, 0] }));
    return (
        <mesh ref={ref as any} receiveShadow>
            <planeGeometry args={[1000, 1000]} />
            <meshStandardMaterial color="#c2b280" />
        </mesh>
    );
}

function Shelf({ position, size = [10, 0.2, 2] as [number, number, number] }: { position: [number, number, number]; size?: [number, number, number] }) {
    const [ref] = useBox(() => ({ args: size, position, type: "Static" }));
    return (
        <mesh ref={ref as any} castShadow receiveShadow position={position}>
            <boxGeometry args={size} />
            <meshStandardMaterial color="#8B4513" />
        </mesh>
    );
}

function Prize({ id, position, color, onHit }: { id: string; position: [number, number, number]; color: string; onHit: (id: string) => void }) {
    const material = useMemo(() => new THREE.MeshStandardMaterial({ color }), [color]);
    const hitRef = useRef(false);
    const [ref, api] = useBox(() => ({
        args: [0.3, 0.5, 0.3],
        mass: 0.2,
        position,
        linearDamping: 0.03,
        angularDamping: 0.03,
        collisionFilterGroup: 4,
        collisionFilterMask: 1 | 2 | 4,
        onCollide: (e: any) => {
            // assume bullets have group 2
            if (hitRef.current) return;
            if (e?.body && (e.body as any).collisionFilterGroup === 2) {
                hitRef.current = true;
                onHit(id);
                const orig = (material.color as THREE.Color).clone();
                (material.color as THREE.Color).set(0xffffff);
                setTimeout(() => (material.color as THREE.Color).copy(orig), 200);
                // Apply a small impulse in contact normal direction if available
                if (e.contact?.ni) {
                    const impulse = new THREE.Vector3(e.contact.ni.x, e.contact.ni.y, e.contact.ni.z).multiplyScalar(1.5);
                    api.applyImpulse([impulse.x, impulse.y, impulse.z], [0, 0, 0]);
                }
            }
        },
    }));

    // Tag mesh and register physics API for raycast-based hits
    useEffect(() => {
        const m = (ref as any).current as THREE.Mesh | undefined;
        if (m) {
            m.userData.prizeId = id;
            PRIZE_API_MAP.set(m.uuid, api as any);
        }
        return () => {
            if (m) PRIZE_API_MAP.delete(m.uuid);
        };
    }, [id, api, ref]);
    return (
        <mesh ref={ref as any} castShadow position={position} material={material}>
            <boxGeometry args={[0.3, 0.5, 0.3]} />
        </mesh>
    );
}

function Bullet({ id, origin, dir, speed, onExpire, onBulletHit, wind, enabled }: { id: string; origin: THREE.Vector3; dir: THREE.Vector3; speed: number; onExpire: (id: string) => void; onBulletHit: (bulletId: string, prizeId: string) => void; wind: THREE.Vector3; enabled: boolean }) {
    const velocity = useMemo(() => [dir.x * speed, dir.y * speed, dir.z * speed] as [number, number, number], [dir, speed]);
    const [ref, api] = useSphere(() => ({
        args: [0.1],
        mass: 1,
        position: [origin.x, origin.y, origin.z],
        velocity,
        collisionFilterGroup: 2,
        collisionFilterMask: 1 | 4 | 2,
    }));

    const { scene } = useThree();
    const raycaster = useMemo(() => new THREE.Raycaster(), []);
    const prevPos = useRef<THREE.Vector3>(origin.clone());

    useEffect(() => {
        const t = setTimeout(() => onExpire(id), 5000);
        return () => clearTimeout(t);
    }, [id, onExpire]);

    useFrame(() => {
        if (!enabled) return;
    if (wind.lengthSq() > 0) api.applyForce([wind.x, wind.y, wind.z], [0, 0, 0]);

        // Segment raycast between last and current position to prevent tunneling
        const obj = (ref as any).current as THREE.Object3D | undefined;
        if (!obj) return;
        const cur = new THREE.Vector3();
        obj.getWorldPosition(cur);
        const segment = cur.clone().sub(prevPos.current);
        const len = segment.length();
        if (len > 0) {
            // Subdivide the segment to improve CCD granularity without heavy perf cost
            const stepSize = 0.5; // meters per step
            const maxSteps = 6;   // cap to avoid perf regression
            const steps = Math.min(maxSteps, Math.max(1, Math.ceil(len / stepSize)));
            const stepVec = segment.clone().multiplyScalar(1 / steps);
            let from = prevPos.current.clone();
            for (let s = 0; s < steps; s++) {
                const to = s === steps - 1 ? cur : from.clone().add(stepVec);
                const subSeg = to.clone().sub(from);
                const subLen = subSeg.length();
                if (subLen <= 0) {
                    from = to;
                    continue;
                }
                const dirNorm = subSeg.clone().normalize();
                raycaster.set(from, dirNorm);
                (raycaster as any).near = 0;
                (raycaster as any).far = subLen;
                const intersects = raycaster.intersectObjects(scene.children, true);
                const hit = intersects.find(i => {
                    let o: THREE.Object3D | null = i.object;
                    while (o) {
                        if ((o as any).userData?.prizeId) return true;
                        o = o.parent;
                    }
                    return false;
                });
                if (hit) {
                    let target: THREE.Object3D | null = hit.object;
                    while (target && !(target as any).userData?.prizeId) target = target.parent;
                    if (target) {
                        const prizeId = (target as any).userData.prizeId as string;
                        onBulletHit(id, prizeId);
                        const apiTarget = PRIZE_API_MAP.get(target.uuid);
                        if (apiTarget) {
                            const impulseDir = dirNorm.clone().normalize();
                            const impulse = impulseDir.multiplyScalar(2);
                            apiTarget.applyImpulse([impulse.x, impulse.y, impulse.z], [0, 0, 0]);
                        }
                        onExpire(id);
                        return; // stop further processing after hit
                    }
                }
                from = to;
            }
        }
        prevPos.current.copy(cur);
    });

    return (
        <mesh ref={ref as any}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color="#ffff00" />
        </mesh>
    );
}

function Lights({ stallZ }: { stallZ: number }) {
    return (
        <>
            <ambientLight intensity={2} color="#404040" />
            <directionalLight position={[-50, 50, 50]} intensity={1.5} color="#404080" castShadow />
            <pointLight position={[0, 5, stallZ + 2]} intensity={7} distance={250} color="#ffd6aa" castShadow />
        </>
    );
}

function DecorativeStalls() {
    const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x1e90ff }), []);
    const white = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xffffff }), []);
    const buildStall = (position: [number, number, number]) => (
        <group position={position}>
            {/* Posts */}
            {[
                [-4, -2, -2],
                [4, -2, -2],
                [-4, -2, 1],
                [4, -2, 1],
            ].map((p, i) => (
                <mesh key={i} position={[p[0], 1.75, p[2]]} castShadow>
                    <cylinderGeometry args={[0.075, 0.075, 3.5, 8]} />
                    <meshStandardMaterial color="#808080" />
                </mesh>
            ))}
            {/* Roof */}
            <mesh position={[0, 3.5, 0]}>
                <boxGeometry args={[8.15, 0.15, 5]} />
                <meshStandardMaterial color="#1e90ff" />
            </mesh>
            {/* Curtains (stripes) left/right */}
            {[-1, 1].map((side) => (
                <group key={side} rotation={[0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]} position={[side * 4, 1.75, -1.5]}>
                    {Array.from({ length: Math.ceil(4 / 0.5) }).map((_, i) => (
                        <mesh key={i} position={[i * 0.5 - 4 / 2 + 0.25, 0, 0]} castShadow>
                            <boxGeometry args={[0.5, 3.5, 0.05]} />
                            {i % 2 === 0 ? <primitive object={frame} attach="material" /> : <primitive object={white} attach="material" />}
                        </mesh>
                    ))}
                </group>
            ))}
            <pointLight position={[0, 2.5, 1]} intensity={4} distance={150} color="#ffd6aa" castShadow />
        </group>
    );
    return (
        <>
            {buildStall([-15, 0, -10])}
            {buildStall([15, 0, -10])}
            {buildStall([-15, 0, -20])}
            {buildStall([15, 0, -20])}
        </>
    );
}

function StallAndTargets({ stallZ, onHit, resetKey }: { stallZ: number; onHit: (id: string) => void; resetKey: number }) {
    const shelves = useMemo(
        () => [
            { pos: [0, 1.5, stallZ - 0.75] as [number, number, number] },
            { pos: [0, 3.0, stallZ - 0.75] as [number, number, number] },
            { pos: [0, 4.5, stallZ - 0.75] as [number, number, number] },
        ],
        [stallZ]
    );

    const prizeColors = useMemo(() => ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"], []);

    return (
        <group key={resetKey}>
            <Lights stallZ={stallZ} />
            <DecorativeStalls />
            {shelves.map((s, idx) => (
                <Shelf key={`shelf-${idx}`} position={s.pos} />
            ))}
            {shelves.flatMap((s, shelfIdx) => {
                const yTop = s.pos[1] + 0.1;
                const z = s.pos[2];
                return Array.from({ length: 5 }).map((_, i) => {
                    const x = -4 + i * 2;
                    const id = `p-${shelfIdx}-${i}`;
                    return (
                        <Prize key={id} id={id} position={[x, yTop + 0.25 + 0.01, z + (Math.random() - 0.5) * 0.5]} color={prizeColors[(i + shelfIdx) % prizeColors.length]} onHit={onHit} />
                    );
                });
            })}
        </group>
    );
}

function Shooter({ canShoot, onShoot, wind, bullets, setBullets, sensitivity, gameState, setGameState, setPausedOpen, isAiming, setIsAiming, resetViewKey, zeroElevDeg, zeroWindDeg, isTouchDevice, unlockGraceUntil }: { canShoot: boolean; onShoot: (origin: THREE.Vector3, dir: THREE.Vector3) => void; wind: THREE.Vector3; bullets: string[]; setBullets: (updater: (prev: string[]) => string[]) => void; sensitivity: number; gameState: GameState; setGameState: (s: GameState) => void; setPausedOpen: (b: boolean) => void; isAiming: boolean; setIsAiming: (v: boolean | ((prev: boolean) => boolean)) => void; resetViewKey: number; zeroElevDeg: number; zeroWindDeg: number; isTouchDevice: boolean; unlockGraceUntil: number }) {
    const { camera, gl } = useThree();
    const lockedRef = useRef(false);
    const handleLock = useCallback(() => {
        lockedRef.current = true;
        if (gameState === "PAUSED") setGameState("PLAYING");
        setPausedOpen(false);
    }, [gameState, setGameState, setPausedOpen]);
    const handleUnlock = useCallback(() => {
        // Ignore unlocks that occur within a brief grace period after starting
        if (Date.now() < unlockGraceUntil) {
            lockedRef.current = false;
            return;
        }
        if (lockedRef.current && gameState === "PLAYING") {
            lockedRef.current = false;
            setGameState("PAUSED");
            setPausedOpen(true);
        }
        setIsAiming(false);
    }, [gameState, setGameState, setPausedOpen, unlockGraceUntil]);

    useEffect(() => {
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    }, [gl]);

    // Reset camera view when requested (e.g., title or mode start)
    useEffect(() => {
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.position.set(0, 1.7, 10);
            camera.lookAt(0, 1.7, 0);
        }
    }, [resetViewKey, camera]);

    // Touch-drag aiming on mobile
    const yawRef = useRef(0);
    const pitchRef = useRef(0);
    const draggingRef = useRef(false);
    const lastTouchRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        if (!isTouchDevice || gameState !== "PLAYING") return;
        const el = document.getElementById("yamaneko-shooter");
        if (!el) return;
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
        yawRef.current = euler.y;
        pitchRef.current = euler.x;
        const onStart = (ev: TouchEvent) => {
            const t = ev.touches[0];
            if (!t) return;
            lastTouchRef.current = { x: t.clientX, y: t.clientY };
            draggingRef.current = true;
        };
        const onMove = (ev: TouchEvent) => {
            if (!draggingRef.current) return;
            const t = ev.touches[0];
            if (!t) return;
            const last = lastTouchRef.current ?? { x: t.clientX, y: t.clientY };
            const dx = t.clientX - last.x;
            const dy = t.clientY - last.y;
            lastTouchRef.current = { x: t.clientX, y: t.clientY };
            const mobileSensitivityScale = 0.5; // モバイルはデフォルト半分の感度（スライダー1.0で0.5倍）
            const k = 0.002 * sensitivity * mobileSensitivityScale; // radians per pixel
            // Invert horizontal control (左右反転)
            yawRef.current -= dx * k;
            pitchRef.current -= dy * k;
            const lim = Math.PI / 2 - 0.02;
            if (pitchRef.current > lim) pitchRef.current = lim;
            if (pitchRef.current < -lim) pitchRef.current = -lim;
            const e = new THREE.Euler(pitchRef.current, yawRef.current, 0, "YXZ");
            camera.quaternion.setFromEuler(e);
            ev.preventDefault();
        };
        const onEnd = () => {
            draggingRef.current = false;
            lastTouchRef.current = null;
            // Fire on release only if aiming and not reloading
            if (isAiming && canShoot) onPointerDown();
        };
        el.addEventListener("touchstart", onStart, { passive: true });
        el.addEventListener("touchmove", onMove, { passive: false });
        el.addEventListener("touchend", onEnd);
        el.addEventListener("touchcancel", onEnd);
        return () => {
            el.removeEventListener("touchstart", onStart as any);
            el.removeEventListener("touchmove", onMove as any);
            el.removeEventListener("touchend", onEnd as any);
            el.removeEventListener("touchcancel", onEnd as any);
        };
    }, [isTouchDevice, gameState, camera, sensitivity, isAiming, canShoot]);

    useFrame(() => {
        const targetFov = isAiming && gameState === "PLAYING" ? 10 : 75;
        if (camera instanceof THREE.PerspectiveCamera) {
            const pc = camera as THREE.PerspectiveCamera;
            pc.fov += (targetFov - pc.fov) * 0.2;
            pc.updateProjectionMatrix();
        }
    });

    const onPointerDown = useCallback(() => {
        if (!canShoot || gameState !== "PLAYING") return;
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        // Apply zero-in adjustments (windage/yaw and elevation/pitch) relative to camera axes
        const yaw = THREE.MathUtils.degToRad(zeroWindDeg);
        const pitch = THREE.MathUtils.degToRad(zeroElevDeg);
        const upAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
        const rightAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
        const qYaw = new THREE.Quaternion().setFromAxisAngle(upAxis, yaw);
        const qPitch = new THREE.Quaternion().setFromAxisAngle(rightAxis, -pitch);
        dir.applyQuaternion(qYaw).applyQuaternion(qPitch).normalize();
        // Spawn slightly below the scope (lower than eye level)
        const origin = new THREE.Vector3();
        camera.getWorldPosition(origin);
        const down = new THREE.Vector3(0, -1, 0).applyQuaternion(camera.quaternion).normalize();
        origin.addScaledVector(down, 0.15);
        onShoot(origin, dir);
    }, [canShoot, gameState, camera, onShoot, zeroElevDeg, zeroWindDeg]);

    // Listen for clicks on the document (works with pointer lock)
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 0) onPointerDown();
            if (e.button === 2) {
                e.preventDefault();
                setIsAiming((v) => !v); // toggle aiming on right-click
            }
        };
        const preventContext = (e: MouseEvent) => {
            e.preventDefault();
        };
        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("contextmenu", preventContext);
        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("contextmenu", preventContext);
        };
    }, [onPointerDown, setIsAiming]);

    // No external trigger; firing happens on touch release

    return (
        <>
            {(!isTouchDevice && gameState === "PLAYING") && (
                <PointerLockControls onLock={handleLock} onUnlock={handleUnlock} selector="#yamaneko-shooter" pointerSpeed={sensitivity / 5} />
            )}
        </>
    );
}

export default function Page() {
    const [gameState, setGameState] = useState<GameState>("TOP");
    const [isDebug, setIsDebug] = useState(false);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(30);
    const [distance, setDistance] = useState<DistanceKey>("normal");
    const [debugDistanceM, setDebugDistanceM] = useState<number>(30);
    const [sensitivity, setSensitivity] = useState(1.0);
    const [windEnabled, setWindEnabled] = useState(true);
    const { vec: wind, angle: windAngle, strength: windStrength, showPopup } = useWind(windEnabled, gameState === "PLAYING");
    const [showPauseOptions, setShowPauseOptions] = useState(false);
    const [resetKey, setResetKey] = useState(0);
    const [hitIds, setHitIds] = useState<Set<string>>(new Set());
    const [bulletIds, setBulletIds] = useState<string[]>([]);
    const [hitFlash, setHitFlash] = useState(false);
    const hitBulletsRef = useRef<Set<string>>(new Set());
    const comboTimerRef = useRef<Map<string, number>>(new Map());
    const [isAiming, setIsAiming] = useState(false);
    const [resetViewKey, setResetViewKey] = useState(0);
    const [zeroElevDeg, setZeroElevDeg] = useState(-0.6);
    const [zeroWindDeg, setZeroWindDeg] = useState(0);
    const [controlMode, setControlMode] = useState<"pc" | "mobile" | null>(null);
    const RELOAD_MS = 600;
    const [reloadUntil, setReloadUntil] = useState<number>(0);
        const [combo, setCombo] = useState(0);
    const [unlockGraceUntil, setUnlockGraceUntil] = useState(0);
    const [debugBulletSpeed, setDebugBulletSpeed] = useState<number>(150);
    

    const stallZ = isDebug ? -debugDistanceM : STALL_DIST[distance];

    // Control mode initial state remains unselected (no heuristic)

    const chooseControlMode = (mode: "pc" | "mobile") => {
        setControlMode(mode);
    };

    // Timer for Score Attack (hundredths precision)
    useEffect(() => {
        if (gameState !== "PLAYING" || isDebug === true) return;
        const DURATION = 30; // seconds
        const start = performance.now();
        setTimeLeft(DURATION);
        let raf = 0;
        const tick = () => {
            const now = performance.now();
            const elapsed = (now - start) / 1000;
            const remaining = Math.max(0, DURATION - elapsed);
            setTimeLeft(remaining);
            if (remaining <= 0) {
                setGameState("GAMEOVER");
                return;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [gameState, isDebug]);

    // Shooting
    const onShoot = useCallback((origin: THREE.Vector3, dir: THREE.Vector3) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setBulletIds((prev) => [...prev, JSON.stringify({ id, origin, dir, speed: debugBulletSpeed })]);
        setReloadUntil(Date.now() + RELOAD_MS);
        const tid = window.setTimeout(() => {
            if (!hitBulletsRef.current.has(id)) {
                setCombo(0);
            }
            comboTimerRef.current.delete(id);
        }, RELOAD_MS);
        comboTimerRef.current.set(id, tid);
    }, [debugBulletSpeed, RELOAD_MS]);

    const expireBullet = useCallback((id: string) => {
        setBulletIds((prev) => prev.filter((b) => JSON.parse(b).id !== id));
        hitBulletsRef.current.delete(id);
        const t = comboTimerRef.current.get(id);
        if (t) {
            clearTimeout(t);
            comboTimerRef.current.delete(id);
        }
    }, []);

    const onBulletHit = useCallback(
        (bulletId: string, id: string) => {
            hitBulletsRef.current.add(bulletId);
            const t = comboTimerRef.current.get(bulletId);
            if (t) {
                clearTimeout(t);
                comboTimerRef.current.delete(bulletId);
            }
            setHitIds((prev) => {
                if (prev.has(id)) return prev;
                const next = new Set(prev);
                next.add(id);
                return next;
            });
            setHitFlash(true);
            setTimeout(() => setHitFlash(false), 200);
            if (!isDebug) {
                setCombo((prev) => {
                    const next = prev + 1;
                    setScore((s) => s + Math.round(50 * Math.pow(1.1, next - 1)));
                    return next;
                });
            }
        },
        [isDebug]
    );

    const onPrizeHitPhysics = useCallback(
        (id: string) => {
            setHitIds((prev) => {
                if (prev.has(id)) return prev;
                const next = new Set(prev);
                next.add(id);
                return next;
            });
            setHitFlash(true);
            setTimeout(() => setHitFlash(false), 200);
            if (!isDebug) {
                setCombo((prev) => {
                    const next = prev + 1;
                    setScore((s) => s + Math.round(50 * Math.pow(1.1, next - 1)));
                    return next;
                });
            }
        },
        [isDebug]
    );

    // End game when all prizes are hit (approx 15). Since positions are deterministic, check when >= 15
    useEffect(() => {
        if (!isDebug && gameState === "PLAYING" && hitIds.size >= 15) {
            setGameState("GAMEOVER");
        }
    }, [hitIds, isDebug, gameState]);

    // Gyro removed: no permission flow needed

    const startDebugMode = () => {
        setIsDebug(true);
        setGameState("PLAYING");
        setShowPauseOptions(false);
        comboTimerRef.current.forEach((tid) => clearTimeout(tid));
        comboTimerRef.current.clear();
        hitBulletsRef.current.clear();
        setHitIds(new Set());
        setBulletIds([]);
    setCombo(0);
        setResetKey((k) => k + 1);
    setIsAiming(controlMode === "mobile");
        setResetViewKey((k) => k + 1);
        if (controlMode === "pc") {
            try {
                const el: any = document.getElementById("yamaneko-shooter");
                if (el && el.requestPointerLock) el.requestPointerLock();
                setUnlockGraceUntil(Date.now() + 400);
            } catch {}
        }
    };

    const startScoreAttack = () => {
        setIsDebug(false);
        setWindEnabled(true);
        setDistance("far");
        setScore(0);
        comboTimerRef.current.forEach((tid) => clearTimeout(tid));
        comboTimerRef.current.clear();
        hitBulletsRef.current.clear();
        setHitIds(new Set());
        setBulletIds([]);
    setCombo(0);
        setResetKey((k) => k + 1);
        setGameState("PLAYING");
    setIsAiming(controlMode === "mobile");
        setResetViewKey((k) => k + 1);
        if (controlMode === "pc") {
            try {
                const el: any = document.getElementById("yamaneko-shooter");
                if (el && el.requestPointerLock) el.requestPointerLock();
                setUnlockGraceUntil(Date.now() + 400);
            } catch {}
        }
    };

    const returnToTitle = () => {
        setGameState("TOP");
        setIsDebug(false);
        setShowPauseOptions(false);
        setScore(0);
        comboTimerRef.current.forEach((tid) => clearTimeout(tid));
        comboTimerRef.current.clear();
        hitBulletsRef.current.clear();
        setHitIds(new Set());
        setBulletIds([]);
        setDistance("normal");
        setCombo(0);
        setResetKey((k) => k + 1);
        setIsAiming(false);
        setResetViewKey((k) => k + 1);
    };

    const allHit = !isDebug && hitIds.size >= 15;
    const timeBonusSecs = timeLeft;
    const finalScore = allHit ? score + Math.ceil(timeBonusSecs * 50) : score;

    // Unlock cursor when not playing (TOP or GAMEOVER)
    useEffect(() => {
        const el = document.getElementById("yamaneko-shooter");
        const doc: any = document;
        const unlock = () => {
            if (doc.exitPointerLock) doc.exitPointerLock();
        };
        if (gameState !== "PLAYING") {
            unlock();
        }
    }, [gameState]);

    return (
        <div id="yamaneko-shooter" className="relative w-screen h-[100dvh] bg-black overflow-hidden">
            <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 75, position: [0, 1.7, 10] }} gl={{ antialias: true }}>
                <color attach="background" args={[0x000020]} />
                <fog attach="fog" args={[0x000020, 0, 300]} />
                <Physics gravity={[0, -9.82, 0]} allowSleep>
                    <Ground />
                    <StallAndTargets stallZ={stallZ} onHit={onPrizeHitPhysics} resetKey={resetKey} />
                    {bulletIds.map((b) => {
                        const parsed = JSON.parse(b);
                        const origin = new THREE.Vector3(parsed.origin.x, parsed.origin.y, parsed.origin.z);
                        const dir = new THREE.Vector3(parsed.dir.x, parsed.dir.y, parsed.dir.z);
                        return (
                            <Bullet key={parsed.id} id={parsed.id} origin={origin} dir={dir} speed={parsed.speed ?? 150} wind={wind} enabled={windEnabled} onExpire={expireBullet} onBulletHit={onBulletHit} />
                        );
                    })}
                    <Shooter
                        canShoot={Date.now() >= reloadUntil}
                        onShoot={onShoot}
                        wind={wind}
                        bullets={bulletIds.map((b) => JSON.parse(b).id)}
                        setBullets={setBulletIds}
                        sensitivity={sensitivity}
                        gameState={gameState}
                        setGameState={setGameState}
                        setPausedOpen={setShowPauseOptions}
                        isAiming={isAiming}
                        setIsAiming={setIsAiming}
                        resetViewKey={resetViewKey}
                        zeroElevDeg={zeroElevDeg}
                        zeroWindDeg={zeroWindDeg}
                        isTouchDevice={controlMode === "mobile"}
                        unlockGraceUntil={unlockGraceUntil}
                    />
                </Physics>
            </Canvas>

            {/* Overlays */}
            {/* Scope overlay */}
            {gameState === "PLAYING" && isAiming && (
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none z-20"
                    style={{ width: "min(100vw, 100dvh)", height: "min(100vw, 100dvh)", boxShadow: "0 0 0 9999px rgba(0,0,0,0.95)" }}
                />
            )}
            {gameState === "PLAYING" && isAiming && (
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
                    style={{ width: "min(100vw, 100dvh)", height: "min(100vw, 100dvh)" }}
                >
                    <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[2px] h-full bg-black/80" />
                    <div className="absolute top-1/2 left-0 -translate-y-1/2 h-[2px] w-full bg-black/80" />
                </div>
            )}
            <div
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 border-4 border-white rotate-45 transition-opacity duration-100 ease-out pointer-events-none z-40 ${hitFlash ? "opacity-100" : "opacity-0"}`}
            />

            {/* Wind info (centered horizontally, midway vertically) */}
            {windEnabled && gameState === "PLAYING" && (
                <div className="absolute left-1/2 -translate-x-1/2 z-40 text-white text-xs md:text-sm flex flex-col items-center pointer-events-none" style={{ top: "25%" }}>
                    <div className="flex items-center bg-black/40 px-2 py-1 rounded-full">
                        <span className="mr-1">{getWindDirText(windAngle)}</span>
                        <div className="ml-1 transition-transform duration-500 ease-out" style={{ transform: `rotate(${(Math.PI / 2 - windAngle)}rad)` }}>
                            <svg width={16 + windStrength * 2} height={16 + windStrength * 2} viewBox="0 0 24 24">
                                <g fill="white">
                                    <polygon points="12,2 15,8 9,8" />
                                    <rect x="11" y="8" width="2" height="14" />
                                </g>
                            </svg>
                        </div>
                    </div>
                    <div className="mt-1 text-[11px] opacity-90">{windStrength.toFixed(1)} m/s</div>
                </div>
            )}
            
            <div className={`fixed top-5 left-1/2 -translate-x-1/2 bg-pink-500 text-white py-2 md:py-3 px-4 md:px-6 rounded-full shadow-lg text-lg md:text-xl transition-all duration-500 z-50 ${showPopup ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"}`}>
                風向きが変わったニャ！🐾
            </div>

            {/* HUD */}
            {gameState === "PLAYING" && !isDebug && (
                <div className="absolute top-3 md:top-5 right-3 md:right-5 z-40 bg-black/50 text-white p-2 md:p-3 rounded-lg text-xl md:text-2xl text-right">
                    <div>Score: <span>{score}</span></div>
                    <div>Time: <span>{timeLeft.toFixed(2)}</span></div>
                    {combo >= 2 && (
                        <div className="mt-1 md:mt-2">
                            <div className="text-yellow-300 font-extrabold">{combo} Combo!</div>
                            {getComboComment(combo) && (
                                <div className="text-sm md:text-base text-pink-300 mt-0.5">{getComboComment(combo)}</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Reload indicator */}
            {gameState === "PLAYING" && Date.now() < reloadUntil && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
                    <svg width="56" height="56" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="18" stroke="rgba(255,255,255,0.25)" strokeWidth="4" fill="none" />
                        {(() => { const total = RELOAD_MS; const remain = Math.max(0, reloadUntil - Date.now()); const prog = 1 - remain / total; const circ = 2 * Math.PI * 18; const dash = Math.max(0, Math.min(circ, circ * prog)); return (
                            <circle cx="20" cy="20" r="18" stroke="#fff" strokeWidth="4" fill="none" strokeDasharray={`${dash},${circ}`} transform="rotate(-90 20 20)" />
                        ); })()}
                    </svg>
                </div>
            )}

            {/* Common UI Buttons */}
            {gameState === "PLAYING" && (
                <>
                    <button data-ui="true" onClick={() => setGameState("PAUSED")} className="absolute bottom-3 left-3 z-50 bg-black/60 text-white text-sm md:text-base px-3 py-2 rounded shadow">
                        メニュー <span className="opacity-70">(Esc)</span>
                    </button>
                    <button data-ui="true" onClick={() => setIsAiming(v => !v)} className="absolute bottom-3 right-3 z-50 bg-black/60 text-white text-sm md:text-base px-3 py-2 rounded shadow">
                        {isAiming ? "通常視点" : "エイム"} <span className="opacity-70">(右クリック)</span>
                    </button>
                </>
            )}

            {/* Bottom hint when not aiming */}
            {gameState === "PLAYING" && !isAiming && (
                <div className="absolute bottom-16 md:bottom-6 left-1/2 -translate-x-1/2 z-40 text-white/70 text-sm md:text-base animate-pulse px-2 text-center">
                    画面右下のエイムボタン / 右クリックでエイム
                </div>
            )}

            {/* Top screen */}
            {gameState === "TOP" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-sky-800/90 text-white p-6 md:p-8 rounded-2xl shadow-lg border-4 border-yellow-300 text-center z-50 w-[90vw] max-w-[420px] break-words">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-yellow-300 mb-4 [text-shadow:_3px_3px_6px_rgb(0_0_0_/_50%)]">やまねこ射的</h1>
                    <button onClick={startScoreAttack} className="w-full p-3 md:p-4 mt-2 bg-yellow-400 hover:bg-yellow-500 text-sky-900 font-bold text-lg md:text-xl rounded-lg shadow-md transition-transform hover:scale-105">スコアアタック</button>
                    <button onClick={startDebugMode} className="w-full p-3 md:p-4 mt-2 bg-gray-500 hover:bg-gray-600 text-white font-bold text-lg md:text-xl rounded-lg shadow-md transition-transform hover:scale-105">デバッグモード</button>
                    <div className="mt-5 text-left space-y-3">
                        <div>
                            <div className="font-bold mb-1 text-center">操作モード</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setControlMode("pc")} className={`p-2 rounded ${controlMode === "pc" ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>PC</button>
                                <button onClick={() => setControlMode("mobile")} className={`p-2 rounded ${controlMode === "mobile" ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>モバイル</button>
                            </div>
                        </div>
                        
                    </div>
                    {controlMode === "pc" && (
                        <p className="mt-4 text-xs md:text-sm">PC: マウスで視点 / 左クリックで発射 / ESCでメニュー</p>
                    )}
                    {controlMode === "mobile" && (
                        <p className="mt-4 text-xs md:text-sm">モバイル: 画面ドラッグでエイム / 指を離して発射 / 右下のボタンで通常⇄エイム切替</p>
                    )}
                    {controlMode == null && (
                        <p className="mt-4 text-xs md:text-sm">操作モードを選択してください（PC / モバイル）</p>
                    )}
                </div>
            )}

            {/* Game Over */}
            {gameState === "GAMEOVER" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-sky-800/90 text-white p-6 md:p-8 rounded-2xl shadow-lg border-4 border-yellow-300 text-center z-50 w-[90vw] max-w-[420px] break-words">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-yellow-300 mb-2 [text-shadow:_3px_3px_6px_rgb(0_0_0_/_50%)]">結果</h1>
                    {allHit && <div className="text-xl md:text-2xl text-pink-300 my-2">タイムボーナス +{Math.ceil(timeBonusSecs * 50)}!</div>}
                    <h2 className="text-2xl md:text-3xl mb-4">Final Score: <span>{finalScore}</span></h2>
                    <button onClick={returnToTitle} className="w-full p-3 md:p-4 mt-2 bg-yellow-400 hover:bg-yellow-500 text-sky-900 font-bold text-lg md:text-xl rounded-lg shadow-md transition-transform hover:scale-105">トップに戻る</button>
                </div>
            )}

            {/* Options (Pause) */}
            {gameState === "PAUSED" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-sky-800/90 text-white p-6 rounded-2xl shadow-lg border-4 border-yellow-300 text-left z-50 w-[90vw] max-w-[420px] break-words">
                    <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">オプション</h2>
                    {isDebug && (
                        <div className="mb-5">
                            <label className="block mb-2 font-bold">風の影響</label>
                            <div className="flex justify-center gap-2">
                                <button onClick={() => setWindEnabled(true)} className={`flex-1 p-2 border border-yellow-300 rounded ${windEnabled ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>オン</button>
                                <button onClick={() => setWindEnabled(false)} className={`flex-1 p-2 border border-yellow-300 rounded ${!windEnabled ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>オフ</button>
                            </div>
                            <div className="mt-4">
                                <label className="block mb-2 font-bold">屋台との距離（m）</label>
                                <input type="number" min={5} max={100} step={1} value={debugDistanceM} onChange={(e) => setDebugDistanceM(Number(e.target.value))} className="w-full text-black rounded px-2 py-1" />
                                <div className="text-sm opacity-80 mt-1">現在: {debugDistanceM} m</div>
                            </div>
                            <div className="mt-4">
                                <label className="block mb-2 font-bold">弾丸初速（m/s）</label>
                                <input type="number" min={50} max={300} step={5} value={debugBulletSpeed} onChange={(e) => setDebugBulletSpeed(Number(e.target.value))} className="w-full text-black rounded px-2 py-1" />
                                <div className="text-sm opacity-80 mt-1">現在: {debugBulletSpeed} m/s</div>
                            </div>
                            <button onClick={() => setResetKey((k) => k + 1)} className="mt-4 w-full p-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg shadow-md">標的をリセット</button>
                        </div>
                    )}
                    <div className="mb-5">
                        <label className="block mb-2 font-bold">ゼロイン（照準補正）</label>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-sm">
                                    <span>エレベーション（上下）</span>
                                    <span>{zeroElevDeg.toFixed(1)}°</span>
                                </div>
                                <input type="range" min={-5} max={5} step={0.1} value={zeroElevDeg} onChange={(e) => setZeroElevDeg(parseFloat(e.target.value))} className="w-full" />
                            </div>
                            <div>
                                <div className="flex justify-between text-sm">
                                    <span>ウィンデージ（左右）</span>
                                    <span>{zeroWindDeg.toFixed(1)}°</span>
                                </div>
                                <input type="range" min={-5} max={5} step={0.1} value={zeroWindDeg} onChange={(e) => setZeroWindDeg(parseFloat(e.target.value))} className="w-full" />
                            </div>
                            <button onClick={() => { setZeroElevDeg(-0.5); setZeroWindDeg(0); }} className="mt-2 w-full p-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg">リセット</button>
                        </div>
                    </div>
                    <div className="mb-5">
                        <label className="block mb-2 font-bold">感度: <span>{sensitivity.toFixed(1)}</span></label>
                        <input type="range" min={0.1} max={2.0} step={0.1} value={sensitivity} onChange={(e) => setSensitivity(parseFloat(e.target.value))} className="w-full" />
                    </div>
                    
                    <button onClick={() => setGameState("PLAYING")} className="w-full p-3 mt-2 bg-green-500 hover:bg-green-600 text-white font-bold text-lg rounded-lg shadow-md">ゲームに戻る</button>
                    <button onClick={returnToTitle} className="w-full p-3 mt-2 bg-red-500 hover:bg-red-600 text-white font-bold text-lg rounded-lg shadow-md">タイトルに戻る</button>
                </div>
            )}

            {/* Debug reset moved into options modal */}

            {/* Mode selection now available on TOP screen */}

            <style jsx global>{`
                body { font-family: 'M PLUS Rounded 1c', sans-serif; }
            `}</style>
        </div>
    );
}