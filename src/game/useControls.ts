'use client';

import { useEffect, useRef } from 'react';

export interface Controls {
  forward: number; // -1..1
  strafe: number;  // -1..1
  yaw: number;     // delta yaw from mouse / right stick
  pitch: number;
  sprint: boolean;
  jump: boolean;
  crouch: boolean;
  pounce: boolean;
  attack: boolean;
  interact: boolean;
  toggleCamera: boolean;
}

export function createControls(): Controls {
  return {
    forward: 0, strafe: 0, yaw: 0, pitch: 0,
    sprint: false, jump: false, crouch: false,
    pounce: false, attack: false, interact: false, toggleCamera: false,
  };
}

export function useKeyboardControls(controlsRef: React.MutableRefObject<Controls>) {
  useEffect(() => {
    const keys: Record<string, boolean> = {};
    function recompute() {
      const c = controlsRef.current;
      c.forward = (keys['w'] || keys['arrowup'] ? 1 : 0) + (keys['s'] || keys['arrowdown'] ? -1 : 0);
      c.strafe  = (keys['d'] || keys['arrowright'] ? 1 : 0) + (keys['a'] || keys['arrowleft'] ? -1 : 0);
      c.sprint = !!keys['shift'];
      c.crouch = !!keys['control'] || !!keys['c'];
      c.jump = !!keys[' '];
    }
    function down(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      keys[k] = true;
      if (k === 'v') controlsRef.current.toggleCamera = true;
      if (k === 'e') controlsRef.current.interact = true;
      if (k === 'f') controlsRef.current.attack = true;
      if (k === 'q') controlsRef.current.pounce = true;
      recompute();
    }
    function up(e: KeyboardEvent) {
      keys[e.key.toLowerCase()] = false;
      recompute();
    }
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [controlsRef]);
}

export function useMouseLook(controlsRef: React.MutableRefObject<Controls>, sensitivity = 0.0025) {
  useEffect(() => {
    let pointerLocked = false;
    function onClick() {
      if (typeof document === 'undefined') return;
      if (!pointerLocked) {
        document.body.requestPointerLock?.();
      }
    }
    function onLockChange() {
      pointerLocked = document.pointerLockElement === document.body;
    }
    function onMove(e: MouseEvent) {
      if (!pointerLocked) return;
      controlsRef.current.yaw   -= e.movementX * sensitivity;
      controlsRef.current.pitch -= e.movementY * sensitivity;
    }
    function onCustomLook(e: Event) {
      const ce = e as CustomEvent<{ dx: number; dy: number }>;
      controlsRef.current.yaw   -= ce.detail.dx * sensitivity;
      controlsRef.current.pitch -= ce.detail.dy * sensitivity;
    }
    document.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMove);
    window.addEventListener('wotc-look', onCustomLook);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMove);
      window.removeEventListener('wotc-look', onCustomLook);
    };
  }, [controlsRef, sensitivity]);
}
