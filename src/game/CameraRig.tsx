'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from './useGameStore';

interface Props {
  target: React.MutableRefObject<THREE.Object3D | null>;
  yaw: React.MutableRefObject<number>;
  pitch: React.MutableRefObject<number>;
  mode: 'third' | 'first';
}

// Camera distance is stored on `window` so the on-screen + / − buttons in
// the HUD share a single source of truth with the camera rig — both modules
// import this file, but Next's `dynamic()` chunk-splitting can still hand
// out distinct module instances. Window storage avoids the desync.
const ZOOM_MIN = 1.5;
const ZOOM_MAX = 14;
const ZOOM_DEFAULT = 4.6;
const ZOOM_KEY = '__WOTC_ZOOM__';

function readZoom(): number {
  if (typeof window === 'undefined') return ZOOM_DEFAULT;
  const w = window as any;
  if (typeof w[ZOOM_KEY] !== 'number') w[ZOOM_KEY] = ZOOM_DEFAULT;
  return w[ZOOM_KEY] as number;
}
function writeZoom(d: number) {
  if (typeof window === 'undefined') return;
  (window as any)[ZOOM_KEY] = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, d));
}

export function getCameraZoom() { return readZoom(); }
export function setCameraZoom(d: number) { writeZoom(d); }
export function adjustCameraZoom(delta: number) { writeZoom(readZoom() + delta); }

export function CameraRig({ target, yaw, pitch, mode }: Props) {
  const { camera, gl } = useThree();
  const tmp = useRef(new THREE.Vector3());
  const pinchStart = useRef<number>(0);
  const pinchStartZoom = useRef<number>(readZoom());

  // Wire mouse-wheel and 2-finger pinch to the zoom variable. The R3F canvas
  // is the only DOM element we can attach pointer listeners to inside the
  // useThree hook, so we use it directly.
  useEffect(() => {
    const dom = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Trackpads send fractional deltaY ~1, mouse wheels send ~100. Scale
      // both into the same "1 click → 0.5 forest-units" feel.
      const step = Math.sign(e.deltaY) * Math.max(0.4, Math.min(1.4, Math.abs(e.deltaY) / 80));
      adjustCameraZoom(step);
    };
    const pointers = new Map<number, { x: number; y: number }>();
    const onPointerDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        pinchStart.current = Math.hypot(a.x - b.x, a.y - b.y);
        pinchStartZoom.current = readZoom();
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStart.current > 0) {
        const [a, b] = Array.from(pointers.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const ratio = pinchStart.current / Math.max(1, d);
        setCameraZoom(pinchStartZoom.current * ratio);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart.current = 0;
    };
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointercancel', onPointerUp);
    return () => {
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointercancel', onPointerUp);
    };
  }, [gl]);

  // Slowly advancing angle for the sleep cinematic — the camera orbits
  // around the cat while it loafs / curls / sleeps.
  const sleepAngle = useRef(0);
  // Low-pass-filtered cat Y. The terrain is bumpy at high frequencies and
  // following the cat's Y exactly makes the camera bob/shake as the cat
  // walks. We follow this smoothed value instead.
  const smoothY = useRef<number | null>(null);

  useFrame((_, dt) => {
    if (!target.current) return;
    const t = target.current.position;
    const p = Math.max(-0.9, Math.min(0.9, pitch.current));

    // Maintain the smoothed cat Y. Initialise on first frame, then ease
    // toward the real Y at a much slower rate than X/Z follow (~3/sec).
    if (smoothY.current == null) smoothY.current = t.y;
    smoothY.current += (t.y - smoothY.current) * Math.min(1, dt * 3);
    const ty = smoothY.current;

    // Camera shake — decay the global magnitude each frame and apply a
    // small randomised offset to the camera's position.
    const store = useGameStore.getState();
    const shake = store.cameraShake;
    let shakeX = 0, shakeY = 0, shakeZ = 0;
    if (shake > 0.001) {
      shakeX = (Math.random() - 0.5) * shake;
      shakeY = (Math.random() - 0.5) * shake;
      shakeZ = (Math.random() - 0.5) * shake;
      store.setCameraShake(Math.max(0, shake - dt * 3));
    }

    // Sleep cinematic — when the player is in any sleep stage, override
    // the normal follow camera with a tight orbiting close-up of the cat.
    // Distance and height shift per stage so the framing tightens as the
    // cat curls down, then opens back up as it wakes.
    const stage = store.sleepStage;
    if (stage !== 'idle') {
      sleepAngle.current += dt * 0.25; // slow orbit, ~25s per revolution
      const baseDist =
        stage === 'loaf'   ? 3.6 :
        stage === 'curl'   ? 2.6 :
        stage === 'deep'   ? 2.2 :
        stage === 'waking' ? 4.2 :
        3.0;
      const baseHeight =
        stage === 'loaf'   ? 1.4 :
        stage === 'curl'   ? 0.9 :
        stage === 'deep'   ? 0.7 :
        stage === 'waking' ? 1.6 :
        1.0;
      const cx = t.x + Math.sin(sleepAngle.current) * baseDist;
      const cz = t.z + Math.cos(sleepAngle.current) * baseDist;
      const a = Math.min(1, dt * 4);
      camera.position.lerp(tmp.current.set(cx + shakeX, ty + baseHeight + shakeY, cz + shakeZ), a);
      camera.lookAt(t.x, ty + 0.35, t.z);
      return;
    }

    if (mode === 'first') {
      camera.position.set(t.x + Math.sin(yaw.current) * 0.4 + shakeX, ty + 0.55 + shakeY, t.z + Math.cos(yaw.current) * 0.4 + shakeZ);
      const look = tmp.current.set(
        t.x + Math.sin(yaw.current) * 8,
        ty + 0.55 + p * 4,
        t.z + Math.cos(yaw.current) * 8
      );
      camera.lookAt(look);
    } else {
      const dist = readZoom();
      const offY = 1.8 + p * 1.5 + dist * 0.12;
      const cx = t.x - Math.sin(yaw.current) * dist;
      const cz = t.z - Math.cos(yaw.current) * dist;
      const a = Math.min(1, dt * 8);
      camera.position.lerp(tmp.current.set(cx + shakeX, ty + offY + shakeY, cz + shakeZ), a);
      camera.lookAt(t.x, ty + 0.6, t.z);
    }
  });

  return null;
}
