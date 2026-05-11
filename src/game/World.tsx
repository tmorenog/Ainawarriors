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
  const grass = new THREE.Color(season === 'leaf-bare' ? '#d8c89a' : season === 'leaf-fall' ? '#bfa05a' : season === 'newleaf' ? '#86bf5e' : '#6c9a4f');
  const grassDark = new THREE.Color(season === 'leaf-bare' ? '#a89878' : season === 'leaf-fall' ? '#8c6d36' : season === 'newleaf' ? '#5e8d3d' : '#4d7838');
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
    const arr: { p: [number, number, number]; s: number; yaw: number; tilt: number; variant: number }[] = [];
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * 540;
      const z = (rand() - 0.5) * 540;
      // keep clear of river
      if (Math.abs(x - 180) < 28) continue;
      const moor = x < -120;
      if (moor && rand() > 0.15) continue; // pine forest is thinner on the moor
      const y = terrainHeightAt(x, z);
      arr.push({
        p: [x, y, z],
        s: 0.8 + rand() * 1.5,
        yaw: rand() * Math.PI * 2,
        tilt: (rand() - 0.5) * 0.08, // slight per-tree lean
        variant: Math.floor(rand() * 3), // 0,1,2 different layer counts
      });
    }
    return arr;
  }, [count, rand]);

  // Pine bark — slightly textured-looking dark brown with a hint of red.
  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#3a2818', roughness: 1.0, flatShading: true,
  }), []);
  // Layered greens for the needles — deeper in late season.
  const needleDark = useMemo(() => new THREE.MeshStandardMaterial({
    color: season === 'leaf-bare' ? '#1c3324' : season === 'newleaf' ? '#3a6e44' : '#23502f',
    roughness: 0.95, flatShading: true,
  }), [season]);
  const needleMid = useMemo(() => new THREE.MeshStandardMaterial({
    color: season === 'leaf-bare' ? '#2a4530' : season === 'newleaf' ? '#4e8552' : '#306d3a',
    roughness: 0.95, flatShading: true,
  }), [season]);
  const needleLight = useMemo(() => new THREE.MeshStandardMaterial({
    color: season === 'leaf-bare' ? '#3a563d' : season === 'newleaf' ? '#62a063' : '#3f8246',
    roughness: 0.95, flatShading: true,
  }), [season]);

  return (
    <group>
      {list.map((t, i) => {
        // A pine with 5 layered cones: bigger / darker at the base, slimmer
        // / brighter near the top. Trunk is a tapered cylinder with a tiny
        // root flare. Per-tree yaw + slight tilt + variant offsets keep
        // them from looking identical.
        const base = 1.55 + (t.variant === 2 ? 0.1 : 0);
        const layers = [
          { y: 2.8, r: base * 1.20, h: 2.2, mat: needleDark },
          { y: 3.7, r: base * 1.00, h: 2.0, mat: needleDark },
          { y: 4.6, r: base * 0.82, h: 1.8, mat: needleMid },
          { y: 5.4, r: base * 0.62, h: 1.5, mat: needleMid },
          { y: 6.1, r: base * 0.42, h: 1.2, mat: needleLight },
        ];
        if (t.variant === 1) layers.pop(); // shorter pine — 4 layers
        return (
          <group key={i} position={t.p} scale={t.s} rotation={[t.tilt, t.yaw, 0]}>
            {/* root flare */}
            <mesh position={[0, 0.05, 0]} material={trunkMat}>
              <coneGeometry args={[0.36, 0.25, 8]} />
            </mesh>
            {/* trunk — tapered, taller than the old version */}
            <mesh position={[0, 1.8, 0]} material={trunkMat}>
              <cylinderGeometry args={[0.16, 0.30, 3.4, 10]} />
            </mesh>
            {/* needle layers */}
            {layers.map((L, j) => (
              <mesh key={j} position={[0, L.y, 0]} material={L.mat}>
                <coneGeometry args={[L.r, L.h, 12]} />
              </mesh>
            ))}
            {/* a few dangling needle clusters on the outer edge of the lowest
                layer so the silhouette reads as bushy from afar */}
            {t.variant !== 1 && (
              <>
                <mesh position={[0.7, 2.6, 0]} material={needleDark}>
                  <sphereGeometry args={[0.45, 8, 6]} />
                </mesh>
                <mesh position={[-0.6, 2.7, 0.3]} material={needleDark}>
                  <sphereGeometry args={[0.4, 8, 6]} />
                </mesh>
                <mesh position={[0.1, 2.55, -0.6]} material={needleDark}>
                  <sphereGeometry args={[0.42, 8, 6]} />
                </mesh>
              </>
            )}
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
    season === 'leaf-bare' ? '#8a8064' :
    season === 'leaf-fall' ? '#b4924a' :
    season === 'newleaf'   ? '#a3d572' :
                             '#83b95c'
  ), [season]);

  const tipColor = useMemo(() => new THREE.Color(
    season === 'leaf-bare' ? '#b4a888' :
    season === 'leaf-fall' ? '#dcb862' :
    season === 'newleaf'   ? '#cdec97' :
                             '#bcd986'
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

function Stars({ visible, count = 320 }: { visible: boolean; count?: number }) {
  // A dome of point sprites high above the world plus a few "warrior"
  // constellations — bright connected stars that trace the rough outline
  // of a leaping cat, a pouncing kit, and a watching elder. The lore is
  // that StarClan warriors walk the sky at night.
  const ref = useRef<THREE.Points>(null);
  const constellationRef = useRef<THREE.LineSegments>(null);
  const positions = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random() * 0.5;
      const theta = u * Math.PI * 2;
      const phi = Math.acos(1 - 2 * v);
      const r = 240;
      a[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      a[i * 3 + 1] = r * Math.cos(phi) + 80;
      a[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return a;
  }, [count]);

  // Three small constellations placed at compass points around the dome.
  // Each is a list of 3D vertex pairs that THREE.LineSegments connects.
  const constellation = useMemo(() => {
    const verts: number[] = [];
    const cats: { ox: number; oz: number }[] = [
      { ox: -160, oz: -180 }, // North-west: leaping warrior
      { ox:  170, oz: -150 }, // North-east: pouncing kit
      { ox:    0, oz:  220 }, // South: elder
    ];
    const offsets = [
      // simple cat outline: head → body → tail tip → leg → leg
      [[0, 14, 0], [4, 14, 0], [10, 12, 4], [14, 8, 6], [12, 4, 4], [8, 4, 0]],
    ];
    for (const c of cats) {
      const pts = offsets[0];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        verts.push(c.ox + a[0], 110 + a[1], c.oz + a[2]);
        verts.push(c.ox + b[0], 110 + b[1], c.oz + b[2]);
      }
    }
    return new Float32Array(verts);
  }, []);

  useFrame(() => {
    if (ref.current) {
      const mat = ref.current.material as THREE.PointsMaterial;
      const t = performance.now() * 0.0006;
      mat.opacity = visible ? 0.65 + Math.sin(t) * 0.18 : 0;
    }
    if (constellationRef.current) {
      const mat = constellationRef.current.material as THREE.LineBasicMaterial;
      const t = performance.now() * 0.0008;
      mat.opacity = visible ? 0.35 + Math.sin(t) * 0.18 : 0;
    }
  });

  if (!visible) return null;
  return (
    <group>
      <points ref={ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
        </bufferGeometry>
        <pointsMaterial color={'#ffffff'} size={1.4} sizeAttenuation transparent opacity={0.8} depthWrite={false} />
      </points>
      {/* StarClan warriors etched in the sky */}
      <lineSegments ref={constellationRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[constellation, 3]} count={constellation.length / 3} />
        </bufferGeometry>
        <lineBasicMaterial color={'#cdd9ff'} transparent opacity={0.4} depthWrite={false} />
      </lineSegments>
    </group>
  );
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

          {/* High Rock — a layered crag the leader stands on to address the
              clan. Built from stacked boxes plus a sloped "step path" so cats
              can visually walk up to the top. */}
          <group position={[0, 0, -7]}>
            <mesh position={[0, 1.1, 0]}>
              <boxGeometry args={[4.2, 2.2, 2.6]} />
              <meshStandardMaterial color={'#8a8276'} roughness={1} flatShading />
            </mesh>
            <mesh position={[0, 2.35, -0.2]}>
              <boxGeometry args={[3.2, 0.5, 2.2]} />
              <meshStandardMaterial color={'#9a948a'} roughness={1} flatShading />
            </mesh>
            <mesh position={[1.7, 0.45, 1.2]} rotation={[0, 0, -0.18]}>
              <boxGeometry args={[1.6, 0.3, 1.0]} />
              <meshStandardMaterial color={'#7a7268'} roughness={1} flatShading />
            </mesh>
            {/* Clan banner stone glowing on top */}
            <mesh position={[0, 2.85, -0.2]}>
              <sphereGeometry args={[0.28, 12, 12]} />
              <meshStandardMaterial color={c.color} emissive={c.color} emissiveIntensity={0.55} />
            </mesh>
          </group>

          {/* Leader's den — small cave-like hollow at the base of the high rock */}
          <group position={[3.2, 0, -6]}>
            <mesh position={[0, 0.7, 0]}>
              <sphereGeometry args={[1.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
              <meshStandardMaterial color={'#5a544a'} roughness={1} />
            </mesh>
            <mesh position={[0, 0.45, 0.4]}>
              <boxGeometry args={[0.9, 0.7, 0.1]} />
              <meshStandardMaterial color={'#1c1814'} />
            </mesh>
          </group>

          {/* Warriors' den — bramble dome on the right side of the camp */}
          <group position={[5.5, 0, 4]}>
            <mesh position={[0, 0.9, 0]}>
              <sphereGeometry args={[1.8, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshStandardMaterial color={'#3a4a26'} roughness={0.95} flatShading />
            </mesh>
            <mesh position={[0, 0.55, 1.5]}>
              <boxGeometry args={[1.2, 0.9, 0.1]} />
              <meshStandardMaterial color={'#1c1814'} />
            </mesh>
          </group>

          {/* Apprentices' den — left side */}
          <group position={[-5.5, 0, 4]}>
            <mesh position={[0, 0.7, 0]}>
              <sphereGeometry args={[1.4, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshStandardMaterial color={'#4a5a30'} roughness={0.95} flatShading />
            </mesh>
            <mesh position={[0, 0.45, 1.15]}>
              <boxGeometry args={[1.0, 0.7, 0.1]} />
              <meshStandardMaterial color={'#1c1814'} />
            </mesh>
          </group>

          {/* Medicine cat's den — at the back, marked with a small herb
              bundle (green sphere) above the entrance. Sleeping here heals
              you a bit faster. */}
          <group position={[-3.5, 0, -5]}>
            <mesh position={[0, 0.85, 0]}>
              <sphereGeometry args={[1.3, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
              <meshStandardMaterial color={'#3a4a2a'} roughness={0.95} flatShading />
            </mesh>
            <mesh position={[0, 0.55, 1.0]}>
              <boxGeometry args={[0.95, 0.75, 0.1]} />
              <meshStandardMaterial color={'#1a1410'} />
            </mesh>
            <mesh position={[0, 1.45, 0.9]}>
              <sphereGeometry args={[0.2, 10, 8]} />
              <meshStandardMaterial color={'#7ab26a'} emissive={'#3a6a3a'} emissiveIntensity={0.25} />
            </mesh>
          </group>

          {/* Queens' / nursery den — soft moss green, front-left of camp.
              The little mushrooms hint that kits live here. */}
          <group position={[-7, 0, -1]}>
            <mesh position={[0, 0.75, 0]}>
              <sphereGeometry args={[1.5, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshStandardMaterial color={'#5a6a3a'} roughness={0.95} flatShading />
            </mesh>
            <mesh position={[0, 0.5, 1.2]}>
              <boxGeometry args={[1.05, 0.75, 0.1]} />
              <meshStandardMaterial color={'#1c1814'} />
            </mesh>
            {/* tiny mushrooms */}
            {[[0.9, 0.05, 0.3], [-0.9, 0.05, 0.5], [0.4, 0.05, 1.5]].map((p, i) => (
              <group key={i} position={p as [number, number, number]}>
                <mesh position={[0, 0.06, 0]}>
                  <cylinderGeometry args={[0.025, 0.03, 0.12, 6]} />
                  <meshStandardMaterial color={'#e8e0c8'} />
                </mesh>
                <mesh position={[0, 0.13, 0]}>
                  <sphereGeometry args={[0.08, 8, 6]} />
                  <meshStandardMaterial color={'#c43c3c'} />
                </mesh>
              </group>
            ))}
          </group>

          {/* Elders' den — front-right, lower & wider, with a sun-bleached
              log laid out front for napping. */}
          <group position={[6, 0, -1]}>
            <mesh position={[0, 0.6, 0]}>
              <sphereGeometry args={[1.55, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
              <meshStandardMaterial color={'#5a4a30'} roughness={0.95} flatShading />
            </mesh>
            <mesh position={[0, 0.4, 1.25]}>
              <boxGeometry args={[1.1, 0.6, 0.1]} />
              <meshStandardMaterial color={'#1c1814'} />
            </mesh>
            {/* nap log */}
            <mesh position={[1.4, 0.18, 1.0]} rotation={[0, 0.3, Math.PI / 2]}>
              <cylinderGeometry args={[0.18, 0.18, 1.4, 10]} />
              <meshStandardMaterial color={'#a89878'} roughness={0.95} />
            </mesh>
          </group>

          {/* Training post — pounce on it (or just hang around) to practice.
              Stand within ~2.5 units to gain a stamina top-up. */}
          <group position={[-3.5, 0, -3]}>
            <mesh position={[0, 0.9, 0]}>
              <cylinderGeometry args={[0.18, 0.22, 1.8, 8]} />
              <meshStandardMaterial color={'#6a4a2a'} roughness={0.95} />
            </mesh>
            <mesh position={[0, 1.95, 0]}>
              <sphereGeometry args={[0.32, 10, 8]} />
              <meshStandardMaterial color={'#3f2a1a'} roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[2.0, 2.4, 32]} />
              <meshBasicMaterial color={'#cd9b3d'} transparent opacity={0.18} depthWrite={false} />
            </mesh>
          </group>

          {/* Fresh-kill pile — a small mound of caught prey at the centre.
              When a player drops prey, the pile visually grows by adding to
              the global hud "freshKill" tally; we still always render the
              base mound so the camp never looks empty. */}
          <group position={[0, 0, 2]}>
            <mesh position={[0, 0.18, 0]} scale={[1.3, 0.5, 1.3]}>
              <sphereGeometry args={[0.5, 12, 8]} />
              <meshStandardMaterial color={'#7a4a2a'} roughness={0.9} />
            </mesh>
            <mesh position={[0.18, 0.32, 0.05]} scale={[0.7, 0.55, 0.45]}>
              <sphereGeometry args={[0.4, 10, 8]} />
              <meshStandardMaterial color={'#a86a3a'} roughness={0.9} />
            </mesh>
            <mesh position={[-0.22, 0.28, -0.1]} scale={[0.55, 0.5, 0.45]}>
              <sphereGeometry args={[0.35, 10, 8]} />
              <meshStandardMaterial color={'#6a3e22'} roughness={0.9} />
            </mesh>
            {/* small label sphere — clan-coloured pebble marking the pile */}
            <mesh position={[0, 0.02, 0.65]}>
              <sphereGeometry args={[0.12, 10, 8]} />
              <meshStandardMaterial color={c.color} emissive={c.color} emissiveIntensity={0.3} />
            </mesh>
          </group>

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
      <Stars visible={isNight} count={graphics === 'low' ? 140 : graphics === 'medium' ? 240 : 380} />
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
