'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

interface Props {
  target: React.MutableRefObject<THREE.Object3D | null>;
  yaw: React.MutableRefObject<number>;
  pitch: React.MutableRefObject<number>;
  mode: 'third' | 'first';
}

export function CameraRig({ target, yaw, pitch, mode }: Props) {
  const { camera } = useThree();
  const tmp = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!target.current) return;
    const t = target.current.position;
    const p = Math.max(-0.9, Math.min(0.9, pitch.current));
    if (mode === 'first') {
      camera.position.set(t.x + Math.sin(yaw.current) * 0.4, t.y + 0.55, t.z + Math.cos(yaw.current) * 0.4);
      const look = tmp.current.set(
        t.x + Math.sin(yaw.current) * 8,
        t.y + 0.55 + p * 4,
        t.z + Math.cos(yaw.current) * 8
      );
      camera.lookAt(look);
    } else {
      const dist = 4.6;
      const offY = 1.8 + p * 1.5;
      const cx = t.x - Math.sin(yaw.current) * dist;
      const cz = t.z - Math.cos(yaw.current) * dist;
      camera.position.lerp(tmp.current.set(cx, t.y + offY, cz), 0.15);
      camera.lookAt(t.x, t.y + 0.6, t.z);
    }
  });

  return null;
}
