"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls, OrbitControls } from "@react-three/drei";
import { Physics, useBox, usePlane, useSphere } from "@react-three/cannon";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

type GameState = "TOP" | "PLAYING" | "PAUSED" | "GAMEOVER";
type DistanceKey = "near" | "normal" | "far";
type GameMode = "score" | "free" | "debug" | null;

const STALL_DIST: Record<DistanceKey, number> = { near: -20, normal: -30, far: -45 };

// Recoil defaults for Score/Free modes
const SCORE_FREE_RECOIL_MAG_DEG = 0.6;
const SCORE_FREE_RECOIL_SPEED_DEG_PER_SEC = 10;

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

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
    const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x8b5a2b }), []);
    const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x2e8b57 }), []);
    const yScale = Math.max(1, scale); // ensure trunk (2m base) stays >= 2m in world height
    return (
        <group position={position} scale={[scale, yScale, scale]} castShadow>
            {/* Trunk: base 2m; with yScale>=1 ensures >=2m world height */}
            <mesh position={[0, 1, 0]} material={trunkMat} castShadow>
                <cylinderGeometry args={[0.1, 0.15, 2, 8]} />
            </mesh>
            {/* Leaves: center at 2 + h/2 so bottom is exactly 2 in local; with yScale>=1 keeps >=2 world */}
            <mesh position={[0, 2 + 1.6 / 2, 0]} material={leafMat} castShadow>
                <coneGeometry args={[0.9, 1.6, 12]} />
            </mesh>
        </group>
    );
}

// Bush component removed per request

function EnvForest() {
    const { camera } = useThree();
    const greenMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x2f6f2f }), []);
    const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x8b5a2b }), []);
    const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x2e8b57 }), []);
    const center = useMemo(() => {
        const p = new THREE.Vector3();
        camera.getWorldPosition(p);
        return new THREE.Vector3(p.x, 0, p.z);
    }, []);
    const forward = useMemo(() => {
        const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        f.y = 0;
        if (f.lengthSq() < 1e-6) return new THREE.Vector3(0, 0, -1);
        return f.normalize();
    }, []);
    const trees: Array<[number, number, number, number]> = useMemo(() => {
        const arr: Array<[number, number, number, number]> = [];
        const R = 50; // 50m radius
        const inner = 3; // clear radius near player
    const count = 240; // target count (halved)
        const cosNarrow = Math.cos(THREE.MathUtils.degToRad(5)); // ±5° exclusion
        let attempts = 0;
        const maxAttempts = count * 6;
        while (arr.length < count && attempts < maxAttempts) {
            attempts++;
            const r = inner + Math.random() * (R - inner);
            const t = Math.random() * Math.PI * 2;
            const x = center.x + Math.cos(t) * r;
            const z = center.z + Math.sin(t) * r;
            const dir = new THREE.Vector3(x - center.x, 0, z - center.z).normalize();
            const dot = dir.dot(forward);
            if (dot < 0) continue; // behind player, skip (front 180° only)
            if (dot >= cosNarrow) continue; // within ±5° ahead, skip
            const s = 0.8 + Math.random() * 0.8;
            arr.push([x, 0, z, s]);
        }
        return arr;
    }, []);
    // Build merged geometries for trunks and leaves
    const trunkBase = useMemo(() => new THREE.CylinderGeometry(0.1, 0.15, 2, 8), []);
    const leafBase = useMemo(() => new THREE.ConeGeometry(0.9, 1.6, 12), []);
    const merged = useMemo(() => {
        const trunkGeoms: THREE.BufferGeometry[] = [];
        const leafGeoms: THREE.BufferGeometry[] = [];
        const m = new THREE.Matrix4();
        for (const [x, , z, s] of trees) {
            const yScale = Math.max(1, s);
            // Trunk transform
            m.identity();
            m.makeScale(s, yScale, s);
            m.setPosition(x, yScale, z);
            const tGeom = trunkBase.clone();
            tGeom.applyMatrix4(m);
            trunkGeoms.push(tGeom);
            // Leaves transform: positioned at y = 2 + 0.8 (center of cone), before scaling
            const leafM = new THREE.Matrix4();
            leafM.makeTranslation(0, 2 + 1.6 / 2, 0);
            const scaleM = new THREE.Matrix4().makeScale(s, yScale, s);
            const posM = new THREE.Matrix4().makeTranslation(x, 0, z);
            const finalM = new THREE.Matrix4().multiplyMatrices(posM, new THREE.Matrix4().multiplyMatrices(scaleM, leafM));
            const lGeom = leafBase.clone();
            lGeom.applyMatrix4(finalM);
            leafGeoms.push(lGeom);
        }
        const mergedTrunk = trunkGeoms.length ? BufferGeometryUtils.mergeGeometries(trunkGeoms, false) : null;
        const mergedLeaf = leafGeoms.length ? BufferGeometryUtils.mergeGeometries(leafGeoms, false) : null;
        // Dispose intermediates to free memory
        trunkGeoms.forEach(g => g.dispose());
        leafGeoms.forEach(g => g.dispose());
        return { mergedTrunk, mergedLeaf };
    }, [trees, trunkBase, leafBase]);

    return (
        <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0.01, center.z]} receiveShadow>
                <circleGeometry args={[50, 64]} />
                <meshStandardMaterial color={greenMat.color} />
            </mesh>
            {merged.mergedTrunk && (
                <mesh geometry={merged.mergedTrunk} material={trunkMat} castShadow receiveShadow />
            )}
            {merged.mergedLeaf && (
                <mesh geometry={merged.mergedLeaf} material={leafMat} castShadow />
            )}
        </group>
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

function DecorativeStalls({ stallZ }: { stallZ: number }) {
    const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x1e90ff }), []);
    const white = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xffffff }), []);
    // Shift stalls in Z so the group center aligns near target shelves (stallZ - 0.75)
    const baseCenterZ = -15; // average of -10 and -20
    const targetCenterZ = stallZ - 0.75;
    const dz = targetCenterZ - baseCenterZ;
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
            {buildStall([-15, 0, -10 + dz])}
            {buildStall([15, 0, -10 + dz])}
            {buildStall([-15, 0, -20 + dz])}
            {buildStall([15, 0, -20 + dz])}
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
            <DecorativeStalls stallZ={stallZ} />
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

function Shooter({ reloadUntil, onShoot, wind, bullets, setBullets, sensitivity, gameState, setGameState, setPausedOpen, isAiming, setIsAiming, resetViewKey, zeroElevDeg, zeroWindDeg, isTouchDevice, unlockGraceUntil, aimFov, onCycleMagnification, isDebug, recoilEnabled, recoilMagnitudeDeg, recoilSpeedDegPerSec }: { reloadUntil: number; onShoot: (origin: THREE.Vector3, dir: THREE.Vector3) => void; wind: THREE.Vector3; bullets: string[]; setBullets: (updater: (prev: string[]) => string[]) => void; sensitivity: number; gameState: GameState; setGameState: (s: GameState) => void; setPausedOpen: (b: boolean) => void; isAiming: boolean; setIsAiming: (v: boolean | ((prev: boolean) => boolean)) => void; resetViewKey: number; zeroElevDeg: number; zeroWindDeg: number; isTouchDevice: boolean; unlockGraceUntil: number; aimFov: number; onCycleMagnification: (dir: 1 | -1) => void; isDebug: boolean; recoilEnabled: boolean; recoilMagnitudeDeg: number; recoilSpeedDegPerSec: number }) {
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
    const uiTouchRef = useRef(false);

    const isUiTarget = useCallback((target: EventTarget | null) => {
        let node = target as HTMLElement | null;
        while (node) {
            if (node.getAttribute && (node.getAttribute("data-ui") === "true" || node.getAttribute("role") === "button")) return true;
            const tag = node.tagName?.toLowerCase();
            if (tag === "button" || tag === "input" || tag === "select" || tag === "textarea" || tag === "a") return true;
            node = node.parentElement;
        }
        return false;
    }, []);

    useEffect(() => {
    if (!isTouchDevice || gameState !== "PLAYING") return;
        const el = document.getElementById("yamaneko-shooter");
        if (!el) return;
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
        yawRef.current = euler.y;
        pitchRef.current = euler.x;
        const onStart = (ev: TouchEvent) => {
            uiTouchRef.current = isUiTarget(ev.target);
            if (uiTouchRef.current) {
                draggingRef.current = false;
                lastTouchRef.current = null;
                return;
            }
            const t = ev.touches[0];
            if (!t) return;
            lastTouchRef.current = { x: t.clientX, y: t.clientY };
            draggingRef.current = true;
        };
        const onMove = (ev: TouchEvent) => {
            if (uiTouchRef.current || !draggingRef.current) return;
            const t = ev.touches[0];
            if (!t) return;
            const last = lastTouchRef.current ?? { x: t.clientX, y: t.clientY };
            const dx = t.clientX - last.x;
            const dy = t.clientY - last.y;
            lastTouchRef.current = { x: t.clientX, y: t.clientY };
            const mobileSensitivityScale = 2.0; // モバイル端末用の感度調整
            const currentFov = camera instanceof THREE.PerspectiveCamera ? (camera as THREE.PerspectiveCamera).fov : 75;
            const fovScale = currentFov / 75; // 少ないFOVほど小さく（微細）
            const k = 0.0012 * sensitivity * mobileSensitivityScale * fovScale; // radians per pixel（微細化）
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
            if (uiTouchRef.current) {
                uiTouchRef.current = false;
                draggingRef.current = false;
                lastTouchRef.current = null;
                return;
            }
            draggingRef.current = false;
            lastTouchRef.current = null;
            // Fire on release only if aiming and not reloading
            if (isAiming && Date.now() >= reloadUntil) onPointerDown();
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
    }, [isTouchDevice, gameState, camera, sensitivity, isAiming, reloadUntil, isUiTarget]);

    const recoilAxisRef = useRef<THREE.Vector3 | null>(null);
    const recoilRemainingRef = useRef(0);
    const recoilSpeedRef = useRef(0);

    useEffect(() => {
        recoilSpeedRef.current = THREE.MathUtils.degToRad(recoilSpeedDegPerSec);
    }, [recoilSpeedDegPerSec]);

    useFrame((_, delta) => {
        const targetFov = isAiming ? aimFov : 75;
        if (camera instanceof THREE.PerspectiveCamera) {
            const pc = camera as THREE.PerspectiveCamera;
            pc.fov += (targetFov - pc.fov) * 0.2;
            pc.updateProjectionMatrix();
        }

        // Recoil application (kick up over time, no recovery)
        if (recoilRemainingRef.current > 0 && recoilAxisRef.current) {
            const step = Math.min(recoilRemainingRef.current, recoilSpeedRef.current * Math.max(0, delta));
            if (step > 0) {
                const q = new THREE.Quaternion().setFromAxisAngle(recoilAxisRef.current, step);
                camera.quaternion.premultiply(q);
                recoilRemainingRef.current -= step;
            }
        }
    });

    const onPointerDown = useCallback(() => {
        if (Date.now() < reloadUntil || gameState !== "PLAYING") return;
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

        // Recoil (kick up over time, no recovery) if enabled
        if (recoilEnabled && recoilMagnitudeDeg > 0) {
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
            const yawOffset = THREE.MathUtils.degToRad((Math.random() * 30) - 15);
            const kickAxis = right.clone().applyAxisAngle(forward, yawOffset).normalize();
            const kickRad = THREE.MathUtils.degToRad(recoilMagnitudeDeg);
            recoilAxisRef.current = kickAxis;
            recoilRemainingRef.current += kickRad;
        }
    }, [reloadUntil, gameState, camera, onShoot, zeroElevDeg, zeroWindDeg, recoilEnabled, recoilMagnitudeDeg, recoilSpeedDegPerSec]);

    // Listen for clicks on the document (works with pointer lock)
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 0) {
                if (isUiTarget(e.target)) return;
                onPointerDown();
            }
            if (e.button === 2) {
                e.preventDefault();
                setIsAiming((v) => !v); // toggle aiming on right-click
            }
        };
        const preventContext = (e: MouseEvent) => {
            e.preventDefault();
        };
        const handleWheel = (e: WheelEvent) => {
            if (gameState !== "PLAYING") return;
            if (isTouchDevice) return;
            const delta = e.deltaY;
            if (delta > 0) {
                onCycleMagnification(1);
            } else if (delta < 0) {
                onCycleMagnification(-1);
            }
        };
        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("contextmenu", preventContext);
        document.addEventListener("wheel", handleWheel, { passive: true });
        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("contextmenu", preventContext);
            document.removeEventListener("wheel", handleWheel as any);
        };
    }, [onPointerDown, setIsAiming, gameState, isTouchDevice, onCycleMagnification, isUiTarget]);

    // No external trigger; firing happens on touch release

    return (
        <>
            {(!isTouchDevice && gameState === "PLAYING") && (() => {
                const targetFov = isAiming ? aimFov : 75;
                const fovScale = targetFov / 75; // 少ないFOVほど小さく（微細）
                const pointerSpeedVal = Math.max(0.03, Math.min(1.5, (sensitivity / 6) * fovScale));
                return <PointerLockControls onLock={handleLock} onUnlock={handleUnlock} selector="#yamaneko-shooter" pointerSpeed={pointerSpeedVal} />;
            })()}
        </>
    );
}

export default function Page() {
    const [gameState, setGameState] = useState<GameState>("TOP");
    const [gameMode, setGameMode] = useState<GameMode>(null);
    const isDebug = gameMode === "debug";
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(30);
    const timeLeftRef = useRef(30);
    const lastTickRef = useRef<number | null>(null);
    // legacy distance unused outside debug; use explicit meters for score/free
    const [distance, setDistance] = useState<DistanceKey>("normal");
    const [scoreDistance, setScoreDistance] = useState<"mid" | "long">("mid");
    const [freeDistance, setFreeDistance] = useState<"mid" | "long">("mid");
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
    const [zeroElevDeg, setZeroElevDeg] = useState(-0.1);
    const [zeroWindDeg, setZeroWindDeg] = useState(0);
    const [controlMode, setControlMode] = useState<"pc" | "mobile" | null>(null);
    const [controlModeWarning, setControlModeWarning] = useState(false);
    const RELOAD_MS = 600;
    const [reloadUntil, setReloadUntil] = useState<number>(0);
        const [combo, setCombo] = useState(0);
    const [unlockGraceUntil, setUnlockGraceUntil] = useState(0);
    const [debugBulletSpeed, setDebugBulletSpeed] = useState<number>(150);
    const [freeRecoilEnabled, setFreeRecoilEnabled] = useState<boolean>(true);
    const [debugRecoilEnabled, setDebugRecoilEnabled] = useState<boolean>(false);
    const [debugRecoilMagnitudeDeg, setDebugRecoilMagnitudeDeg] = useState<number>(2.5);
    const [debugRecoilSpeedDegPerSec, setDebugRecoilSpeedDegPerSec] = useState<number>(180);
    const magnifications = useMemo(() => [8, 16, 24], []);
    const [magIndex, setMagIndex] = useState<number>(0);
    const aimFov = useMemo(() => 75 / magnifications[magIndex], [magIndex, magnifications]);
    const [reloadNow, setReloadNow] = useState<number>(Date.now());
    const currentBulletSpeed = useMemo(() => (isDebug ? debugBulletSpeed : 800), [isDebug, debugBulletSpeed]);
    const { recoilEnabled, recoilMagDeg, recoilSpeedDegPerSec } = useMemo(() => {
        if (gameMode === "debug") {
            return {
                recoilEnabled: debugRecoilEnabled && debugRecoilMagnitudeDeg > 0,
                recoilMagDeg: debugRecoilMagnitudeDeg,
                recoilSpeedDegPerSec: debugRecoilSpeedDegPerSec,
            };
        }
        if (gameMode === "free") {
            return {
                recoilEnabled: freeRecoilEnabled && SCORE_FREE_RECOIL_MAG_DEG > 0,
                recoilMagDeg: SCORE_FREE_RECOIL_MAG_DEG,
                recoilSpeedDegPerSec: SCORE_FREE_RECOIL_SPEED_DEG_PER_SEC,
            };
        }
        if (gameMode === "score") {
            return {
                recoilEnabled: SCORE_FREE_RECOIL_MAG_DEG > 0,
                recoilMagDeg: SCORE_FREE_RECOIL_MAG_DEG,
                recoilSpeedDegPerSec: SCORE_FREE_RECOIL_SPEED_DEG_PER_SEC,
            };
        }
        return { recoilEnabled: false, recoilMagDeg: 0, recoilSpeedDegPerSec: 0 };
    }, [gameMode, debugRecoilEnabled, debugRecoilMagnitudeDeg, debugRecoilSpeedDegPerSec, freeRecoilEnabled]);
    const stallZ = useMemo(() => {
        if (isDebug) return -debugDistanceM;
        if (gameMode === "score") return -(scoreDistance === "mid" ? 200 : 400);
        if (gameMode === "free") return -(freeDistance === "mid" ? 200 : 400);
        return -200; // default while on TOP
    }, [isDebug, debugDistanceM, gameMode, scoreDistance, freeDistance]);

    // Control mode initial state remains unselected (no heuristic)

    const chooseControlMode = (mode: "pc" | "mobile") => {
        setControlMode(mode);
        setControlModeWarning(false);
    };

    // Timer for Score mode with proper pause handling
    useEffect(() => {
        let raf = 0;
        const tick = () => {
            const now = performance.now();
            if (gameMode === "score") {
                if (gameState === "PLAYING") {
                    if (lastTickRef.current == null) lastTickRef.current = now;
                    const dt = (now - lastTickRef.current) / 1000;
                    lastTickRef.current = now;
                    if (timeLeftRef.current > 0) {
                        timeLeftRef.current = Math.max(0, timeLeftRef.current - dt);
                        setTimeLeft(timeLeftRef.current);
                        if (timeLeftRef.current <= 0) {
                            setGameState("GAMEOVER");
                        }
                    }
                } else {
                    // Pause: reset last tick so elapsed during pause is ignored
                    lastTickRef.current = now;
                }
            } else {
                lastTickRef.current = now;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [gameMode, gameState]);

    // Shooting
    const onShoot = useCallback((origin: THREE.Vector3, dir: THREE.Vector3) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setBulletIds((prev) => [...prev, JSON.stringify({ id, origin, dir, speed: currentBulletSpeed })]);
        setReloadUntil(Date.now() + RELOAD_MS);
        const tid = window.setTimeout(() => {
            if (!hitBulletsRef.current.has(id)) {
                setCombo(0);
            }
            comboTimerRef.current.delete(id);
        }, RELOAD_MS);
        comboTimerRef.current.set(id, tid);
    }, [currentBulletSpeed, RELOAD_MS]);

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
            if (gameMode === "score" && gameState === "PLAYING") {
                setCombo((prev) => {
                    const next = prev + 1;
                    setScore((s) => s + Math.round(50 * Math.pow(1.1, next - 1)));
                    return next;
                });
            }
        },
        [gameMode, gameState]
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
            if (gameMode === "score" && gameState === "PLAYING") {
                setCombo((prev) => {
                    const next = prev + 1;
                    setScore((s) => s + Math.round(50 * Math.pow(1.1, next - 1)));
                    return next;
                });
            }
        },
        [gameMode, gameState]
    );

    // End game when all prizes are hit (approx 15) in Score mode only
    useEffect(() => {
        if (gameMode === "score" && gameState === "PLAYING" && hitIds.size >= 15) {
            setGameState("GAMEOVER");
        }
    }, [hitIds, gameMode, gameState]);

    // Smooth reload indicator tick
    useEffect(() => {
        if (gameState !== "PLAYING") return;
        let raf = 0;
        const tick = () => {
            setReloadNow(Date.now());
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [gameState]);

    // Gyro removed: no permission flow needed

    const startDebugMode = () => {
        setGameMode("debug");
        setGameState("PLAYING");
        setShowPauseOptions(false);
        setSubmitMsg(null);
        setSubmitErr(null);
        comboTimerRef.current.forEach((tid) => clearTimeout(tid));
        comboTimerRef.current.clear();
        hitBulletsRef.current.clear();
        setHitIds(new Set());
        setBulletIds([]);
        setCombo(0);
        // Debug defaults follow Free mode (800m/s, 200m)
        setDebugBulletSpeed(800);
        setDebugDistanceM(200);
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

    const startScoreMode = (dist: "mid" | "long") => {
        setGameMode("score");
        setWindEnabled(true);
        setScore(0);
        setSubmitMsg(null);
        setSubmitErr(null);
        comboTimerRef.current.forEach((tid) => clearTimeout(tid));
        comboTimerRef.current.clear();
        hitBulletsRef.current.clear();
        setHitIds(new Set());
        setBulletIds([]);
        setCombo(0);
        setResetKey((k) => k + 1);
        scorePostedRef.current = false;
        // Reset timer to 30s and clear tick accumulator
        timeLeftRef.current = 30;
        setTimeLeft(30);
        lastTickRef.current = null;
        setGameState("PLAYING");
        setIsAiming(controlMode === "mobile");
        setScoreDistance(dist);
        setResetViewKey((k) => k + 1);
        if (controlMode === "pc") {
            try {
                const el: any = document.getElementById("yamaneko-shooter");
                if (el && el.requestPointerLock) el.requestPointerLock();
                setUnlockGraceUntil(Date.now() + 400);
            } catch {}
        }
    };

    const startFreeMode = () => {
        setGameMode("free");
        setWindEnabled(true);
        setScore(0);
        setSubmitMsg(null);
        setSubmitErr(null);
        comboTimerRef.current.forEach((tid) => clearTimeout(tid));
        comboTimerRef.current.clear();
        hitBulletsRef.current.clear();
        setHitIds(new Set());
        setBulletIds([]);
        setCombo(0);
        setFreeDistance("mid");
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
        setGameMode(null);
        setShowPauseOptions(false);
        setScore(0);
        setSubmitMsg(null);
        setSubmitErr(null);
        scorePostedRef.current = false;
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

    const allHit = gameMode === "score" && hitIds.size >= 15;
    const timeBonusSecs = timeLeft;
    const baseFinal = allHit ? score + Math.ceil(timeBonusSecs * 50) : score;
    const longMultiplier = gameMode === "score" && scoreDistance === "long" ? 1.5 : 1;
    const finalScore = Math.round(baseFinal * longMultiplier);
    const [submitMsg, setSubmitMsg] = useState<string | null>(null);
    const [submitErr, setSubmitErr] = useState<string | null>(null);

    // Post score once when a Score run ends
    const scorePostedRef = useRef(false);
    useEffect(() => {
        if (gameMode === "score" && gameState === "GAMEOVER" && !scorePostedRef.current) {
            scorePostedRef.current = true;
            const gameTitle = scoreDistance === "long" ? "yamaneko-syateki-long" : "yamaneko-syateki-mid";
            const payload = { user_name: "test", score: finalScore, game_title: gameTitle };
            fetch("/api/scores", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
                .then(async (res) => {
                    if (!res.ok) {
                        const t = await res.text().catch(() => "");
                        throw new Error(t || `HTTP ${res.status}`);
                    }
                    setSubmitErr(null);
                    setSubmitMsg("スコア送信に成功しました");
                    setTimeout(() => setSubmitMsg(null), 3000);
                })
                .catch((e) => {
                    setSubmitMsg(null);
                    setSubmitErr("スコア送信に失敗しました");
                });
        }
    }, [gameMode, gameState, finalScore, scoreDistance]);

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
            <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 75, position: [0, 1.7, 10], far: 800 }} gl={{ antialias: true }}>
                <color attach="background" args={[0x000020]} />
                <fog attach="fog" args={[0x000020, 0, 800]} />
                <Physics gravity={[0, -9.82, 0]} allowSleep>
                    <Ground />
                    <EnvForest />
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
                        reloadUntil={reloadUntil}
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
                        aimFov={aimFov}
                        onCycleMagnification={(dir) => {
                            setMagIndex((i: number) => {
                                const next = (i + (dir === 1 ? 1 : -1) + magnifications.length) % magnifications.length;
                                return next;
                            });
                        }}
                        isDebug={isDebug}
                        recoilEnabled={recoilEnabled}
                        recoilMagnitudeDeg={recoilMagDeg}
                        recoilSpeedDegPerSec={recoilSpeedDegPerSec}
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
                <div
                    className={`absolute left-1/2 -translate-x-1/2 z-40 text-white flex flex-col items-center pointer-events-none ${isAiming ? "text-2xl md:text-3xl" : "text-base md:text-lg"}`}
                    style={{ top: "25%" }}
                >
                    <div className={`flex items-center bg-black/40 rounded-full ${isAiming ? "px-5 py-3" : "px-4 py-2"}`}>
                        <span className="mr-2">{getWindDirText(windAngle)}</span>
                        <div
                            className="ml-1 transition-transform duration-500 ease-out"
                            style={{ transform: `rotate(${(Math.PI / 2 - windAngle)}rad)` }}
                        >
                            <svg
                                width={(isAiming ? 32 : 20) + windStrength * (isAiming ? 4 : 3)}
                                height={(isAiming ? 32 : 20) + windStrength * (isAiming ? 4 : 3)}
                                viewBox="0 0 24 24"
                            >
                                <g fill="white">
                                    <polygon points="12,2 15,8 9,8" />
                                    <rect x="11" y="8" width="2" height="14" />
                                </g>
                            </svg>
                        </div>
                    </div>
                    <div className={`mt-1 opacity-90 ${isAiming ? "text-xl md:text-2xl" : "text-base md:text-lg"}`}>
                        {windStrength.toFixed(1)} m/s
                    </div>
                </div>
            )}
            
            <div className={`fixed top-5 left-1/2 -translate-x-1/2 bg-pink-500 text-white py-2 md:py-3 px-4 md:px-6 rounded-full shadow-lg text-lg md:text-xl transition-all duration-500 z-50 ${showPopup ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"}`}>
                風向きが変わったニャ！🐾
            </div>

            {/* HUD */}
            {gameState === "PLAYING" && gameMode === "score" && (
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

            {(submitMsg || submitErr) && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50">
                    {submitMsg && (
                        <div className="bg-emerald-600 text-white py-2 px-4 rounded-full shadow-lg mb-2">
                            {submitMsg}
                        </div>
                    )}
                    {submitErr && (
                        <div className="bg-red-600 text-white py-2 px-4 rounded-full shadow-lg">
                            {submitErr}
                        </div>
                    )}
                </div>
            )}

            {/* Reload indicator */}
            {gameState === "PLAYING" && reloadNow < reloadUntil && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
                    <svg width="56" height="56" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="18" stroke="rgba(255,255,255,0.25)" strokeWidth="4" fill="none" />
                        {(() => { const total = RELOAD_MS; const remain = Math.max(0, reloadUntil - reloadNow); const prog = 1 - remain / total; const circ = 2 * Math.PI * 18; const dash = Math.max(0, Math.min(circ, circ * prog)); return (
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
                    {/* Magnification buttons */}
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
                        {magnifications.map((m, i) => (
                            <button
                                key={m}
                                data-ui="true"
                                onClick={() => setMagIndex(i)}
                                className={`px-3 py-2 rounded-lg shadow text-sm md:text-base ${magIndex === i ? "bg-yellow-400 text-sky-900" : "bg-black/60 text-white"}`}
                            >
                                x{m}
                            </button>
                        ))}
                    </div>
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
                    <h1
                        className="text-4xl md:text-5xl font-extrabold text-yellow-300 mb-4 [text-shadow:_3px_3px_6px_rgb(0_0_0_/_50%)]"
                        onClick={(e) => {
                            // Hidden debug entry: 3 taps within 1s
                            const key = "dbg-tap";
                            const now = Date.now();
                            const rec = (window as any)[key] as { t0: number; n: number } | undefined;
                            if (!rec || now - rec.t0 > 1000) {
                                (window as any)[key] = { t0: now, n: 1 };
                            } else {
                                const n = rec.n + 1;
                                (window as any)[key] = { t0: rec.t0, n };
                                if (n >= 3) {
                                    (window as any)[key] = undefined;
                                    startDebugMode();
                                }
                            }
                        }}
                    >やまねこ射的</h1>
                    <div className="grid grid-cols-1 gap-2">
                        <button onClick={() => { if (!controlMode) { setControlModeWarning(true); return; } startScoreMode("mid"); }} className="w-full p-3 md:p-4 mt-2 bg-yellow-400 hover:bg-yellow-500 text-sky-900 font-bold text-lg md:text-xl rounded-lg shadow-md transition-transform hover:scale-105">スコアモード（中距離 200m）</button>
                        <button onClick={() => { if (!controlMode) { setControlModeWarning(true); return; } startScoreMode("long"); }} className="w-full p-3 md:p-4 mt-1 bg-yellow-500 hover:bg-yellow-600 text-sky-900 font-bold text-lg md:text-xl rounded-lg shadow-md transition-transform hover:scale-105">スコアモード（長距離 400m）</button>
                        <button onClick={() => { if (!controlMode) { setControlModeWarning(true); return; } startFreeMode(); }} className="w-full p-3 md:p-4 mt-2 bg-gray-500 hover:bg-gray-600 text-white font-bold text-lg md:text-xl rounded-lg shadow-md transition-transform hover:scale-105">フリーモード</button>
                    </div>
                    <div className="mt-5 text-left space-y-3">
                        <div>
                            <div className="font-bold mb-1 text-center">操作モード</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => chooseControlMode("pc")} className={`p-2 rounded ${controlMode === "pc" ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>PC</button>
                                <button onClick={() => chooseControlMode("mobile")} className={`p-2 rounded ${controlMode === "mobile" ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>モバイル</button>
                            </div>
                        </div>
                        
                    </div>
                    {controlMode === "pc" && (
                        <p className="mt-4 text-xs md:text-sm">PC: マウスで視点 / 左クリックで発射 / ESCでメニュー</p>
                    )}
                    {controlMode === "mobile" && (
                        <p className="mt-4 text-xs md:text-sm">モバイル: 画面ドラッグでエイム / 指を離して発射 / 右下のボタンで通常⇄エイム切替</p>
                    )}
                    {(controlMode == null || controlModeWarning) && (
                        <p className="mt-4 text-xs md:text-sm text-red-300">操作モードを選択してください（PC / モバイル）</p>
                    )}
                </div>
            )}

            {/* Game Over */}
            {gameState === "GAMEOVER" && gameMode === "score" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-sky-800/90 text-white p-6 md:p-8 rounded-2xl shadow-lg border-4 border-yellow-300 text-center z-50 w-[90vw] max-w-[420px] break-words">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-yellow-300 mb-2 [text-shadow:_3px_3px_6px_rgb(0_0_0_/_50%)]">結果</h1>
                    {allHit && <div className="text-xl md:text-2xl text-pink-300 my-2">タイムボーナス +{Math.ceil(timeBonusSecs * 50)}!</div>}
                    <h2 className="text-2xl md:text-3xl mb-4">Final Score: <span>{finalScore}{scoreDistance === "long" ? " ×1.5" : ""}</span></h2>
                    <button onClick={returnToTitle} className="w-full p-3 md:p-4 mt-2 bg-yellow-400 hover:bg-yellow-500 text-sky-900 font-bold text-lg md:text-xl rounded-lg shadow-md transition-transform hover:scale-105">トップに戻る</button>
                </div>
            )}

            {/* Options (Pause) */}
            {gameState === "PAUSED" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-sky-800/90 text-white p-6 rounded-2xl shadow-lg border-4 border-yellow-300 text-left z-50 w-[90vw] max-w-[420px] max-h-[80dvh] overflow-y-auto break-words">
                    <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">オプション</h2>
                    {gameMode === "free" && (
                        <div className="mb-5">
                            <label className="block mb-2 font-bold">屋台との距離</label>
                            <div className="flex justify-center gap-2">
                                <button onClick={() => { setFreeDistance("mid"); setResetKey((k) => k + 1); }} className={`flex-1 p-2 border border-yellow-300 rounded ${freeDistance === "mid" ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>中（200m）</button>
                                <button onClick={() => { setFreeDistance("long"); setResetKey((k) => k + 1); }} className={`flex-1 p-2 border border-yellow-300 rounded ${freeDistance === "long" ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>遠（400m）</button>
                            </div>
                        </div>
                    )}
                    {gameMode === "free" && (
                        <div className="mb-5">
                            <label className="block mb-2 font-bold">風の影響</label>
                            <div className="flex justify-center gap-2">
                                <button onClick={() => setWindEnabled(true)} className={`flex-1 p-2 border border-yellow-300 rounded ${windEnabled ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>オン</button>
                                <button onClick={() => setWindEnabled(false)} className={`flex-1 p-2 border border-yellow-300 rounded ${!windEnabled ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>オフ</button>
                            </div>
                        </div>
                    )}
                    {gameMode === "free" && (
                        <div className="mb-5">
                            <label className="block mb-2 font-bold">反動</label>
                            <div className="flex justify-center gap-2">
                                <button onClick={() => setFreeRecoilEnabled(true)} className={`flex-1 p-2 border border-yellow-300 rounded ${freeRecoilEnabled ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>オン</button>
                                <button onClick={() => setFreeRecoilEnabled(false)} className={`flex-1 p-2 border border-yellow-300 rounded ${!freeRecoilEnabled ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>オフ</button>
                            </div>
                        </div>
                    )}
                    {isDebug && (
                        <div className="mb-5">
                            <label className="block mb-2 font-bold">風の影響</label>
                            <div className="flex justify-center gap-2">
                                <button onClick={() => setWindEnabled(true)} className={`flex-1 p-2 border border-yellow-300 rounded ${windEnabled ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>オン</button>
                                <button onClick={() => setWindEnabled(false)} className={`flex-1 p-2 border border-yellow-300 rounded ${!windEnabled ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>オフ</button>
                            </div>
                            <div className="mt-4">
                                <label className="block mb-2 font-bold">屋台との距離（m）</label>
                                <input type="number" min={50} max={600} step={10} value={debugDistanceM} onChange={(e) => { const v = Number(e.target.value); setDebugDistanceM(v); if (!Number.isNaN(v)) setResetKey((k) => k + 1); }} className="w-full text-black rounded px-2 py-1" />
                                <div className="text-sm opacity-80 mt-1">現在: {debugDistanceM} m</div>
                            </div>
                            <div className="mt-4">
                                <label className="block mb-2 font-bold">弾丸初速（m/s）</label>
                                <input type="number" min={50} max={1200} step={10} value={debugBulletSpeed} onChange={(e) => setDebugBulletSpeed(Number(e.target.value))} className="w-full text-black rounded px-2 py-1" />
                                <div className="text-sm opacity-80 mt-1">現在: {debugBulletSpeed} m/s</div>
                            </div>
                            <div className="mt-6 border-t border-white/20 pt-4">
                                <label className="block mb-2 font-bold">反動（デバッグ）</label>
                                <div className="flex justify-center gap-2 mb-3">
                                    <button onClick={() => setDebugRecoilEnabled(true)} className={`flex-1 p-2 border border-yellow-300 rounded ${debugRecoilEnabled ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>オン</button>
                                    <button onClick={() => setDebugRecoilEnabled(false)} className={`flex-1 p-2 border border-yellow-300 rounded ${!debugRecoilEnabled ? "bg-yellow-300 text-sky-900" : "bg-sky-900"}`}>オフ</button>
                                </div>
                                <div className={`space-y-3 ${debugRecoilEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
                                    <div>
                                        <div className="flex justify-between text-sm">
                                            <span>跳ね上がりの大きさ</span>
                                            <span>{debugRecoilMagnitudeDeg.toFixed(2)}°</span>
                                        </div>
                                        <input type="range" min={0} max={10} step={0.1} value={debugRecoilMagnitudeDeg} onChange={(e) => setDebugRecoilMagnitudeDeg(parseFloat(e.target.value))} className="w-full" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm">
                                            <span>跳ね上がりの速度</span>
                                            <span>{debugRecoilSpeedDegPerSec.toFixed(0)} °/s</span>
                                        </div>
                                        <input type="range" min={10} max={100} step={1} value={debugRecoilSpeedDegPerSec} onChange={(e) => setDebugRecoilSpeedDegPerSec(parseFloat(e.target.value))} className="w-full" />
                                    </div>
                                </div>
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
                                    <span>{zeroElevDeg.toFixed(2)}°</span>
                                </div>
                                <input type="range" min={-0.5} max={0.5} step={0.05} value={zeroElevDeg} onChange={(e) => setZeroElevDeg(parseFloat(e.target.value))} className="w-full" />
                            </div>
                            <div>
                                <div className="flex justify-between text-sm">
                                    <span>ウィンデージ（左右）</span>
                                    <span>{zeroWindDeg.toFixed(2)}°</span>
                                </div>
                                <input type="range" min={-0.5} max={0.5} step={0.05} value={zeroWindDeg} onChange={(e) => setZeroWindDeg(parseFloat(e.target.value))} className="w-full" />
                            </div>
                            <button onClick={() => { setZeroElevDeg(-0.1); setZeroWindDeg(0); }} className="mt-2 w-full p-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg">リセット</button>
                        </div>
                    </div>
                    <div className="mb-5">
                        <label className="block mb-2 font-bold">感度: <span>{sensitivity.toFixed(2)}</span></label>
                        <input type="range" min={0.05} max={2.0} step={0.05} value={sensitivity} onChange={(e) => setSensitivity(parseFloat(e.target.value))} className="w-full" />
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