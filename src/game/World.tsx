'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CLAN_LIST } from '@/lib/clans';
import { terrainHeightAt } from './terrain';

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
  const grassDark = new THREE.Color(season === 'leaf-bare' ? '#9a8b66' : season === 'leaf-fall' ? '#7a5e2a' : season === 'newleaf' ? '#4d7a36' : '#365a2a');
  const dirt = new THREE.Color('#5a4a32');
  const rock = new THREE.Color('#8a8276');
  const snow = new THREE.Color('#eef4f7');
  const sand = new THREE.Color('#bfa977');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeightAt(x, z);
    pos.setY(i, h);

    // Mix two grass shades using a low-freq mask so the ground doesn't look flat-painted
    const mossMask = (Math.sin(x * 0.05) * Math.cos(z * 0.04) + 1) * 0.5;
    let c = grass.clone().lerp(grassDark, 0.35 + mossMask * 0.45);

    if (h < -1.5) c = dirt.clone();
    if (h > 4) c.lerp(rock, Math.min(1, (h - 4) * 0.4));
    if (season === 'leaf-bare' && h > 1.8) c.lerp(snow, 0.7);
    // Sandy banks alongside the river
    if (Math.abs(x - 180) < 32 && Math.abs(x - 180) > 22) c.lerp(sand, 0.55);
    // River water itself
    if (Math.abs(x - 180) < 22) c.set('#3a78a8');
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
      // Plant the tree at its actual terrain height so trunks aren't floating
      const y = terrainHeightAt(x, z);
      arr.push({ p: [x, y, z], s: 0.7 + rand() * 1.6, kind });
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

function GrassTufts({ count, season, dense }: { count: number; season: WorldProps['season']; dense: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tipRef = useRef<THREE.InstancedMesh>(null);
  const rand = useMemo(() => seededRand(4242), []);

  const tuftColor = useMemo(() => new THREE.Color(
    season === 'leaf-bare' ? '#7a6e4a' :
    season === 'leaf-fall' ? '#9a7c3a' :
    season === 'newleaf'   ? '#8fc05a' :
                             '#6c9446'
  ), [season]);

  const tipColor = useMemo(() => new THREE.Color(
    season === 'leaf-bare' ? '#a09478' :
    season === 'leaf-fall' ? '#c8a14d' :
    season === 'newleaf'   ? '#bedf86' :
                             '#a3c477'
  ), [season]);

  const segments = dense ? 6 : 5;
  const tuftGeo = useMemo(() => new THREE.ConeGeometry(0.18, 0.34, segments), [segments]);
  const tipGeo = useMemo(() => new THREE.ConeGeometry(0.10, 0.42, segments), [segments]);
  const tuftMat = useMemo(() => new THREE.MeshStandardMaterial({ color: tuftColor, roughness: 0.95, flatShading: true }), [tuftColor]);
  const tipMat = useMemo(() => new THREE.MeshStandardMaterial({ color: tipColor, roughness: 0.95, flatShading: true }), [tipColor]);

  useEffect(() => () => {
    tuftGeo.dispose(); tipGeo.dispose(); tuftMat.dispose(); tipMat.dispose();
  }, [tuftGeo, tipGeo, tuftMat, tipMat]);

  useEffect(() => {
    const tufts = meshRef.current;
    const tips = tipRef.current;
    if (!tufts || !tips) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    let placed = 0;
    let attempts = 0;
    const max = count;
    while (placed < max && attempts < max * 4) {
      attempts++;
      const x = (rand() - 0.5) * 520;
      const z = (rand() - 0.5) * 520;
      if (Math.abs(x - 180) < 32) continue; // skip river
      const y = terrainHeightAt(x, z);
      if (y < -1.4) continue; // dirt patches stay bare
      if (y > 4.5) continue;  // rocky peaks stay bare
      const yaw = rand() * Math.PI * 2;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const sc = 0.7 + rand() * 0.9;
      s.set(sc, 0.55 + rand() * 0.7, sc);
      p.set(x, y, z);
      m.compose(p, q, s);
      tufts.setMatrixAt(placed, m);

      s.set(sc * 0.55, 0.9 + rand() * 0.6, sc * 0.55);
      p.set(x, y + 0.05, z);
      m.compose(p, q, s);
      tips.setMatrixAt(placed, m);
      placed++;
    }
    tufts.count = placed;
    tips.count = placed;
    tufts.instanceMatrix.needsUpdate = true;
    tips.instanceMatrix.needsUpdate = true;
  }, [count, rand]);

  if (count <= 0) return null;
  return (
    <group>
      <instancedMesh ref={meshRef} args={[tuftGeo, tuftMat, count]} />
      <instancedMesh ref={tipRef} args={[tipGeo, tipMat, count]} />
    </group>
  );
}

function Rocks({ count }: { count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const rand = useMemo(() => seededRand(9911), []);
  const rockGeo = useMemo(() => new THREE.DodecahedronGeometry(0.6, 0), []);
  const rockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7d7872', roughness: 1, flatShading: true }), []);
  useEffect(() => () => { rockGeo.dispose(); rockMat.dispose(); }, [rockGeo, rockMat]);

  useEffect(() => {
    const rocks = meshRef.current;
    if (!rocks) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 6) {
      attempts++;
      const x = (rand() - 0.5) * 520;
      const z = (rand() - 0.5) * 520;
      if (Math.abs(x - 180) < 28) continue;
      const y = terrainHeightAt(x, z);
      const yaw = rand() * Math.PI * 2;
      const tilt = (rand() - 0.5) * 0.4;
      q.setFromEuler(new THREE.Euler(tilt, yaw, tilt * 0.5));
      const sx = 0.5 + rand() * 1.6;
      const sy = 0.35 + rand() * 0.9;
      const sz = 0.5 + rand() * 1.6;
      s.set(sx, sy, sz);
      p.set(x, y + sy * 0.35, z);
      m.compose(p, q, s);
      rocks.setMatrixAt(placed, m);
      placed++;
    }
    rocks.count = placed;
    rocks.instanceMatrix.needsUpdate = true;
  }, [count, rand]);

  if (count <= 0) return null;
  return <instancedMesh ref={meshRef} args={[rockGeo, rockMat, count]} receiveShadow />;
}

function Clouds({ count, isNight }: { count: number; isNight: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const rand = useMemo(() => seededRand(55), []);
  const list = useMemo(() => {
    return Array.from({ length: count }).map(() => ({
      p: [(rand() - 0.5) * 500, 40 + rand() * 18, (rand() - 0.5) * 500] as [number, number, number],
      s: 6 + rand() * 14,
      drift: 0.4 + rand() * 0.8,
    }));
  }, [count, rand]);

  useFrame((_, dt) => {
    const group = groupRef.current;
    if (!group) return;
    const kids = group.children;
    const n = Math.min(kids.length, list.length);
    for (let i = 0; i < n; i++) {
      const k = kids[i];
      if (!k) continue;
      k.position.x += list[i].drift * dt;
      if (k.position.x > 280) k.position.x = -280;
    }
  });

  if (count <= 0) return null;
  const color = isNight ? '#3a4666' : '#f5f7fa';
  return (
    <group ref={groupRef}>
      {list.map((c, i) => (
        <mesh key={i} position={c.p}>
          <sphereGeometry args={[c.s, 8, 6]} />
          <meshBasicMaterial color={color} transparent opacity={isNight ? 0.45 : 0.7} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Camps() {
  return (
    <group>
      {CLAN_LIST.map((c) => (
        <group
          key={c.id}
          position={[c.campCenter[0], terrainHeightAt(c.campCenter[0], c.campCenter[2]), c.campCenter[2]]}
        >
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
  const treeCount = graphics === 'low' ? 50 : graphics === 'medium' ? 120 : 240;
  const grassCount = graphics === 'low' ? 0 : graphics === 'medium' ? 220 : 480;
  const rockCount = graphics === 'low' ? 14 : graphics === 'medium' ? 32 : 60;
  const cloudCount = graphics === 'low' ? 4 : graphics === 'medium' ? 8 : 14;
  const terrainGeo = useMemo(() => makeTerrain(600, graphics === 'low' ? 48 : graphics === 'medium' ? 72 : 96, season), [season, graphics]);

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

      {/* sun / moon — shadows only on 'high' to avoid framebuffer alloc crashes */}
      <directionalLight
        position={[sunX * 100, Math.max(0.1, sunY) * 100 + 10, 50]}
        intensity={isNight ? 0.18 : 1.0}
        color={isNight ? '#a5b8e8' : sunY < 0.2 ? '#ffc89a' : '#fff7e8'}
        castShadow={graphics === 'high'}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Ambient + hemisphere fill so the scene is well lit even if the
          directional light fails to compute on a constrained device */}
      <ambientLight intensity={isNight ? 0.5 : 0.85} color={isNight ? '#243049' : '#ffffff'} />
      <hemisphereLight args={[isNight ? '#aabbe6' : '#cfe9f3', isNight ? '#10162a' : '#5a7d4f', 0.6]} />

      {/* terrain */}
      <mesh receiveShadow geometry={terrainGeo}>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </mesh>

      <Trees count={treeCount} season={season} />
      {grassCount > 0 && <GrassTufts count={grassCount} season={season} dense={graphics === 'high'} />}
      <Rocks count={rockCount} />
      <Clouds count={cloudCount} isNight={isNight} />
      <Camps />

      {/* twoleg place: simple boxy buildings */}
      <group position={[260, terrainHeightAt(260, 240), 240]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[i * 6 - 9, 1.5, (i % 2) * 5]}>
            <boxGeometry args={[4, 3, 4]} />
            <meshStandardMaterial color={['#a04848', '#cdb673', '#7a8a9c', '#e2c89a'][i]} roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* moonpool stone ring */}
      <group position={[-220, terrainHeightAt(-220, -220), -220]}>
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
