"use client";

import { Component, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import { useFBO, MeshTransmissionMaterial } from "@react-three/drei";
import { easing } from "maath";

/**
 * Fluid glass backdrop for the mini media player, adapted from React Bits'
 * "Fluid Glass". A lens-shaped glass mesh with MeshTransmissionMaterial
 * refracts an FBO of an abstract gradient, damped toward the pointer. Renders
 * nothing when WebGL is unavailable (the CSS glass pill remains the fallback).
 */

function createBackdropTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext("2d")!;

  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, "#0a0720");
  g.addColorStop(0.5, "#1a1140");
  g.addColorStop(1, "#0d0a28");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);

  const blobs: Array<[number, number, number, string]> = [
    [150, 80, 170, "rgba(102, 126, 234, 0.75)"],
    [420, 55, 130, "rgba(143, 168, 255, 0.65)"],
    [660, 170, 170, "rgba(157, 122, 232, 0.7)"],
    [880, 70, 120, "rgba(232, 121, 249, 0.45)"],
    [300, 210, 140, "rgba(124, 98, 245, 0.55)"],
  ];
  for (const [x, y, r, col] of blobs) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, "rgba(143, 168, 255, 0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, c.width, c.height);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function GlassScene({ reduced }: { reduced: boolean }) {
  const lens = useRef<THREE.Mesh>(null);
  const buffer = useFBO();
  const { gl, viewport } = useThree();
  const texture = useMemo(createBackdropTexture, []);
  const [backScene] = useState(() => new THREE.Scene());
  const pointer = useMemo(() => new THREE.Vector2(0, 0), []);

  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -(((e.clientY - r.top) / r.height) * 2 - 1)
      );
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [gl, pointer]);

  useFrame((state, delta) => {
    const mesh = lens.current;
    if (!mesh) return;
    const v = state.viewport.getCurrentViewport(state.camera, [0, 0, 12]);

    if (reduced) {
      mesh.position.set(0, 0, 12);
      mesh.scale.setScalar(v.height * 0.45);
      return;
    }

    easing.damp3(
      mesh.position,
      [(pointer.x * v.width) / 2, pointer.y * v.height * 0.15, 12],
      0.18,
      delta
    );
    mesh.scale.setScalar(v.height * 0.45);

    gl.setRenderTarget(buffer);
    gl.render(backScene, state.camera);
    gl.setRenderTarget(null);
  });

  return (
    <>
      {createPortal(
        <mesh position={[0, 0, 11]}>
          <planeGeometry args={[viewport.width, viewport.height, 1]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>,
        backScene
      )}
      <mesh scale={[viewport.width, viewport.height, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={buffer.texture} transparent />
      </mesh>
      <mesh ref={lens} position={[0, 0, 12]}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshTransmissionMaterial
          buffer={buffer.texture}
          ior={1.2}
          thickness={3}
          anisotropy={0.01}
          chromaticAberration={0.15}
        />
      </mesh>
    </>
  );
}

class GlassErrorBoundary extends Component<
  { children?: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function GlassBackdrop() {
  const [supported] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const c = document.createElement("canvas");
      return !!(
        window.WebGLRenderingContext &&
        (c.getContext("webgl2") || c.getContext("webgl"))
      );
    } catch {
      return false;
    }
  });
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  if (!supported) return null;

  return (
    <GlassErrorBoundary>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 12], fov: 15 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        frameloop={reduced ? "demand" : "always"}
      >
        <GlassScene reduced={reduced} />
      </Canvas>
    </GlassErrorBoundary>
  );
}
