"use client";

import { Component, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";

/**
 * Fluid glass backdrop for the mini media player. The whole pill acts as one
 * glass capsule (native three.js transmission — no custom shaders) refracting
 * an abstract gradient plane behind it, with a slow cursor sway and a gentle
 * idle bob. Renders nothing when WebGL is unavailable (the CSS glass pill
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
  const lens = useRef<THREE.Mesh>(null);
  const { viewport, gl } = useThree();
  const texture = useMemo(createBackdropTexture, []);
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

    // Pill lens: capsule(radius 1, length 6) -> width 8, height 2
    mesh.scale.set(v.width / 8, v.height / 2, 0.5);

    const t = state.clock.elapsedTime;
    const swayX = reduced ? 0 : pointer.x * v.width * 0.03;
    const bobY = reduced ? 0 : Math.sin(t * 1.4) * v.height * 0.015;
    easing.damp3(mesh.position, [swayX, bobY, 11.6], 0.25, delta);
  });

  return (
    <>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[viewport.width * 1.5, viewport.height * 1.5, 1]} />
        <meshBasicMaterial map={texture} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh ref={lens} position={[0, 0, 11.6]} rotation-z={Math.PI / 2}>
        <capsuleGeometry args={[1, 6, 8, 32]} />
        <meshPhysicalMaterial
          transmission={1}
          roughness={0.05}
          thickness={2}
          ior={1.2}
          attenuationColor="#8fa8ff"
          attenuationDistance={2}
          transparent
          side={THREE.DoubleSide}
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
        onCreated={({ gl }) => {
          gl.debug.onShaderError = (_gl, _program, vs, fs) => {
            console.warn("[foyer] GL shader error — vertex:", vs, "fragment:", fs);
          };
        }}
      >
        <GlassScene reduced={reduced} />
      </Canvas>
    </GlassErrorBoundary>
  );
}