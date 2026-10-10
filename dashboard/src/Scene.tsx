import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Starfield ────────────────────────────────────────────────────────────────
const Stars = () => {
  const points = useRef<THREE.Points>(null);

  const { positions, sizes } = useMemo(() => {
    const count = 3000;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      sizes[i] = Math.random() * 1.5 + 0.5;
    }
    return { positions, sizes };
  }, []);

  useFrame((state) => {
    if (points.current) {
      // Very gentle drift for depth illusion
      points.current.rotation.y = state.clock.elapsedTime * 0.00015;
      points.current.rotation.x = state.clock.elapsedTime * 0.00008;
      // Subtle parallax from mouse
      points.current.rotation.z = state.pointer.x * 0.008;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={3000} array={positions} itemSize={3} args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" count={3000} array={sizes} itemSize={1} args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.4}
        color="#ffffff"
        transparent
        opacity={0.85}
        sizeAttenuation
        vertexColors={false}
      />
    </points>
  );
};

// ─── Orbital trajectory curve ─────────────────────────────────────────────────
const OrbitalCurve = () => {
  const lineRef = useRef<THREE.Line>(null);

  const points = useMemo(() => {
    const curve = new THREE.EllipseCurve(
      0, 0,           // center
      18, 10,         // xRadius, yRadius
      0, Math.PI * 2, // start/end angle
      false,          // clockwise
      Math.PI * 0.1   // rotation
    );
    const pts = curve.getPoints(120);
    return pts.map((p) => new THREE.Vector3(p.x, p.y, 0));
  }, []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    return g;
  }, [points]);

  useFrame((state) => {
    if (lineRef.current) {
      lineRef.current.rotation.x = 1.2;
      lineRef.current.rotation.y = state.clock.elapsedTime * 0.04;
    }
  });

  return (
    // @ts-expect-error Three.js line vs SVGLineElement
    <line ref={lineRef as any} geometry={geometry} position={[3, -1, -8]}>
      <lineBasicMaterial color="#22d3ee" transparent opacity={0.12} linewidth={1} />
    </line>
  );
};

// ─── Second orbital curve (dashed-look via opacity) ───────────────────────────
const OrbitalCurve2 = () => {
  const lineRef = useRef<THREE.Line>(null);

  const points = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, 22, 13, 0, Math.PI * 2, false, Math.PI * 0.6);
    const pts = curve.getPoints(80);
    return pts.map((p) => new THREE.Vector3(p.x, p.y, 0));
  }, []);

  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  useFrame((state) => {
    if (lineRef.current) {
      lineRef.current.rotation.x = 1.0;
      lineRef.current.rotation.y = -state.clock.elapsedTime * 0.025;
    }
  });

  return (
    // @ts-expect-error Three.js line vs SVGLineElement
    <line ref={lineRef as any} geometry={geometry} position={[2, 0, -10]}>
      <lineBasicMaterial color="#7dd3fc" transparent opacity={0.07} />
    </line>
  );
};

// ─── Telemetry signal ping dots ───────────────────────────────────────────────
const TelemetryDots = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => [
    [5, 1, -2], [-3, 2, -3], [7, -2, -1], [2, 3, -4], [-1, -1, -2],
  ], []);

  useFrame((state) => {
    if (!meshRef.current) return;
    positions.forEach((pos, i) => {
      const scale = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2 + i * 1.3);
      const matrix = new THREE.Matrix4();
      matrix.setPosition(pos[0], pos[1], pos[2]);
      matrix.scale(new THREE.Vector3(scale * 0.05, scale * 0.05, scale * 0.05));
      meshRef.current!.setMatrixAt(i, matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 5]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#22d3ee" transparent opacity={0.6} />
    </instancedMesh>
  );
};

// ─── Main exported Scene ──────────────────────────────────────────────────────
export const Scene = ({ onSatelliteClick }: { onSatelliteClick?: () => void }) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 50 }}
      style={{ background: 'transparent', position: 'absolute', inset: 0, zIndex: 1 }}
      gl={{ alpha: true, antialias: true }}
    >
      <Stars />
      <OrbitalCurve />
      <OrbitalCurve2 />
      <TelemetryDots />
    </Canvas>
  );
};

export default Scene;
