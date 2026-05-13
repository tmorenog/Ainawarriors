'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { CLAN_LIST } from '@/lib/clans';
import { useGameStore } from './useGameStore';
import { terrainHeightAt, LAKE, STREAM, CLIMBABLE_TREES } from './terrain';
import { THUNDERPATH, NUM_MONSTERS, monsterAt } from './vehicles';

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
    // Tributary 1 — winding east-west stream around z = -120
    const t1Center = -120 + Math.sin(x * 0.02) * 25;
    const dt1 = Math.abs(z - t1Center);
    if (dt1 < 12 && dt1 > 7) c.lerp(sand, 0.45);
    if (dt1 < 7) c.set('#4886b2');
    // Tributary 2 — winding north-south stream around x = -50
    const t2Center = -50 + Math.sin(z * 0.025) * 20;
    const dt2 = Math.abs(x - t2Center);
    if (dt2 < 11 && dt2 > 6) c.lerp(sand, 0.45);
    if (dt2 < 6) c.set('#4886b2');
    // Lake — bigger water body, with sandy beach + the island at the centre.
    const lakeDx = x - LAKE.x;
    const lakeDz = z - LAKE.z;
    const lakeDist = Math.hypot(lakeDx, lakeDz);
    if (lakeDist < LAKE.r + 5 && lakeDist > LAKE.r - 4) c.lerp(sand, 0.55);
    if (lakeDist < LAKE.r - 4 && lakeDist > LAKE.islandR + 1) c.set('#3a78a8');
    if (lakeDist < LAKE.islandR + 1 && lakeDist > LAKE.islandR - 1) c.lerp(sand, 0.6);
    // Small stream feeding the lake from the south
    if (z > STREAM.zMin && z < STREAM.zMax && Math.abs(x - (STREAM.xCenter + Math.sin(z * 0.04) * STREAM.wave)) < STREAM.half - 1) c.set('#4886b2');
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
      // keep clear of river + tributaries
      if (Math.abs(x - 180) < 28) continue;
      const t1c = -120 + Math.sin(x * 0.02) * 25;
      if (Math.abs(z - t1c) < 11) continue;
      const t2c = -50 + Math.sin(z * 0.025) * 20;
      if (Math.abs(x - t2c) < 10) continue;
      // keep clear of twoleg village, barns, moonstone, snakerocks, thunderpath
      if (Math.abs(x - 260) < 40 && Math.abs(z - 240) < 40) continue;
      if (Math.abs(x - 240) < 32 && Math.abs(z + 180) < 32) continue;
      if (Math.abs(x + 280) < 12 && Math.abs(z + 260) < 12) continue;
      if (Math.abs(x - 60) < 10 && Math.abs(z - 70) < 10) continue;
      if (x > -185 && x < 85 && Math.abs(z - 95 - Math.sin(x * 0.015) * 6) < 5) continue;
      // keep clear of the Lake + island, stream, lake-side landmarks
      const ldx = x - LAKE.x, ldz = z - LAKE.z;
      const ldist = Math.hypot(ldx, ldz);
      if (ldist < LAKE.r + 3 && ldist > LAKE.islandR + 1.5) continue; // water + beach
      if (z > STREAM.zMin && z < STREAM.zMax && Math.abs(x - (STREAM.xCenter + Math.sin(z * 0.04) * STREAM.wave)) < STREAM.half + 1) continue; // stream
      if (Math.abs(x - 60) < 12 && Math.abs(z - 145) < 10) continue; // greenleaf cabins
      if (Math.abs(x - 130) < 14 && Math.abs(z - 110) < 14) continue; // abandoned twoleg nest
      if (Math.abs(x - 220) < 22 && Math.abs(z - 60) < 22) continue; // skyclan camp clearing
      if (Math.abs(x + 130) < 4 && z > -180 && z < -30) continue;    // small thunderpath
      if (z > -90 && z < -70 && x > 100 && x < 240) continue;        // old thunderpath segment
      if (Math.abs(x + 10) < 6 && Math.abs(z + 80) < 6) continue;    // ancient oak
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
      const t1cg = -120 + Math.sin(x * 0.02) * 25;
      if (Math.abs(z - t1cg) < 12) continue;
      const t2cg = -50 + Math.sin(z * 0.025) * 20;
      if (Math.abs(x - t2cg) < 11) continue;
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
  // Per-instance color: a mix of bare stone (greys / browns) and mossy
  // rocks (greens). Stones near the river bank get a touch of damp.
  const rockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, vertexColors: false }), []);
  useEffect(() => () => { rockGeo.dispose(); rockMat.dispose(); }, [rockGeo, rockMat]);

  useEffect(() => {
    const rocks = meshRef.current;
    if (!rocks) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    const palette = [
      '#7d7872', // base grey stone
      '#8a8278', // lighter stone
      '#6a6058', // shadow stone
      '#a09682', // sandstone
      '#5e6a48', // mossy
      '#4a5a36', // deep moss
      '#7a684a', // tan
    ];
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 6) {
      attempts++;
      const x = (rand() - 0.5) * 520;
      const z = (rand() - 0.5) * 520;
      if (Math.abs(x - 180) < 28) continue;
      const t1cr = -120 + Math.sin(x * 0.02) * 25;
      if (Math.abs(z - t1cr) < 11) continue;
      const t2cr = -50 + Math.sin(z * 0.025) * 20;
      if (Math.abs(x - t2cr) < 10) continue;
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
      col.set(palette[Math.floor(rand() * palette.length)]);
      rocks.setColorAt(placed, col);
      placed++;
    }
    rocks.count = placed;
    rocks.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
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

          {/* High Rock — irregular layered crag. Multiple stacked + tilted
              stones with slight per-stone shade variation so it reads as
              real rock rather than a box. The flat top (kept walkable via
              terrain.ts) is the leader's perch. */}
          <group position={[0, 0, -7]}>
            {/* Main mass — base block, slightly skewed. Lowered so the
                camp clearing isn't dominated by a 2-metre wall. */}
            <mesh position={[0, 0.65, 0]} rotation={[0, 0.12, 0.04]}>
              <boxGeometry args={[4.2, 1.3, 2.6]} />
              <meshStandardMaterial color={'#8a8276'} roughness={1} flatShading />
            </mesh>
            {/* Outcrop on the right — bigger angled chunk */}
            <mesh position={[1.7, 0.55, 0.6]} rotation={[0, -0.22, -0.18]}>
              <boxGeometry args={[1.8, 1.0, 1.4]} />
              <meshStandardMaterial color={'#7a7268'} roughness={1} flatShading />
            </mesh>
            {/* Outcrop on the left */}
            <mesh position={[-1.6, 0.42, 0.3]} rotation={[0.05, 0.1, 0.22]}>
              <boxGeometry args={[1.5, 0.85, 1.3]} />
              <meshStandardMaterial color={'#9a948a'} roughness={1} flatShading />
            </mesh>
            {/* Flat-ish summit slab — top of the rock, where the leader stands */}
            <mesh position={[0, 1.45, -0.2]}>
              <boxGeometry args={[3.2, 0.3, 2.2]} />
              <meshStandardMaterial color={'#9a948a'} roughness={1} flatShading />
            </mesh>
            {/* Step-stones leading up */}
            <mesh position={[1.7, 0.25, 1.2]} rotation={[0, 0, -0.18]}>
              <boxGeometry args={[1.6, 0.3, 1.0]} />
              <meshStandardMaterial color={'#7a7268'} roughness={1} flatShading />
            </mesh>
            <mesh position={[2.4, 0.55, 0.9]} rotation={[0, 0.18, -0.22]}>
              <boxGeometry args={[1.0, 0.4, 0.85]} />
              <meshStandardMaterial color={'#8a8278'} roughness={1} flatShading />
            </mesh>
            {/* Two small mossy boulders at the base */}
            <mesh position={[-2.2, 0.32, 1.3]} rotation={[0.2, 1.1, 0.1]}>
              <dodecahedronGeometry args={[0.45, 0]} />
              <meshStandardMaterial color={'#5e6a48'} roughness={1} flatShading />
            </mesh>
            <mesh position={[2.7, 0.28, -1.1]} rotation={[0.1, 0.5, -0.08]}>
              <dodecahedronGeometry args={[0.38, 0]} />
              <meshStandardMaterial color={'#4a5a36'} roughness={1} flatShading />
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

// Twoleg place — a small village with two paved paths crossing, twelve
// houses of varying sizes / colours arranged along them, a small park,
// streetlamps, and a parked twoleg "monster" (car). Anchored at the
// world position picked by the World render.
function TwolegPlace({ isNight }: { isNight: boolean }) {
  const anchorX = 260, anchorZ = 240;
  const y = terrainHeightAt(anchorX, anchorZ);

  // Path width / extents. Two crossing paths form a "+" shape.
  // North-south path runs along z, east-west along x.
  const NS_LEN = 50, EW_LEN = 50, PATH_W = 4;

  // Helper to build one house from a config. Position is local to the
  // group; size, palette, and y-shift are randomized via the config.
  const houses = useMemo(() => {
    // Deterministic-ish layout — fixed seed so the village doesn't move
    // between renders.
    const rand = seededRand(7777);
    const palettes = [
      { wall: '#a04848', roof: '#5a2828', shutter: '#3a2018' },
      { wall: '#cdb673', roof: '#6a4a2a', shutter: '#3a2418' },
      { wall: '#7a8a9c', roof: '#3a4250', shutter: '#1c2030' },
      { wall: '#e2c89a', roof: '#7a5a2a', shutter: '#3a2418' },
      { wall: '#9ac08a', roof: '#3a5a3a', shutter: '#1c2a18' },
      { wall: '#c46a4a', roof: '#6a2828', shutter: '#2a1410' },
      { wall: '#bfb0a0', roof: '#5a4030', shutter: '#1c1410' },
      { wall: '#f4d49a', roof: '#7a4a2a', shutter: '#3a2010' },
    ];
    // Place houses on either side of the NS path (x = ±5..±18) and along
    // the EW path (z = ±5..±18), avoiding the paths themselves.
    const slots: Array<{ x: number; z: number; w: number; d: number; h: number; rotY: number; palette: typeof palettes[number] }> = [];
    // North row (z < -5)
    for (let i = 0; i < 3; i++) {
      slots.push({
        x: -18 + i * 12 + (rand() - 0.5) * 2,
        z: -10 - rand() * 5,
        w: 4 + rand() * 1.5,
        d: 4 + rand() * 1.5,
        h: 3 + rand() * 1.2,
        rotY: (rand() - 0.5) * 0.15,
        palette: palettes[Math.floor(rand() * palettes.length)],
      });
    }
    // South row (z > +5)
    for (let i = 0; i < 3; i++) {
      slots.push({
        x: -18 + i * 12 + (rand() - 0.5) * 2,
        z: 10 + rand() * 5,
        w: 4 + rand() * 1.5,
        d: 4 + rand() * 1.5,
        h: 3 + rand() * 1.2,
        rotY: (rand() - 0.5) * 0.15,
        palette: palettes[Math.floor(rand() * palettes.length)],
      });
    }
    // West row (x < -5)
    for (let i = 0; i < 2; i++) {
      slots.push({
        x: -22 - rand() * 4,
        z: -8 + i * 16 + (rand() - 0.5) * 2,
        w: 4 + rand() * 1.5,
        d: 4 + rand() * 1.5,
        h: 3 + rand() * 1.2,
        rotY: (rand() - 0.5) * 0.15 + Math.PI / 2,
        palette: palettes[Math.floor(rand() * palettes.length)],
      });
    }
    // East row (x > +5)
    for (let i = 0; i < 2; i++) {
      slots.push({
        x: 22 + rand() * 4,
        z: -8 + i * 16 + (rand() - 0.5) * 2,
        w: 4 + rand() * 1.5,
        d: 4 + rand() * 1.5,
        h: 3 + rand() * 1.2,
        rotY: (rand() - 0.5) * 0.15 - Math.PI / 2,
        palette: palettes[Math.floor(rand() * palettes.length)],
      });
    }
    // Two larger buildings at the corners — barn / shop
    slots.push({
      x: 18, z: -22,
      w: 6.5, d: 5, h: 3.5, rotY: 0,
      palette: { wall: '#8a4a2a', roof: '#3a1c10', shutter: '#1c1410' },
    });
    slots.push({
      x: -20, z: 22,
      w: 5.5, d: 5.5, h: 3.0, rotY: Math.PI / 6,
      palette: { wall: '#dcc89c', roof: '#5a3a20', shutter: '#1c1410' },
    });
    return slots;
  }, []);

  // Streetlamps along the path edges
  const lamps = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = -2; i <= 2; i++) out.push([i * 10, -PATH_W / 2 - 0.6]); // EW path north side
    for (let i = -2; i <= 2; i++) out.push([i * 10,  PATH_W / 2 + 0.6]); // EW path south side
    for (let i = -2; i <= 2; i++) out.push([-PATH_W / 2 - 0.6, i * 10]); // NS path west side
    for (let i = -2; i <= 2; i++) out.push([ PATH_W / 2 + 0.6, i * 10]); // NS path east side
    return out;
  }, []);

  return (
    <group position={[anchorX, y, anchorZ]}>
      {/* Two crossing paved paths — flat grey rectangles laid just above
          the terrain so they don't z-fight the grass. */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[NS_LEN, PATH_W]} />
        <meshStandardMaterial color={'#8a8276'} roughness={1} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[EW_LEN, PATH_W]} />
        <meshStandardMaterial color={'#8a8276'} roughness={1} />
      </mesh>
      {/* Path stripes — three lighter rectangles down the middle of each
          for that worn-cobbled look */}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={`ns-stripe-${i}`} position={[0, 0.05, -NS_LEN / 2 + 3 + i * 7]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.25, 2.5]} />
          <meshStandardMaterial color={'#a6a094'} roughness={1} />
        </mesh>
      ))}

      {/* Houses */}
      {houses.map((h, i) => (
        <group key={i} position={[h.x, 0, h.z]} rotation={[0, h.rotY, 0]}>
          {/* foundation */}
          <mesh position={[0, 0.15, 0]}>
            <boxGeometry args={[h.w + 0.4, 0.3, h.d + 0.4]} />
            <meshStandardMaterial color={'#5e5448'} roughness={1} />
          </mesh>
          {/* walls */}
          <mesh position={[0, h.h / 2 + 0.3, 0]}>
            <boxGeometry args={[h.w, h.h, h.d]} />
            <meshStandardMaterial color={h.palette.wall} roughness={0.9} />
          </mesh>
          {/* pitched roof (4-sided pyramid) */}
          <mesh position={[0, h.h + 0.3 + (h.w + h.d) * 0.18, 0]}>
            <coneGeometry args={[Math.max(h.w, h.d) * 0.78, (h.w + h.d) * 0.36, 4]} />
            <meshStandardMaterial color={h.palette.roof} roughness={0.95} flatShading />
          </mesh>
          {/* chimney */}
          <mesh position={[h.w * 0.25, h.h + 0.3 + (h.w + h.d) * 0.45, h.d * 0.2]}>
            <boxGeometry args={[0.5, 0.9, 0.5]} />
            <meshStandardMaterial color={'#6a5a4a'} roughness={1} />
          </mesh>
          {/* front shutters + glowing pane */}
          <mesh position={[-h.w * 0.28, h.h * 0.6 + 0.3, h.d / 2 + 0.02]}>
            <boxGeometry args={[0.8, 0.8, 0.05]} />
            <meshStandardMaterial color={h.palette.shutter} roughness={0.6} />
          </mesh>
          <mesh position={[ h.w * 0.28, h.h * 0.6 + 0.3, h.d / 2 + 0.02]}>
            <boxGeometry args={[0.8, 0.8, 0.05]} />
            <meshStandardMaterial color={h.palette.shutter} roughness={0.6} />
          </mesh>
          <mesh position={[-h.w * 0.28, h.h * 0.6 + 0.3, h.d / 2 + 0.04]}>
            <boxGeometry args={[0.5, 0.5, 0.05]} />
            <meshStandardMaterial color={'#f6d97a'} emissive={'#a07020'} emissiveIntensity={isNight ? 0.6 : 0.05} roughness={0.5} />
          </mesh>
          <mesh position={[ h.w * 0.28, h.h * 0.6 + 0.3, h.d / 2 + 0.04]}>
            <boxGeometry args={[0.5, 0.5, 0.05]} />
            <meshStandardMaterial color={'#f6d97a'} emissive={'#a07020'} emissiveIntensity={isNight ? 0.6 : 0.05} roughness={0.5} />
          </mesh>
          {/* door */}
          <mesh position={[0, 0.95, h.d / 2 + 0.02]}>
            <boxGeometry args={[0.9, 1.7, 0.05]} />
            <meshStandardMaterial color={h.palette.shutter} roughness={0.7} />
          </mesh>
          {/* doorstep */}
          <mesh position={[0, 0.1, h.d / 2 + 0.4]}>
            <boxGeometry args={[1.4, 0.18, 0.6]} />
            <meshStandardMaterial color={'#6a635a'} roughness={1} />
          </mesh>
        </group>
      ))}

      {/* Streetlamps — wooden post + a small glowing lantern at night */}
      {lamps.map(([lx, lz], i) => (
        <group key={`lamp-${i}`} position={[lx, 0, lz]}>
          <mesh position={[0, 1.3, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 2.6, 8]} />
            <meshStandardMaterial color={'#3a2818'} roughness={1} />
          </mesh>
          <mesh position={[0, 2.7, 0]}>
            <sphereGeometry args={[0.22, 10, 8]} />
            <meshStandardMaterial color={'#f6d97a'} emissive={'#c07020'} emissiveIntensity={isNight ? 0.9 : 0.05} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Small parked twoleg "monster" (car) at the crossroads */}
      <group position={[6, 0, 0]} rotation={[0, 0.3, 0]}>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[3.2, 1.0, 1.6]} />
          <meshStandardMaterial color={'#3a4a6a'} roughness={0.5} metalness={0.4} />
        </mesh>
        {/* roof / cabin */}
        <mesh position={[0.1, 1.25, 0]}>
          <boxGeometry args={[2.0, 0.7, 1.5]} />
          <meshStandardMaterial color={'#3a4a6a'} roughness={0.5} metalness={0.4} />
        </mesh>
        {/* wheels */}
        {[[1.0, 0.3, 0.7], [-1.0, 0.3, 0.7], [1.0, 0.3, -0.7], [-1.0, 0.3, -0.7]].map((p, j) => (
          <mesh key={j} position={p as [number, number, number]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.25, 14]} />
            <meshStandardMaterial color={'#1a1a1a'} roughness={1} />
          </mesh>
        ))}
        {/* windscreen — yellow at night */}
        <mesh position={[0.1, 1.25, 0.76]}>
          <boxGeometry args={[1.8, 0.5, 0.04]} />
          <meshStandardMaterial color={'#9ab8d8'} emissive={'#445a78'} emissiveIntensity={isNight ? 0.35 : 0.05} roughness={0.2} />
        </mesh>
      </group>

      {/* A small park with bushes — north-east corner */}
      <group position={[16, 0, -14]}>
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[6, 5]} />
          <meshStandardMaterial color={'#5a8a4a'} roughness={1} />
        </mesh>
        {[[1.5, 0.45, 0.5], [-1.5, 0.55, -0.6], [0.4, 0.5, 1.5], [-1.0, 0.4, 1.5]].map((p, j) => (
          <mesh key={j} position={p as [number, number, number]}>
            <sphereGeometry args={[p[1], 10, 8]} />
            <meshStandardMaterial color={'#3f6c34'} roughness={0.95} />
          </mesh>
        ))}
        {/* park bench */}
        <mesh position={[0, 0.4, -1.6]}>
          <boxGeometry args={[1.8, 0.1, 0.4]} />
          <meshStandardMaterial color={'#5a3a20'} roughness={1} />
        </mesh>
        <mesh position={[0, 0.75, -1.8]}>
          <boxGeometry args={[1.8, 0.6, 0.08]} />
          <meshStandardMaterial color={'#5a3a20'} roughness={1} />
        </mesh>
      </group>

      {/* Fence line bordering the south side of the village */}
      {Array.from({ length: 24 }).map((_, i) => (
        <mesh key={`f${i}`} position={[-24 + i * 2, 0.45, 16]}>
          <boxGeometry args={[0.08, 0.9, 0.08]} />
          <meshStandardMaterial color={'#7a5a3a'} roughness={1} />
        </mesh>
      ))}
      <mesh position={[-1, 0.75, 16]}>
        <boxGeometry args={[48, 0.06, 0.06]} />
        <meshStandardMaterial color={'#8a6a44'} roughness={1} />
      </mesh>
      <mesh position={[-1, 0.3, 16]}>
        <boxGeometry args={[48, 0.06, 0.06]} />
        <meshStandardMaterial color={'#8a6a44'} roughness={1} />
      </mesh>
    </group>
  );
}

// Horseplace barns — three small wooden barns east of RiverClan with a
// rough wooden fence ringing a paddock. Lore: Barley and Ravenpaw live
// near here. Set on the far east side, past the river.
function Barns() {
  const anchorX = 240, anchorZ = -180;
  const barns = useMemo(() => {
    const rand = seededRand(4242);
    const list: Array<{ x: number; z: number; w: number; d: number; h: number; rotY: number; wall: string; roof: string }> = [];
    const palettes = [
      { wall: '#8a4a2a', roof: '#3a1c10' },
      { wall: '#a86838', roof: '#4a2418' },
      { wall: '#6a3818', roof: '#2a1408' },
    ];
    for (let i = 0; i < 3; i++) {
      const p = palettes[i];
      list.push({
        x: (i - 1) * 14 + (rand() - 0.5) * 3,
        z: (rand() - 0.5) * 6,
        w: 4.5 + rand() * 1.0,
        d: 3.2 + rand() * 0.8,
        h: 2.6 + rand() * 0.5,
        rotY: (rand() - 0.5) * 0.25,
        wall: p.wall,
        roof: p.roof,
      });
    }
    return list;
  }, []);

  return (
    <group position={[anchorX, terrainHeightAt(anchorX, anchorZ), anchorZ]}>
      {barns.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.rotY, 0]}>
          {/* walls */}
          <mesh position={[0, b.h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.wall} roughness={1} flatShading />
          </mesh>
          {/* pitched roof — two slanted boxes */}
          <mesh position={[0, b.h + 0.4, -b.d * 0.25]} rotation={[-0.5, 0, 0]}>
            <boxGeometry args={[b.w + 0.4, 0.12, b.d * 0.6]} />
            <meshStandardMaterial color={b.roof} roughness={1} flatShading />
          </mesh>
          <mesh position={[0, b.h + 0.4, b.d * 0.25]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[b.w + 0.4, 0.12, b.d * 0.6]} />
            <meshStandardMaterial color={b.roof} roughness={1} flatShading />
          </mesh>
          {/* big barn door */}
          <mesh position={[0, b.h * 0.45, b.d / 2 + 0.01]}>
            <boxGeometry args={[b.w * 0.45, b.h * 0.8, 0.05]} />
            <meshStandardMaterial color={'#3a2418'} roughness={1} />
          </mesh>
          {/* X-brace plank on door */}
          <mesh position={[0, b.h * 0.45, b.d / 2 + 0.04]} rotation={[0, 0, 0.6]}>
            <boxGeometry args={[b.w * 0.55, 0.08, 0.02]} />
            <meshStandardMaterial color={'#5a3a20'} roughness={1} />
          </mesh>
          <mesh position={[0, b.h * 0.45, b.d / 2 + 0.04]} rotation={[0, 0, -0.6]}>
            <boxGeometry args={[b.w * 0.55, 0.08, 0.02]} />
            <meshStandardMaterial color={'#5a3a20'} roughness={1} />
          </mesh>
          {/* haystack beside the barn */}
          <mesh position={[b.w * 0.65, 0.5, b.d * 0.4]}>
            <cylinderGeometry args={[0.7, 0.85, 1.0, 12]} />
            <meshStandardMaterial color={'#d8b85a'} roughness={1} flatShading />
          </mesh>
        </group>
      ))}
      {/* Paddock fence ring */}
      {Array.from({ length: 28 }).map((_, i) => {
        const a = (i / 28) * Math.PI * 2;
        const r = 26;
        return (
          <mesh key={`p${i}`} position={[Math.cos(a) * r, 0.45, Math.sin(a) * r]} rotation={[0, a, 0]}>
            <boxGeometry args={[0.08, 0.9, 0.08]} />
            <meshStandardMaterial color={'#7a5a3a'} roughness={1} />
          </mesh>
        );
      })}
      {/* a couple of horse-feeding troughs */}
      <mesh position={[6, 0.2, -10]}>
        <boxGeometry args={[2, 0.4, 0.6]} />
        <meshStandardMaterial color={'#5a3a20'} roughness={1} />
      </mesh>
      <mesh position={[-8, 0.2, 8]}>
        <boxGeometry args={[2, 0.4, 0.6]} />
        <meshStandardMaterial color={'#5a3a20'} roughness={1} />
      </mesh>
    </group>
  );
}

// Moonstone — sacred cave in the Highstones beyond WindClan. A stone
// mound with a dark entrance and a glowing crystal pillar shimmering
// inside. Brighter and more visible at night.
function Moonstone({ isNight }: { isNight: boolean }) {
  const ax = -280, az = -260;
  const y = terrainHeightAt(ax, az);
  return (
    <group position={[ax, y, az]}>
      {/* outer rocky mound — irregular stack of boulders */}
      {[
        { p: [0, 1.6, 0] as [number, number, number], s: [10, 3.2, 8] as [number, number, number], c: '#6a6258' },
        { p: [-3.5, 1.2, 2] as [number, number, number], s: [5, 2.4, 4] as [number, number, number], c: '#7a7268' },
        { p: [3.2, 1.0, -1.5] as [number, number, number], s: [4.5, 2.0, 3.8] as [number, number, number], c: '#5a5248' },
        { p: [0.5, 3.2, -2] as [number, number, number], s: [4, 1.8, 3] as [number, number, number], c: '#8a8278' },
        { p: [-1.5, 4.4, -0.5] as [number, number, number], s: [2.6, 1.4, 2.2] as [number, number, number], c: '#6a6258' },
      ].map((b, i) => (
        <mesh key={i} position={b.p} rotation={[0, i * 0.7, i * 0.15]} castShadow receiveShadow>
          <boxGeometry args={b.s} />
          <meshStandardMaterial color={b.c} roughness={1} flatShading />
        </mesh>
      ))}
      {/* Mothermouth — dark cave entrance arch */}
      <mesh position={[0, 1.3, 4]}>
        <boxGeometry args={[2.4, 2.4, 0.4]} />
        <meshStandardMaterial color={'#08060a'} roughness={1} />
      </mesh>
      {/* Glowing crystal pillar visible just inside the cave mouth */}
      <mesh position={[0, 1.4, 4.45]}>
        <coneGeometry args={[0.5, 2.6, 6]} />
        <meshStandardMaterial
          color={isNight ? '#cfe4ff' : '#a0c4ff'}
          emissive={'#7aa8ff'}
          emissiveIntensity={isNight ? 1.4 : 0.4}
          roughness={0.2}
          metalness={0.15}
          flatShading
        />
      </mesh>
      {/* Soft point light at night so it lifts off the cliff */}
      {isNight && (
        <pointLight position={[0, 2.5, 5]} intensity={1.2} distance={18} color={'#8ab4ff'} />
      )}
      {/* Smaller crystal shards on the ground */}
      <mesh position={[2, 0.4, 5]} rotation={[0, 0.6, 0.3]}>
        <coneGeometry args={[0.25, 0.8, 5]} />
        <meshStandardMaterial color={'#a0c4ff'} emissive={'#5a82c0'} emissiveIntensity={isNight ? 0.6 : 0.15} roughness={0.3} />
      </mesh>
      <mesh position={[-1.8, 0.35, 5.3]} rotation={[0, -0.4, -0.2]}>
        <coneGeometry args={[0.22, 0.7, 5]} />
        <meshStandardMaterial color={'#a0c4ff'} emissive={'#5a82c0'} emissiveIntensity={isNight ? 0.6 : 0.15} roughness={0.3} />
      </mesh>
    </group>
  );
}

// Snakerocks — a jagged pile of fallen stones in ThunderClan territory
// where adders sun themselves. A scattered cluster of tilted, sharp slabs.
function Snakerocks() {
  const ax = 60, az = 70;
  const slabs = useMemo(() => {
    const rand = seededRand(3131);
    const arr: Array<{ p: [number, number, number]; s: [number, number, number]; rot: [number, number, number]; c: string }> = [];
    const palette = ['#7d7872', '#8a8278', '#6a6058', '#a09682', '#5e5448', '#8e8478'];
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * 6;
      const sx = 0.8 + rand() * 2.2;
      const sy = 1.0 + rand() * 2.4;
      const sz = 0.8 + rand() * 2.2;
      arr.push({
        p: [Math.cos(a) * r, sy * 0.45, Math.sin(a) * r],
        s: [sx, sy, sz],
        rot: [(rand() - 0.5) * 0.6, rand() * Math.PI * 2, (rand() - 0.5) * 0.5],
        c: palette[Math.floor(rand() * palette.length)],
      });
    }
    return arr;
  }, []);
  // A few resting snakes — small dark coiled cylinders.
  const snakes = useMemo(() => {
    const rand = seededRand(8181);
    const arr: Array<{ p: [number, number, number]; rotY: number; c: string }> = [];
    const cols = ['#3a2818', '#5a3818', '#2a2010'];
    for (let i = 0; i < 3; i++) {
      const a = rand() * Math.PI * 2;
      const r = 1.5 + rand() * 4;
      arr.push({ p: [Math.cos(a) * r, 0.18, Math.sin(a) * r], rotY: rand() * Math.PI * 2, c: cols[i % cols.length] });
    }
    return arr;
  }, []);

  return (
    <group position={[ax, terrainHeightAt(ax, az), az]}>
      {slabs.map((s, i) => (
        <mesh key={i} position={s.p} rotation={s.rot} castShadow receiveShadow>
          <boxGeometry args={s.s} />
          <meshStandardMaterial color={s.c} roughness={1} flatShading />
        </mesh>
      ))}
      {snakes.map((s, i) => (
        <mesh key={`sn${i}`} position={s.p} rotation={[Math.PI / 2, 0, s.rotY]}>
          <torusGeometry args={[0.35, 0.09, 6, 12]} />
          <meshStandardMaterial color={s.c} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// Thunderpath — the long gray monster-road that splits ThunderClan from
// ShadowClan. East–west segments stitched together so the path follows
// the rolling terrain rather than floating above it. White dashed lane
// markings down the middle.
// Build a continuous road strip along an arbitrary parametric path in XZ.
// Each "slice" is two vertices on either side of the centre, with Y
// sampled from terrainHeightAt so the road follows the hills smoothly
// without the stair-step cracks the old per-tile approach produced.
function buildRoadGeometry(
  path: (t: number) => [number, number],
  steps: number,
  halfWidth: number,
  yOffset: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const [cx, cz] = path(t);
    const dt = 1e-3;
    const [px, pz] = path(Math.max(0, t - dt));
    const [nx, nz] = path(Math.min(1, t + dt));
    const tx = nx - px;
    const tz = nz - pz;
    const tlen = Math.hypot(tx, tz) || 1;
    // Perpendicular vector in XZ.
    const perpX = -tz / tlen;
    const perpZ =  tx / tlen;
    const lx = cx + perpX * halfWidth;
    const lz = cz + perpZ * halfWidth;
    const rx = cx - perpX * halfWidth;
    const rz = cz - perpZ * halfWidth;
    const ly = terrainHeightAt(lx, lz) + yOffset;
    const ry = terrainHeightAt(rx, rz) + yOffset;
    positions.push(lx, ly, lz, rx, ry, rz);
    uvs.push(0, t, 1, t);
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function Thunderpath() {
  const path = (t: number): [number, number] => {
    const x = THUNDERPATH.xMin + (THUNDERPATH.xMax - THUNDERPATH.xMin) * t;
    const z = THUNDERPATH.z0 + Math.sin(x * THUNDERPATH.waveFreq) * THUNDERPATH.waveAmp;
    return [x, z];
  };
  const roadGeo   = useMemo(() => buildRoadGeometry(path, 80, THUNDERPATH.halfWidth,        0.08), []);
  const gravelGeo = useMemo(() => buildRoadGeometry(path, 80, THUNDERPATH.halfWidth + 0.9,  0.04), []);
  useEffect(() => () => { roadGeo.dispose(); gravelGeo.dispose(); }, [roadGeo, gravelGeo]);
  return (
    <group>
      <mesh geometry={gravelGeo} receiveShadow>
        <meshStandardMaterial color={'#8a7a5a'} roughness={1} />
      </mesh>
      <mesh geometry={roadGeo} receiveShadow>
        <meshStandardMaterial color={'#2a2826'} roughness={0.85} />
      </mesh>
      <Monsters />
    </group>
  );
}

// Twoleg vehicles ("monsters") prowling the main Thunderpath. Two of
// them, opposite directions, deterministic positions (see vehicles.ts).
// They render as boxy cars with headlights and an unpleasant honk on
// approach (handled by the player-side proximity check in Game.tsx).
function Monsters() {
  const refs = useRef<Array<THREE.Group | null>>([]);
  // Per-monster headlight refs so we can toggle them off in daytime if
  // we ever want to (not toggled today; the cones look fine 24/7).
  useFrame(() => {
    const now = Date.now();
    for (let i = 0; i < NUM_MONSTERS; i++) {
      const m = monsterAt(i, now);
      const g = refs.current[i];
      if (!g) continue;
      g.position.set(m.x, m.y, m.z);
      g.rotation.y = m.yaw;
    }
  });
  return (
    <group>
      {Array.from({ length: NUM_MONSTERS }).map((_, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          {/* lower chassis */}
          <mesh position={[0, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.7, 0.6, 3.6]} />
            <meshStandardMaterial color={i === 0 ? '#a82828' : '#283e7a'} roughness={0.7} metalness={0.2} />
          </mesh>
          {/* upper cab */}
          <mesh position={[0, 0.55, -0.2]} castShadow>
            <boxGeometry args={[1.5, 0.65, 1.9]} />
            <meshStandardMaterial color={i === 0 ? '#7a1818' : '#1a2c5a'} roughness={0.7} metalness={0.2} />
          </mesh>
          {/* windshield (dark) */}
          <mesh position={[0, 0.58, 0.65]} rotation={[-0.35, 0, 0]}>
            <boxGeometry args={[1.42, 0.5, 0.05]} />
            <meshStandardMaterial color={'#08101c'} roughness={0.3} metalness={0.6} />
          </mesh>
          {/* wheels (4) */}
          {[
            [-0.85, -0.22, 1.2], [0.85, -0.22, 1.2],
            [-0.85, -0.22, -1.2], [0.85, -0.22, -1.2],
          ].map((p, j) => (
            <mesh key={j} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.32, 0.32, 0.3, 12]} />
              <meshStandardMaterial color={'#1a1816'} roughness={0.95} />
            </mesh>
          ))}
          {/* headlights — small bright cones in front */}
          <mesh position={[-0.55, 0.05, 1.85]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color={'#fff6c0'} emissive={'#fff0a0'} emissiveIntensity={1.6} />
          </mesh>
          <mesh position={[0.55, 0.05, 1.85]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color={'#fff6c0'} emissive={'#fff0a0'} emissiveIntensity={1.6} />
          </mesh>
          {/* taillights */}
          <mesh position={[-0.55, 0.05, -1.85]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color={'#a20000'} emissive={'#c00000'} emissiveIntensity={1.0} />
          </mesh>
          <mesh position={[0.55, 0.05, -1.85]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color={'#a20000'} emissive={'#c00000'} emissiveIntensity={1.0} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Lake water surface + Great Oak on the central island. The basin and
// island shapes are baked into terrainHeightAt — this component just
// adds the shimmering water plane and the gathering oak.
function LakeAndIsland({ isNight }: { isNight: boolean }) {
  return (
    <group>
      {/* Water surface — sits just above the floor so the bank reads as beach */}
      <mesh position={[LAKE.x, -0.15, LAKE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[LAKE.r - 2, 64]} />
        <meshStandardMaterial
          color={isNight ? '#1c2c4a' : '#3a78a8'}
          roughness={0.25}
          metalness={0.05}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* Faint outer shimmer ring at night */}
      {isNight && (
        <mesh position={[LAKE.x, -0.1, LAKE.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[LAKE.r - 4, LAKE.r - 2, 64]} />
          <meshBasicMaterial color={'#8aaadf'} transparent opacity={0.18} />
        </mesh>
      )}
      {/* Great Oak on the island — taller / wider than forest trees */}
      <group position={[LAKE.x, terrainHeightAt(LAKE.x, LAKE.z), LAKE.z]}>
        <mesh position={[0, 5, 0]} castShadow>
          <cylinderGeometry args={[0.9, 1.3, 10, 8]} />
          <meshStandardMaterial color={'#4a3220'} roughness={1} flatShading />
        </mesh>
        {/* big rounded crown — three stacked clusters */}
        <mesh position={[0, 10.5, 0]} castShadow>
          <icosahedronGeometry args={[5.2, 0]} />
          <meshStandardMaterial color={'#3f6e3f'} roughness={1} flatShading />
        </mesh>
        <mesh position={[1.6, 11.8, -0.6]} castShadow>
          <icosahedronGeometry args={[3.2, 0]} />
          <meshStandardMaterial color={'#5a8a4a'} roughness={1} flatShading />
        </mesh>
        <mesh position={[-1.8, 12.4, 0.8]} castShadow>
          <icosahedronGeometry args={[3.6, 0]} />
          <meshStandardMaterial color={'#4c7c44'} roughness={1} flatShading />
        </mesh>
        {/* a couple of roots */}
        <mesh position={[1.4, 0.3, 0.6]} rotation={[0, 0.7, 0.3]}>
          <boxGeometry args={[1.8, 0.5, 0.5]} />
          <meshStandardMaterial color={'#4a3220'} roughness={1} flatShading />
        </mesh>
        <mesh position={[-1.6, 0.3, -0.4]} rotation={[0, -0.4, -0.25]}>
          <boxGeometry args={[1.6, 0.45, 0.45]} />
          <meshStandardMaterial color={'#4a3220'} roughness={1} flatShading />
        </mesh>
      </group>
    </group>
  );
}

// A pier of wooden planks running out into the lake from the south bank.
// Two variants: an intact halfbridge and a broken one with gaps.
function Halfbridge({ side, broken }: { side: 'south' | 'east'; broken: boolean }) {
  const startX = side === 'south' ? LAKE.x : LAKE.x + (LAKE.r - 2);
  const startZ = side === 'south' ? LAKE.z - (LAKE.r - 2) : LAKE.z;
  const dirX = side === 'south' ? 0 : -1;
  const dirZ = side === 'south' ? 1 : 0;
  const planks = 10;
  const plankLen = 1.6;
  return (
    <group>
      {Array.from({ length: planks }).map((_, i) => {
        // For a broken bridge, skip the last few planks and tilt some
        const isMissing = broken && (i === planks - 1 || i === planks - 2 || i === 4);
        const tilt = broken && (i === planks - 3 || i === 3) ? (Math.PI / 8) : 0;
        if (isMissing) return null;
        const cx = startX + dirX * (i * plankLen + plankLen / 2);
        const cz = startZ + dirZ * (i * plankLen + plankLen / 2);
        const y = -0.05; // just above the water
        return (
          <group key={i} position={[cx, y, cz]} rotation={[tilt, side === 'east' ? Math.PI / 2 : 0, 0]}>
            <mesh receiveShadow>
              <boxGeometry args={[1.6, 0.12, plankLen + 0.05]} />
              <meshStandardMaterial color={broken ? '#5a3818' : '#7a5a3a'} roughness={1} flatShading />
            </mesh>
          </group>
        );
      })}
      {/* support posts every couple of planks — short, sitting on the
          shallow lake floor and just kissing the underside of the planks */}
      {Array.from({ length: Math.floor(planks / 2) }).map((_, i) => {
        const cx = startX + dirX * ((i * 2) * plankLen + plankLen / 2);
        const cz = startZ + dirZ * ((i * 2) * plankLen + plankLen / 2);
        return (
          <group key={`p${i}`} position={[cx, -0.12, cz]}>
            <mesh position={[0.7, 0, 0]}>
              <boxGeometry args={[0.12, 0.4, 0.12]} />
              <meshStandardMaterial color={'#4a3018'} roughness={1} />
            </mesh>
            <mesh position={[-0.7, 0, 0]}>
              <boxGeometry args={[0.12, 0.4, 0.12]} />
              <meshStandardMaterial color={'#4a3018'} roughness={1} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// A single very large oak — the "Ancient Oak" landmark. Different style
// than the procedural pines so it reads as a special tree.
function AncientOak() {
  const ax = -10, az = -80;
  const y = terrainHeightAt(ax, az);
  return (
    <group position={[ax, y, az]}>
      <mesh position={[0, 4.5, 0]} castShadow>
        <cylinderGeometry args={[1.0, 1.5, 9, 8]} />
        <meshStandardMaterial color={'#3e2a16'} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 9.5, 0]} castShadow>
        <icosahedronGeometry args={[4.8, 0]} />
        <meshStandardMaterial color={'#3a6a3a'} roughness={1} flatShading />
      </mesh>
      <mesh position={[2.0, 10.4, -0.8]} castShadow>
        <icosahedronGeometry args={[3.0, 0]} />
        <meshStandardMaterial color={'#578a52'} roughness={1} flatShading />
      </mesh>
      <mesh position={[-2.2, 11.2, 1.0]} castShadow>
        <icosahedronGeometry args={[3.4, 0]} />
        <meshStandardMaterial color={'#467a48'} roughness={1} flatShading />
      </mesh>
      {/* exposed gnarled roots */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.3, 0.25, Math.sin(a) * 1.3]} rotation={[0, a, 0.3]}>
            <boxGeometry args={[1.8, 0.4, 0.4]} />
            <meshStandardMaterial color={'#3e2a16'} roughness={1} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

// Greenleaf Twolegplace — a small cluster of seasonal log cabins near
// the lake shore. Smaller and rougher than the main twoleg village.
function GreenleafCabins({ isNight }: { isNight: boolean }) {
  const ax = 60, az = 145;
  const cabins = useMemo(() => {
    const rand = seededRand(5151);
    const arr: Array<{ x: number; z: number; w: number; d: number; h: number; rotY: number; wall: string; roof: string }> = [];
    for (let i = 0; i < 3; i++) {
      arr.push({
        x: (i - 1) * 8 + (rand() - 0.5) * 2,
        z: (rand() - 0.5) * 4,
        w: 3.2 + rand() * 0.8,
        d: 2.6 + rand() * 0.6,
        h: 2.2 + rand() * 0.4,
        rotY: (rand() - 0.5) * 0.5,
        wall: ['#9a7a48', '#7a5e3a', '#a88a58'][i],
        roof: ['#3a2818', '#4a3018', '#2a1c10'][i],
      });
    }
    return arr;
  }, []);
  return (
    <group position={[ax, terrainHeightAt(ax, az), az]}>
      {cabins.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.rotY, 0]}>
          <mesh position={[0, b.h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.wall} roughness={1} flatShading />
          </mesh>
          {/* pitched roof */}
          <mesh position={[0, b.h + 0.3, -b.d * 0.2]} rotation={[-0.6, 0, 0]}>
            <boxGeometry args={[b.w + 0.4, 0.1, b.d * 0.7]} />
            <meshStandardMaterial color={b.roof} roughness={1} flatShading />
          </mesh>
          <mesh position={[0, b.h + 0.3, b.d * 0.2]} rotation={[0.6, 0, 0]}>
            <boxGeometry args={[b.w + 0.4, 0.1, b.d * 0.7]} />
            <meshStandardMaterial color={b.roof} roughness={1} flatShading />
          </mesh>
          {/* tiny door */}
          <mesh position={[0, b.h * 0.35, b.d / 2 + 0.02]}>
            <boxGeometry args={[0.6, b.h * 0.6, 0.04]} />
            <meshStandardMaterial color={'#2a1810'} roughness={1} />
          </mesh>
          {/* lit window at night */}
          <mesh position={[b.w * 0.3, b.h * 0.55, b.d / 2 + 0.02]}>
            <boxGeometry args={[0.4, 0.4, 0.04]} />
            <meshStandardMaterial
              color={'#ffe79a'}
              emissive={isNight ? '#ffd66a' : '#222'}
              emissiveIntensity={isNight ? 1.0 : 0}
            />
          </mesh>
        </group>
      ))}
      {/* a campfire ring between the cabins */}
      <mesh position={[0, 0.05, 8]}>
        <cylinderGeometry args={[0.9, 0.9, 0.1, 8]} />
        <meshStandardMaterial color={'#5a4030'} roughness={1} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.8, 0.18, 8 + Math.sin(a) * 0.8]}>
            <boxGeometry args={[0.18, 0.36, 0.18]} />
            <meshStandardMaterial color={'#7a7a78'} roughness={1} />
          </mesh>
        );
      })}
      {isNight && (
        <pointLight position={[0, 1.2, 8]} intensity={1.2} distance={14} color={'#ffb060'} />
      )}
    </group>
  );
}

// Abandoned Twoleg Nest — a half-ruined building. Broken walls,
// exposed roof beams, weeds.
function AbandonedTwolegNest() {
  const ax = 130, az = 110;
  return (
    <group position={[ax, terrainHeightAt(ax, az), az]}>
      {/* main standing wall */}
      <mesh position={[-2, 1.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 3.6, 5]} />
        <meshStandardMaterial color={'#8a7a68'} roughness={1} flatShading />
      </mesh>
      {/* short back wall (broken) */}
      <mesh position={[2, 1.0, -1.5]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 2.0, 2]} />
        <meshStandardMaterial color={'#7a6a58'} roughness={1} flatShading />
      </mesh>
      {/* side wall stub */}
      <mesh position={[0, 0.8, 2.3]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 1.6, 4]} />
        <meshStandardMaterial color={'#7a6a58'} roughness={1} flatShading />
      </mesh>
      {/* exposed roof beams */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-2 + i * 1.3, 3.4, 0]} rotation={[0, 0, -0.4]}>
          <boxGeometry args={[3.5, 0.12, 0.12]} />
          <meshStandardMaterial color={'#3a2818'} roughness={1} />
        </mesh>
      ))}
      {/* rubble scattered on the floor */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = i * 1.3;
        return (
          <mesh key={`r${i}`} position={[Math.cos(a) * 2.4, 0.15, Math.sin(a) * 2.4]} rotation={[0, a, 0.2]}>
            <boxGeometry args={[0.5, 0.3, 0.5]} />
            <meshStandardMaterial color={'#7a7268'} roughness={1} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

// SkyClan Camp — a small clearing ringed by a rocky outcrop (in lore SkyClan
// lived in a gorge). We approximate with a low rocky horseshoe + a flat
// gathering rock in the middle.
function SkyClanCamp() {
  const ax = 220, az = 60;
  return (
    <group position={[ax, terrainHeightAt(ax, az), az]}>
      {/* rocky ring */}
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 1.6 + Math.PI * 0.2; // horseshoe, open south
        const r = 8 + Math.sin(i * 1.7) * 0.6;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * r, 0.9 + Math.cos(i) * 0.2, Math.sin(a) * r]}
            rotation={[(Math.sin(i) * 0.3), a, 0.1 * Math.cos(i)]}
            castShadow
          >
            <boxGeometry args={[1.6 + Math.sin(i * 0.7) * 0.4, 1.8, 1.4]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#8a8278' : '#6a6058'} roughness={1} flatShading />
          </mesh>
        );
      })}
      {/* central gathering ledge */}
      <mesh position={[0, 0.7, -2]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 1.4, 2.2]} />
        <meshStandardMaterial color={'#9a9286'} roughness={1} flatShading />
      </mesh>
      {/* a couple of brackeny tufts */}
      <mesh position={[3, 0.3, 3]}>
        <coneGeometry args={[0.8, 0.8, 6]} />
        <meshStandardMaterial color={'#3a5a2a'} roughness={1} flatShading />
      </mesh>
      <mesh position={[-2.5, 0.3, 2.4]}>
        <coneGeometry args={[0.7, 0.7, 6]} />
        <meshStandardMaterial color={'#3a5a2a'} roughness={1} flatShading />
      </mesh>
    </group>
  );
}

// Small Thunderpath — a narrower secondary road, north-south.
function SmallThunderpath() {
  const xCenter = -130, zMin = -180, zMax = -30;
  const path = (t: number): [number, number] => {
    const z = zMin + (zMax - zMin) * t;
    const x = xCenter + Math.sin(z * 0.02) * 4;
    return [x, z];
  };
  const roadGeo = useMemo(() => buildRoadGeometry(path, 50, 1.6, 0.07), []);
  const dashes = useMemo(() => {
    const arr: Array<{ x: number; z: number; y: number; angle: number }> = [];
    for (let i = 0; i < 18; i++) {
      const t = (i + 0.5) / 18;
      const [cx, cz] = path(t);
      const dt = 1e-3;
      const [px, pz] = path(Math.max(0, t - dt));
      const [nx, nz] = path(Math.min(1, t + dt));
      arr.push({ x: cx, z: cz, y: terrainHeightAt(cx, cz) + 0.09, angle: Math.atan2(nx - px, nz - pz) });
    }
    return arr;
  }, []);
  useEffect(() => () => { roadGeo.dispose(); }, [roadGeo]);
  return (
    <group>
      <mesh geometry={roadGeo} receiveShadow>
        <meshStandardMaterial color={'#2c2a28'} roughness={0.9} />
      </mesh>
      {dashes.map((d, i) => (
        <mesh key={i} position={[d.x, d.y, d.z]} rotation={[-Math.PI / 2, d.angle, 0]}>
          <planeGeometry args={[0.18, 2]} />
          <meshStandardMaterial color={'#c8c2a8'} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// Old Thunderpath — a short, cracked, partially-overgrown disused road
// with gaps where the asphalt has crumbled. Built as several short
// continuous strips so the gaps remain but each strip itself follows
// the hill smoothly.
function OldThunderpath() {
  const zCenter = -80;
  const xMin = 100, xMax = 240;
  // Define segment ranges (x ranges) with gaps between
  const segments: Array<{ a: number; b: number }> = [
    { a: 100, b: 132 },
    { a: 138, b: 168 },
    { a: 174, b: 196 },
    { a: 204, b: 240 },
  ];
  const strips = useMemo(() => segments.map((seg) => {
    const path = (t: number): [number, number] => [seg.a + (seg.b - seg.a) * t, zCenter];
    return { geo: buildRoadGeometry(path, 12, 2.25, 0.06), seg };
  }), []);
  // Weeds growing in the cracks — scattered tufts along the road centre.
  const weeds = useMemo(() => {
    const arr: Array<{ x: number; z: number; y: number }> = [];
    for (const seg of segments) {
      for (let k = 0; k < 4; k++) {
        const x = seg.a + ((k + 0.5) / 4) * (seg.b - seg.a) + (k % 2 === 0 ? -0.6 : 0.7);
        const z = zCenter + (k % 2 === 0 ? 0.6 : -0.8);
        arr.push({ x, z, y: terrainHeightAt(x, z) + 0.1 });
      }
    }
    return arr;
  }, []);
  // Rubble at the broken ends.
  const rubble = useMemo(() => {
    const arr: Array<{ x: number; z: number; y: number; rot: number }> = [];
    segments.forEach((s, i) => {
      if (i < segments.length - 1) {
        const x = s.b + 1;
        arr.push({ x, z: zCenter + 1.2, y: terrainHeightAt(x, zCenter) + 0.15, rot: 0.4 });
      }
      if (i > 0) {
        const x = s.a - 1;
        arr.push({ x, z: zCenter - 1.2, y: terrainHeightAt(x, zCenter) + 0.15, rot: -0.5 });
      }
    });
    return arr;
  }, []);
  useEffect(() => () => { strips.forEach((s) => s.geo.dispose()); }, [strips]);
  return (
    <group>
      {strips.map((s, i) => (
        <mesh key={i} geometry={s.geo} receiveShadow>
          <meshStandardMaterial color={i % 2 === 0 ? '#3a3834' : '#4a4642'} roughness={1} />
        </mesh>
      ))}
      {weeds.map((w, i) => (
        <mesh key={`w${i}`} position={[w.x, w.y, w.z]}>
          <coneGeometry args={[0.22, 0.4, 5]} />
          <meshStandardMaterial color={'#3a6a3a'} roughness={1} flatShading />
        </mesh>
      ))}
      {rubble.map((r, i) => (
        <mesh key={`r${i}`} position={[r.x, r.y, r.z]} rotation={[0, r.rot, 0.2]}>
          <boxGeometry args={[0.7, 0.3, 0.5]} />
          <meshStandardMaterial color={'#5a5650'} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

// Climbable oaks — a chunky standalone trunk at every spot listed in
// CLIMBABLE_TREES. Tall enough that perching at +3.6 looks like sitting
// on a real branch.
// Med-cat herb gardens — small fenced plots planted by the player.
// Renders seedling tufts for the first 60 seconds after planting, then
// ripe little cabbages and carrots once mature.
function HerbGardens() {
  const gardens = useGameStore((s) => s.herbGardens);
  // Re-render every 5s so the "ripe" check (Date.now() >= plantedAt+60s)
  // flips on at the right moment without forcing a fast re-render loop.
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  return (
    <group>
      {gardens.map((g) => {
        const y = terrainHeightAt(g.x, g.z);
        const age = Date.now() - g.plantedAt;
        const ripe = age >= 60_000;
        // Four fence posts
        const fence = [-1.2, 1.2].flatMap((dx) => [-1.2, 1.2].map((dz) => [dx, dz] as [number, number]));
        // Row of 6 seedlings / veggies in a 3x2 grid
        const rows = [-0.6, 0, 0.6];
        const cols = [-0.4, 0.4];
        return (
          <group key={g.id} position={[g.x, y, g.z]}>
            {/* dirt patch */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[2.6, 1.8]} />
              <meshStandardMaterial color={'#5a4028'} roughness={1} />
            </mesh>
            {/* fence */}
            {fence.map(([dx, dz], i) => (
              <mesh key={`f${i}`} position={[dx, 0.3, dz]}>
                <boxGeometry args={[0.08, 0.6, 0.08]} />
                <meshStandardMaterial color={'#7a5a3a'} roughness={1} />
              </mesh>
            ))}
            {/* fence rails */}
            <mesh position={[0, 0.55, -1.2]}>
              <boxGeometry args={[2.4, 0.06, 0.06]} />
              <meshStandardMaterial color={'#7a5a3a'} roughness={1} />
            </mesh>
            <mesh position={[0, 0.55, 1.2]}>
              <boxGeometry args={[2.4, 0.06, 0.06]} />
              <meshStandardMaterial color={'#7a5a3a'} roughness={1} />
            </mesh>
            {/* plants */}
            {rows.map((cx, i) => cols.map((cz, j) => {
              const k = i * 2 + j;
              if (!ripe) {
                // seedling — tiny green sprig
                return (
                  <mesh key={`s${k}`} position={[cx, 0.18, cz]}>
                    <coneGeometry args={[0.12, 0.3, 5]} />
                    <meshStandardMaterial color={'#4a7a3a'} roughness={1} flatShading />
                  </mesh>
                );
              }
              // ripe — alternate cabbage (round green) and carrot (orange)
              const isCarrot = k % 2 === 0;
              return (
                <group key={`r${k}`} position={[cx, 0.22, cz]}>
                  {isCarrot ? (
                    <>
                      {/* carrot tip poking up */}
                      <mesh position={[0, 0.12, 0]}>
                        <coneGeometry args={[0.16, 0.32, 6]} />
                        <meshStandardMaterial color={'#e07a30'} roughness={0.9} />
                      </mesh>
                      {/* leafy top */}
                      <mesh position={[0, 0.32, 0]}>
                        <coneGeometry args={[0.18, 0.24, 5]} />
                        <meshStandardMaterial color={'#3a8a3a'} roughness={1} flatShading />
                      </mesh>
                    </>
                  ) : (
                    <>
                      {/* cabbage head */}
                      <mesh position={[0, 0.16, 0]}>
                        <icosahedronGeometry args={[0.24, 0]} />
                        <meshStandardMaterial color={'#7ab048'} roughness={1} flatShading />
                      </mesh>
                    </>
                  )}
                </group>
              );
            }))}
          </group>
        );
      })}
    </group>
  );
}

function ClimbableOaks() {
  return (
    <group>
      {CLIMBABLE_TREES.map((t, i) => {
        const y = terrainHeightAt(t.x, t.z);
        return (
          <group key={i} position={[t.x, y, t.z]}>
            {/* trunk */}
            <mesh position={[0, 2.4, 0]} castShadow>
              <cylinderGeometry args={[0.45, 0.65, 4.8, 8]} />
              <meshStandardMaterial color={'#4a3220'} roughness={1} flatShading />
            </mesh>
            {/* low branch the cat sits on */}
            <mesh position={[0.5, 3.4, 0]} rotation={[0, 0, -0.4]} castShadow>
              <cylinderGeometry args={[0.12, 0.16, 1.6, 6]} />
              <meshStandardMaterial color={'#4a3220'} roughness={1} flatShading />
            </mesh>
            {/* small crown */}
            <mesh position={[0, 5.6, 0]} castShadow>
              <icosahedronGeometry args={[2.2, 0]} />
              <meshStandardMaterial color={'#3a6a3a'} roughness={1} flatShading />
            </mesh>
            <mesh position={[1.0, 6.4, -0.4]} castShadow>
              <icosahedronGeometry args={[1.4, 0]} />
              <meshStandardMaterial color={'#4a7a4a'} roughness={1} flatShading />
            </mesh>
            {/* glowing claw-mark on the trunk — visual cue this oak is
                climbable, so the player can tell it apart from the
                procedural pine forest */}
            <mesh position={[0.5, 1.4, 0.55]}>
              <sphereGeometry args={[0.18, 8, 8]} />
              <meshStandardMaterial
                color={'#ffd066'}
                emissive={'#ffb84a'}
                emissiveIntensity={1.6}
              />
            </mesh>
          </group>
        );
      })}
    </group>
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

      <TwolegPlace isNight={isNight} />
      <Barns />
      <Moonstone isNight={isNight} />
      <Snakerocks />
      <Thunderpath />
      <LakeAndIsland isNight={isNight} />
      <Halfbridge side="south" broken={false} />
      <Halfbridge side="east" broken={true} />
      <AncientOak />
      <GreenleafCabins isNight={isNight} />
      <AbandonedTwolegNest />
      <SkyClanCamp />
      <SmallThunderpath />
      <OldThunderpath />
      <ClimbableOaks />
      <HerbGardens />

      {/* moonpool — uneven stone ring surrounding a glowing silver pool */}
      <group position={[-220, terrainHeightAt(-220, -220), -220]}>
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i / 10) * Math.PI * 2;
          // Slight per-stone variation so the ring isn't perfectly round.
          const r = 3 + Math.sin(i * 1.7) * 0.25;
          const h = 0.6 + Math.cos(i * 2.3) * 0.25;
          const w = 0.7 + Math.sin(i * 0.9) * 0.2;
          const tilt = Math.sin(i * 3.1) * 0.18;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * r, h * 0.5, Math.sin(a) * r]}
              rotation={[tilt, a + Math.PI / 2, tilt * 0.5]}
            >
              <boxGeometry args={[w, h, 0.6]} />
              <meshStandardMaterial color={'#7a7a82'} roughness={1} flatShading />
            </mesh>
          );
        })}
        {/* Pool surface — brighter and slightly transparent at night */}
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.6, 32]} />
          <meshStandardMaterial color={isNight ? '#8aaef0' : '#5a8ad8'} emissive={isNight ? '#3a5a9a' : '#000'} emissiveIntensity={isNight ? 0.7 : 0} transparent opacity={0.92} />
        </mesh>
        {/* Faint outer ripple ring at night */}
        {isNight && (
          <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.6, 3.0, 48]} />
            <meshBasicMaterial color={'#aac6ff'} transparent opacity={0.35} />
          </mesh>
        )}
      </group>

      {/* weather */}
      <Rain hidden={!(weather === 'rain' || weather === 'storm')} intensity={graphics === 'low' ? 250 : 600} />
      <Snow hidden={weather !== 'snow'} intensity={graphics === 'low' ? 150 : 400} />
    </>
  );
}
