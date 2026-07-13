"use client";

import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";

/**
 * The Vetri WebGL core — a real 3D scene (Three.js via react-three-fiber): a
 * rotating wireframe energy sphere around a glowing reactor. Rendered client-only
 * and lazy-loaded so it never bloats SSR or the initial bundle.
 */
function Core() {
  const group = React.useRef<Group>(null);
  const inner = React.useRef<Group>(null);
  useFrame((_, dt) => {
    if (group.current) {
      group.current.rotation.y += dt * 0.35;
      group.current.rotation.x += dt * 0.08;
    }
    if (inner.current) {
      inner.current.rotation.y -= dt * 0.6;
      inner.current.rotation.z += dt * 0.2;
    }
  });
  return (
    <>
      <group ref={group}>
        <mesh>
          <icosahedronGeometry args={[1.55, 1]} />
          <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.5} />
        </mesh>
        <mesh rotation={[0.5, 0.3, 0]}>
          <icosahedronGeometry args={[1.9, 0]} />
          <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.22} />
        </mesh>
      </group>
      <group ref={inner}>
        <mesh>
          <torusGeometry args={[1.05, 0.02, 12, 60]} />
          <meshBasicMaterial color="#67e8f9" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.05, 0.02, 12, 60]} />
          <meshBasicMaterial color="#67e8f9" transparent opacity={0.6} />
        </mesh>
      </group>
      {/* Glowing reactor core */}
      <mesh>
        <sphereGeometry args={[0.55, 48, 48]} />
        <meshStandardMaterial color="#a5f3fc" emissive="#22d3ee" emissiveIntensity={2.2} roughness={0.15} metalness={0.7} />
      </mesh>
    </>
  );
}

export default function VetriCore3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.6], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.7} />
      <pointLight position={[3, 3, 4]} intensity={60} color="#22d3ee" />
      <pointLight position={[-3, -2, 2]} intensity={30} color="#3b82f6" />
      <Core />
    </Canvas>
  );
}
