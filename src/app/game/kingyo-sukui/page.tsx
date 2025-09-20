"use client";

import { useState, useRef } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { Sphere, Plane, Circle, Cylinder } from "@react-three/drei";
import { Group, Vector3 } from "three";

// Poi component
function Poi({
  position,
  isPressed,
}: {
  position: Vector3;
  isPressed: boolean;
}) {
  const ref = useRef<Group>(null);

  // Animate poi movement smoothly
  useFrame((state) => {
    if (ref.current) {
      const targetY = isPressed ? -0.2 : 0.5;
      const targetPosition = new Vector3(position.x, targetY, position.z);
      ref.current.position.copy(targetPosition);
    }
  });

  return (
    <group ref={ref}>
      {/* Handle */}
      <Cylinder args={[0.05, 0.05, 1.5]} position={[0, 0, 0.75]}>
        <meshStandardMaterial color="pink" />
      </Cylinder>
      {/* Frame */}
      <Circle args={[0.5, 32]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="pink" side={2} />
      </Circle>
      {/* Paper */}
      <Circle
        args={[0.45, 32]}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
      >
        <meshStandardMaterial
          color="white"
          transparent
          opacity={0.8}
          side={2}
        />
      </Circle>
    </group>
  );
}

export default function Game() {
  const [isPressed, setIsPressed] = useState(false);
  const [poiPosition, setPoiPosition] = useState(new Vector3(0, 0.5, 0));

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    setPoiPosition(new Vector3(event.point.x, 0.5, event.point.z));
  };

  return (
    <div
      style={{ width: "100vw", height: "100vh", cursor: "none" }}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)} // Release when pointer leaves the window
    >
      <Canvas orthographic camera={{ position: [0, 10, 0], zoom: 50 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[0, 10, 5]} intensity={1} />

        <Poi position={poiPosition} isPressed={isPressed} />

        {/* Goldfish */}
        <Sphere position={[0, 0.1, 0]} args={[0.5, 32, 32]}>
          <meshStandardMaterial color="orange" />
        </Sphere>

        {/* Water (with pointer move handler) */}
        <Plane
          args={[100, 100]} // Make plane large enough to catch all pointer events
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          onPointerMove={handlePointerMove}
        >
          <meshStandardMaterial color="#add8e6" />
        </Plane>
      </Canvas>
    </div>
  );
}
