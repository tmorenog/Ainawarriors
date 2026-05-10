'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CLAN_LIST } from '@/lib/clans';

interface WorldProps {
  timeOfDay: number; // 0..1
  weather: 'clear' | 'rain' | 'fog' | 'snow' | 'storm';
  season: 'newleaf' | 'greenleaf' | 'leaf-fall' | 'leaf-bare';
  graphics: 'low' | 'medium' | 'high';
}

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function makeTerrain(size = 600, seg = 96, season: WorldProps['season']) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors: number[] = [];
  const grass = new THREE.Color(season === 'leaf-bare' ? '#c5b58a' : season === 'leaf-fall' ? '#a78b48' : season === 'newleaf' ? '#6b9a4d' : '#4f7a45');
  const dirt = new THREE.Color('#5a4a32');
  const rock = new THREE.Color('#8a8276');
  const snow = new THREE.Color('#eef4f7');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.sqrt(x * x + z * z);
    let h =
      Math.sin(x * 0.012) * 1.4 +
      Math.cos(z * 0.013) * 1.4 +
      Math.sin((x + z) * 0.005) * 2.4 +
      Math.cos((x - z) * 0.008) * 1.0;
    // riverbed channel near +X
    const river = Math.exp(-Math.pow((x - 180) / 30, 2));
    h -= river * 3.2;
    // moor (windclan) lower flat
    if (x < -120) h *= 0.4;
    pos.setY(i, h);

    let c = grass.clone();
    if (h < -1.5) c = dirt.clone();
    if (h > 4) c.lerp(rock, 0.6);
    if (season === 'leaf-bare' && h > 1.8) c.lerp(snow, 0.7);
    if (Math.abs(x - 180) < 28) c.set('#3a78a8'); // river
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function Trees({ count, season }: { count: number; season: WorldProps['season'] }) {
  const rand = useMemo(() => seededRand(1337), []);
  const list = useMemo(() => {
    const arr: { p: [number, number, number]; s: number; kind: 'oak' | 'pine' | 'birch' }[] = [];
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * 540;
      const z = (rand() - 0.5) * 540;
      // keep clear of river
      if (Math.abs(x - 180) < 28) continue;
      const moor = x < -120;
      if (moor && rand() > 0.15) continue;
      const shadow = z > 90 && x < 30;
      const kind: 'oak' | 'pine' | 'birch' = shadow ? 'pine' : moor ? 'birch' : (rand() < 0.6 ? 'oak' : 'birch');
      arr.push({ p: [x, 0, z], s: 0.7 + rand() * 1.6, kind });
    }
    return arr;
  }, [count, rand]);

  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3b2a1c', roughness: 0.95 }), []);
  const oakLeaf = useMemo(() => new THREE.MeshStandardMaterial({
    color: season === 'leaf-bare' ? '#5b4a36' : season === 'leaf-fall' ? '#c47a2a' : season === 'newleaf' ? '#7fb04a' : '#3f6c34',
    roughness: 0.85,
  }), [season]);
  const pineLeaf = useMemo(() => new THREE.MeshStandardMaterial({
    color: season === 'leaf-bare' ? '#2a4030' : '#2c5a3a',
    roughness: 0.85,
  }), [season]);
  const birchLeaf = useMemo(() => new THREE.MeshStandardMaterial({
    color: season === 'leaf-fall' ? '#e2bb4b' : season === 'leaf-bare' ? '#b6ac88' : '#9bbf6a',
    roughness: 0.85,
  }), [season]);
  const birchTrunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8e2d2', roughness: 0.9 }), []);

  return (
    <group>
      {list.map((t, i) => {
        if (t.kind === 'pine') {
          return (
            <group key={i} position={t.p} scale={t.s}>
              <mesh position={[0, 1.6, 0]} material={trunkMat}>
                <cylinderGeometry args={[0.18, 0.26, 3.2, 8]} />
              </mesh>
              <mesh position={[0, 3.2, 0]} material={pineLeaf}><coneGeometry args={[1.3, 2.2, 10]} /></mesh>
              <mesh position={[0, 4.0, 0]} material={pineLeaf}><coneGeometry args={[1.0, 1.8, 10]} /></mesh>
              <mesh position={[0, 4.8, 0]} material={pineLeaf}><coneGeometry args={[0.7, 1.4, 10]} /></mesh>
            </group>
          );
        }
        if (t.kind === 'birch') {
          return (
            <group key={i} position={t.p} scale={t.s}>
              <mesh position={[0, 1.4, 0]} material={birchTrunkMat}>
                <cylinderGeometry args={[0.13, 0.17, 2.8, 8]} />
              </mesh>
              <mesh position={[0, 2.9, 0]} material={birchLeaf}>
                <sphereGeometry args={[1.0, 10, 8]} />
              </mesh>
            </group>
          );
        }
        return (
          <group key={i} position={t.p} scale={t.s}>
            <mesh position={[0, 1.5, 0]} material={trunkMat}>
              <cylinderGeometry args={[0.28, 0.4, 3.0, 10]} />
            </mesh>
            <mesh position={[0, 3.4, 0]} material={oakLeaf}><sphereGeometry args={[1.6, 12, 10]} /></mesh>
            <mesh position={[0.6, 3.2, 0.6]} material={oakLeaf}><sphereGeometry args={[1.0, 10, 8]} /></mesh>
            <mesh position={[-0.7, 3.0, -0.5]} material={oakLeaf}><sphereGeometry args={[1.1, 10, 8]} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

function Camps() {
  return (
    <group>
      {CLAN_LIST.map((c) => (
        <group key={c.id} position={c.campCenter}>
          {/* clearing */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
            <circleGeometry args={[12, 24]} />
            <meshStandardMaterial color={'#7a6a4a'} roughness={1} />
          </mesh>
          {/* leader rock / highrock */}
          <mesh position={[0, 1.0, -6]}>
            <boxGeometry args={[3, 1.6, 2]} />
            <meshStandardMaterial color={'#8a8276'} roughness={1} />
          </mesh>
          {/* bramble walls (ring of bushes) */}
          {Array.from({ length: 18 }).map((_, i) => {
            const a = (i / 18) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 12, 0.6, Math.sin(a) * 12]}>
                <sphereGeometry args={[1.0, 8, 6]} />
                <meshStandardMaterial color={'#3f5a2c'} roughness={0.95} />
              </mesh>
            );
          })}
          {/* clan banner color stone */}
          <mesh position={[0, 1.95, -6]}>
            <sphereGeometry args={[0.25, 12, 12]} />
            <meshStandardMaterial color={c.color} emissive={c.color} emissiveIntensity={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Rain({ intensity = 600, hidden }: { intensity?: number; hidden?: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const a = new Float32Array(intensity * 3);
    for (let i = 0; i < intensity; i++) {
      a[i * 3] = (Math.random() - 0.5) * 200;
      a[i * 3 + 1] = Math.random() * 40;
      a[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    return a;
  }, [intensity]);
  useFrame((_, dt) => {
    if (!ref.current || hidden) return;
    const arr = (ref.current.geometry.attributes.position.array as Float32Array);
    for (let i = 0; i < intensity; i++) {
      arr[i * 3 + 1] -= dt * 30;
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 40;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });
  if (hidden) return null;
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={intensity} />
      </bufferGeometry>
      <pointsMaterial color={'#9cc'} size={0.08} transparent opacity={0.7} />
    </points>
  );
}

function Snow({ intensity = 400, hidden }: { intensity?: number; hidden?: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const a = new Float32Array(intensity * 3);
    for (let i = 0; i < intensity; i++) {
      a[i * 3] = (Math.random() - 0.5) * 200;
      a[i * 3 + 1] = Math.random() * 30;
      a[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    return a;
  }, [intensity]);
  useFrame((_, dt) => {
    if (!ref.current || hidden) return;
    const arr = (ref.current.geometry.attributes.position.array as Float32Array);
    for (let i = 0; i < intensity; i++) {
      arr[i * 3] += Math.sin(performance.now() * 0.0005 + i) * dt * 0.5;
      arr[i * 3 + 1] -= dt * 2.5;
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 30;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });
  if (hidden) return null;
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={intensity} />
      </bufferGeometry>
      <pointsMaterial color={'#fff'} size={0.18} transparent opacity={0.85} />
    </points>
  );
}

export function World({ timeOfDay, weather, season, graphics }: WorldProps) {
  const treeCount = graphics === 'low' ? 80 : graphics === 'medium' ? 180 : 320;
  const terrainGeo = useMemo(() => makeTerrain(600, graphics === 'low' ? 64 : 96, season), [season, graphics]);

  // sun/moon angle from timeOfDay (0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset)
  const sunAngle = (timeOfDay - 0.25) * Math.PI * 2;
  const sunY = Math.sin(sunAngle);
  const sunX = Math.cos(sunAngle);
  const isNight = sunY < 0;
  const skyTop = isNight ? '#0b1230' : sunY < 0.2 ? '#e9966b' : '#7ec8e3';
  const skyBot = isNight ? '#1c1c30' : sunY < 0.2 ? '#f5cda3' : '#cfe9f3';

  const fog = weather === 'fog' ? 30 : weather === 'rain' || weather === 'storm' ? 80 : 220;
  const fogColor = isNight ? '#0b0f1f' : weather === 'fog' ? '#cdd9d8' : '#bcd2d6';

  return (
    <>
      <color attach="background" args={[skyTop]} />
      <fog attach="fog" args={[fogColor, 30, fog]} />

      {/* sky color comes from the scene background (above) — no sphere mesh
          needed, which avoids any back-face rendering quirks across browsers */}

      {/* sun / moon */}
      <directionalLight
        position={[sunX * 100, Math.max(0.1, sunY) * 100 + 10, 50]}
        intensity={isNight ? 0.18 : 1.0}
        color={isNight ? '#a5b8e8' : sunY < 0.2 ? '#ffc89a' : '#fff7e8'}
        castShadow={graphics !== 'low'}
        shadow-mapSize-width={graphics === 'high' ? 2048 : 1024}
        shadow-mapSize-height={graphics === 'high' ? 2048 : 1024}
      />
      <ambientLight intensity={isNight ? 0.25 : 0.55} color={isNight ? '#243049' : '#ffffff'} />
      {isNight && (
        <hemisphereLight args={['#aabbe6', '#10162a', 0.4]} />
      )}

      {/* terrain */}
      <mesh receiveShadow geometry={terrainGeo}>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </mesh>

      <Trees count={treeCount} season={season} />
      <Camps />

      {/* twoleg place: simple boxy buildings */}
      <group position={[260, 0, 240]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[i * 6 - 9, 1.5, (i % 2) * 5]}>
            <boxGeometry args={[4, 3, 4]} />
            <meshStandardMaterial color={['#a04848', '#cdb673', '#7a8a9c', '#e2c89a'][i]} roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* moonpool stone ring */}
      <group position={[-220, 0, -220]}>
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 3, 0.4, Math.sin(a) * 3]}>
              <boxGeometry args={[0.8, 0.8, 0.6]} />
              <meshStandardMaterial color={'#7a7a82'} roughness={1} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.6, 24]} />
          <meshStandardMaterial color={isNight ? '#8aaef0' : '#5a8ad8'} emissive={isNight ? '#3a5a9a' : '#000'} emissiveIntensity={isNight ? 0.7 : 0} />
        </mesh>
      </group>

      {/* weather */}
      <Rain hidden={!(weather === 'rain' || weather === 'storm')} intensity={graphics === 'low' ? 250 : 600} />
      <Snow hidden={weather !== 'snow'} intensity={graphics === 'low' ? 150 : 400} />
    </>
  );
}
