"use client";

import { Component, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import { useFBO, MeshTransmissionMaterial, RoundedBox } from "@react-three/drei";
import { easing } from "maath";

/**
 * Fluid glass backdrop for the mini media player, adapted from React Bits'
 * "Fluid Glass" (bar mode). A rounded glass slab anchored to the bottom of the
 * pill refracts an FBO of an abstract gradient; it sways horizontally toward
 * the cursor. Renders nothing when WebGL is unavailable (the CSS glass pill
 * remains the fallback).
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
  const bar = useRef<THREE.Mesh>(null);
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
    const mesh = bar.current;
    if (!mesh) return;
    const v = state.viewport.getCurrentViewport(state.camera, [0, 0, 12]);

    const w = v.width * 0.95;
    const h = v.height * 0.6;
    mesh.scale.set(w / 3.2, h / 0.4, 1);

    const anchorY = -v.height / 2 + h / 2 + v.height * 0.03;
    const destX = reduced ? 0 : pointer.x * v.width * 0.14;
    easing.damp3(mesh.position, [destX, anchorY, 12], 0.35, delta);

    gl.setRenderTarget(buffer);
    gl.render(backScene, state.camera);
    gl.setRenderTarget(null);
  });

  return (
    <>
      {createPortal(
        <mesh position={[0, 0, 11]}>
          <planeGeometry args={[viewport.width, viewport.height, 1]} />
          <meshBasicMaterial map={texture} transparent opacity={0.45} toneMapped={false} />
        </mesh>,
        backScene
      )}
      <mesh scale={[viewport.width, viewport.height, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={buffer.texture} transparent />
      </mesh>
      <RoundedBox
        ref={bar}
        args={[3.2, 0.4, 0.8]}
        radius={0.16}
        smoothness={6}
        position={[0, 0, 12]}
      >
        <MeshTransmissionMaterial
          buffer={buffer.texture}
          transmission={1}
          roughness={0}
          thickness={10}
          ior={1.15}
          chromaticAberration={0.12}
          anisotropy={0.08}
          color="#ffffff"
          attenuationColor="#ffffff"
          attenuationDistance={6}
        />
      </RoundedBox>
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