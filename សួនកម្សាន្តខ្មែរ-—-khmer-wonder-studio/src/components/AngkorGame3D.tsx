import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  Crown,
  Heart,
  Home,
  LogIn,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  buildFlankPrasatTower,
  buildGoldenHareHero,
  buildGoldenLotus,
  buildLowNagaBarrier,
  buildTallTemplePillar,
  createAngkorMaterials,
  type AngkorMaterialSet,
} from '../utils/angkor3dModels';
import {
  fetchTopGameScores,
  saveGameScore,
  type CloudGameScore,
} from '../lib/firestoreStore';
import { useAuth } from '../context/AuthContext';

type GamePhase = 'TITLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';
type ObstacleKind = 'low' | 'tall';

interface ObstacleEntity {
  mesh: THREE.Group;
  kind: ObstacleKind;
  lane: number;
  z: number;
  active: boolean;
  hit: boolean;
}

interface LotusEntity {
  mesh: THREE.Group;
  lane: number;
  y: number;
  z: number;
  active: boolean;
  spinOffset: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  active: boolean;
}

interface HudSnapshot {
  score: number;
  lotuses: number;
  distance: number;
  hearts: number;
  combo: number;
}

interface AngkorGame3DProps {
  bestScore: number;
  onNewBestScore: (score: number) => void;
  onExit: () => void;
  sfxEnabledDefault?: boolean;
}

const LANES = [-2.6, 0, 2.6] as const;
const GRAVITY = 38;
const JUMP_VELOCITY = 14.8;
const FAST_DROP_GRAVITY = 82;
const BASE_SPEED = 16.5;
const MAX_SPEED = 35;

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ||
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
  } catch {
    return false;
  }
}

function createGameSfx() {
  let ctx: AudioContext | null = null;
  const getCtx = () => {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  };

  return {
    playLotus(combo: number, muted: boolean) {
      if (muted) return;
      const ac = getCtx();
      if (!ac) return;
      const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const freq = notes[Math.min(notes.length - 1, Math.max(0, combo - 1))];
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, ac.currentTime + 0.14);
      gain.gain.setValueAtTime(0.14, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.23);
    },
    playJump(muted: boolean) {
      if (muted) return;
      const ac = getCtx();
      if (!ac) return;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(520, ac.currentTime + 0.12);
      gain.gain.setValueAtTime(0.11, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.16);
    },
    playLane(muted: boolean) {
      if (muted) return;
      const ac = getCtx();
      if (!ac) return;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(420, ac.currentTime + 0.06);
      gain.gain.setValueAtTime(0.06, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.09);
    },
    playHit(muted: boolean) {
      if (muted) return;
      const ac = getCtx();
      if (!ac) return;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(145, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(48, ac.currentTime + 0.24);
      gain.gain.setValueAtTime(0.18, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.26);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.28);
    },
    playGong(muted: boolean) {
      if (muted) return;
      const ac = getCtx();
      if (!ac) return;
      const osc = ac.createOscillator();
      const osc2 = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc2.type = 'triangle';
      osc.frequency.setValueAtTime(196, ac.currentTime);
      osc2.frequency.setValueAtTime(293.66, ac.currentTime);
      gain.gain.setValueAtTime(0.16, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.85);
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc2.start();
      osc.stop(ac.currentTime + 0.88);
      osc2.stop(ac.currentTime + 0.88);
    },
    dispose() {
      if (ctx) {
        ctx.close().catch(() => {});
        ctx = null;
      }
    },
  };
}

export function AngkorGame3D({
  bestScore,
  onNewBestScore,
  onExit,
  sfxEnabledDefault = true,
}: AngkorGame3DProps) {
  const { user, signInWithGoogle, signingIn } = useAuth();
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const [phase, setPhase] = useState<GamePhase>('TITLE');
  const [muted, setMuted] = useState(!sfxEnabledDefault);
  const [hud, setHud] = useState<HudSnapshot>({
    score: 0,
    lotuses: 0,
    distance: 0,
    hearts: 3,
    combo: 1,
  });
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [damageFlash, setDamageFlash] = useState(false);
  const [leaderboard, setLeaderboard] = useState<CloudGameScore[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [scoreSavedCloud, setScoreSavedCloud] = useState(false);

  const phaseRef = useRef<GamePhase>('TITLE');
  const mutedRef = useRef(!sfxEnabledDefault);
  const bestScoreRef = useRef(bestScore);
  const sfxRef = useRef<ReturnType<typeof createGameSfx> | null>(null);
  const actionsRef = useRef<{
    startRun: () => void;
    moveLane: (delta: -1 | 1) => void;
    jump: () => void;
    fastDrop: () => void;
  }>({
    startRun: () => {},
    moveLane: () => {},
    jump: () => {},
    fastDrop: () => {},
  });

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    bestScoreRef.current = bestScore;
  }, [bestScore]);

  const loadLeaderboard = useCallback(async () => {
    setLoadingBoard(true);
    try {
      const scores = await fetchTopGameScores(6);
      setLeaderboard(scores);
    } catch {
      // Ignore if offline or unauthenticated error handled cleanly
    } finally {
      setLoadingBoard(false);
    }
  }, []);

  // Save score to Firestore automatically when Game Over and user is signed in
  useEffect(() => {
    if (phase !== 'GAMEOVER') return;
    let cancelled = false;

    const runSync = async () => {
      if (user && hud.score > 0 && !scoreSavedCloud) {
        try {
          await saveGameScore(
            user.uid,
            user.displayName || 'អ្នកលេងខ្មែរ',
            hud.score,
            hud.lotuses,
            hud.distance,
          );
          if (!cancelled) setScoreSavedCloud(true);
        } catch {
          // Non-fatal
        }
      }
      if (!cancelled) {
        await loadLeaderboard();
      }
    };
    runSync();
    return () => {
      cancelled = true;
    };
  }, [phase, user, hud.score, hud.lotuses, hud.distance, scoreSavedCloud, loadLeaderboard]);

  const handleStartGame = useCallback(() => {
    setScoreSavedCloud(false);
    setIsNewRecord(false);
    actionsRef.current.startRun();
    setPhase('PLAYING');
    sfxRef.current?.playGong(mutedRef.current);
  }, []);

  const handleTogglePause = useCallback(() => {
    if (phaseRef.current === 'PLAYING') {
      setPhase('PAUSED');
    } else if (phaseRef.current === 'PAUSED') {
      setPhase('PLAYING');
    }
  }, []);

  // Main Three.js Engine Lifecycle
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const sfx = createGameSfx();
    sfxRef.current = sfx;

    const isSoftwareGl = detectSoftwareWebGL();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3a2015);
    scene.fog = new THREE.FogExp2(0x3a2015, 0.0135);

    const camera = new THREE.PerspectiveCamera(
      56,
      (mount.clientWidth || window.innerWidth) / (mount.clientHeight || window.innerHeight),
      0.1,
      260,
    );
    camera.position.set(0, 4.4, 7.6);

    // PBR Environment Lighting (always enabled on every device)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmrem.dispose();

    // Lighting Hierarchy: Warm Angkor golden-hour sun + cool bounce + subtle rim
    const hemiLight = new THREE.HemisphereLight(0xfde68a, 0x3b2416, 1.05);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffe1ad, 2.75);
    sunLight.position.set(16, 26, 14);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 90;
      sunLight.shadow.camera.left = -22;
      sunLight.shadow.camera.right = 22;
      sunLight.shadow.camera.top = 24;
      sunLight.shadow.camera.bottom = -24;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xf59e0b, 0.72);
    rimLight.position.set(-10, 12, -28);
    scene.add(rimLight);

    const mats: AngkorMaterialSet = createAngkorMaterials(renderer);

    // Track disposable resources
    const extraDisposables: { dispose: () => void }[] = [];

    // Sky Backdrop Dome + Glowing Golden Angkor Sun + Distant 5-Spire Angkor Silhouette
    const sunGeo = new THREE.SphereGeometry(14, 24, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfcd34d, fog: false });
    const sunDisc = new THREE.Mesh(sunGeo, sunMat);
    sunDisc.position.set(0, 21, -138);
    scene.add(sunDisc);
    extraDisposables.push(sunGeo, sunMat);

    const haloGeo = new THREE.SphereGeometry(21, 24, 16);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.24,
      fog: false,
    });
    const sunHalo = new THREE.Mesh(haloGeo, haloMat);
    sunHalo.position.copy(sunDisc.position);
    scene.add(sunHalo);
    extraDisposables.push(haloGeo, haloMat);

    const distantGroup = new THREE.Group();
    const silhouetteMat = new THREE.MeshStandardMaterial({
      color: 0x3b2216,
      roughness: 0.95,
      metalness: 0.05,
    });
    extraDisposables.push(silhouetteMat);
    const spireOffsets = [-24, -12, 0, 12, 24];
    const spireHeights = [14, 19, 27, 19, 14];
    spireOffsets.forEach((sx, idx) => {
      const h = spireHeights[idx];
      const towerGeo = new THREE.ConeGeometry(4.4, h, 6);
      const tower = new THREE.Mesh(towerGeo, silhouetteMat);
      tower.position.set(sx, h * 0.5 - 1, -124);
      distantGroup.add(tower);
      extraDisposables.push(towerGeo);
    });
    const baseTempleGeo = new THREE.BoxGeometry(62, 6, 12);
    const baseTemple = new THREE.Mesh(baseTempleGeo, silhouetteMat);
    baseTemple.position.set(0, 2, -124);
    distantGroup.add(baseTemple);
    extraDisposables.push(baseTempleGeo);
    scene.add(distantGroup);

    // Extended Mekong Moat Water Plane
    const waterGeo = new THREE.PlaneGeometry(260, 260);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x16424a,
      roughness: 0.16,
      metalness: 0.42,
    });
    const waterPlane = new THREE.Mesh(waterGeo, waterMat);
    waterPlane.rotation.x = -Math.PI / 2;
    waterPlane.position.set(0, -0.82, -55);
    scene.add(waterPlane);
    extraDisposables.push(waterGeo, waterMat);

    // Repeating Sandstone Causeway Tiles (6 segments of length 24 = 144 units)
    const SEGMENT_LEN = 24;
    const SEGMENT_COUNT = 6;
    const causewaySegments: THREE.Group[] = [];
    const deckGeo = new THREE.BoxGeometry(9.6, 0.9, SEGMENT_LEN);
    const curbGeo = new THREE.BoxGeometry(0.65, 0.58, SEGMENT_LEN);
    const laneStripGeo = new THREE.BoxGeometry(0.14, 0.05, SEGMENT_LEN);
    const postGeo = new THREE.BoxGeometry(0.75, 1.15, 0.75);
    const lanternCapGeo = new THREE.OctahedronGeometry(0.24, 0);
    extraDisposables.push(deckGeo, curbGeo, laneStripGeo, postGeo, lanternCapGeo);

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = new THREE.Group();
      const deck = new THREE.Mesh(deckGeo, mats.sandstone);
      deck.position.y = -0.45;
      deck.receiveShadow = true;
      seg.add(deck);

      for (const side of [-4.95, 4.95]) {
        const curb = new THREE.Mesh(curbGeo, mats.sandstoneDark);
        curb.position.set(side, 0.15, 0);
        curb.receiveShadow = true;
        seg.add(curb);

        for (const zOff of [-8, 0, 8]) {
          const post = new THREE.Mesh(postGeo, mats.sandstoneDark);
          post.position.set(side, 0.55, zOff);
          seg.add(post);

          const orb = new THREE.Mesh(lanternCapGeo, mats.lotusCore);
          orb.position.set(side, 1.32, zOff);
          seg.add(orb);
        }
      }

      // Golden lane dividers between 3 lanes (-2.6 | 0 | 2.6)
      for (const lx of [-1.3, 1.3]) {
        const strip = new THREE.Mesh(laneStripGeo, mats.gold);
        strip.position.set(lx, 0.02, 0);
        seg.add(strip);
      }

      seg.position.z = 12 - i * SEGMENT_LEN;
      scene.add(seg);
      causewaySegments.push(seg);
    }

    // Flanking Angkor Prasat Towers along both sides of the moat
    const flankTowers: THREE.Group[] = [];
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const tower = buildFlankPrasatTower(mats);
      const row = Math.floor(i / 2);
      tower.position.set(side * 12.6, -0.7, -8 - row * 32);
      scene.add(tower);
      flankTowers.push(tower);
    }

    // Instanced Floating Golden Temple Embers
    const EMBER_COUNT = 56;
    const emberGeo = new THREE.OctahedronGeometry(0.12, 0);
    const emberMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.78,
    });
    const emberMesh = new THREE.InstancedMesh(emberGeo, emberMat, EMBER_COUNT);
    emberMesh.frustumCulled = false;
    scene.add(emberMesh);
    extraDisposables.push(emberGeo, emberMat);

    const emberData = Array.from({ length: EMBER_COUNT }, (_, i) => ({
      x: (Math.sin(i * 19.7) * 0.5 + (i % 2 === 0 ? -1 : 1) * (6.5 + (i % 7) * 1.4)),
      y: 1.2 + (i % 9) * 0.85,
      z: -105 + (i / EMBER_COUNT) * 120,
      phase: i * 0.7,
    }));
    const dummy = new THREE.Object3D();

    // Hero Actor: Golden Angkor Spirit Hare
    const hero = buildGoldenHareHero(mats);
    scene.add(hero);

    // Pooled Obstacles (6 Low Naga Barriers + 6 Tall Prasat Pillars)
    const obstaclePool: ObstacleEntity[] = [];
    for (let i = 0; i < 6; i++) {
      const low = buildLowNagaBarrier(mats);
      low.visible = false;
      scene.add(low);
      obstaclePool.push({ mesh: low, kind: 'low', lane: 1, z: -120, active: false, hit: false });

      const tall = buildTallTemplePillar(mats);
      tall.visible = false;
      scene.add(tall);
      obstaclePool.push({ mesh: tall, kind: 'tall', lane: 1, z: -120, active: false, hit: false });
    }

    // Pooled Collectible Golden Lotuses
    const lotusPool: LotusEntity[] = [];
    for (let i = 0; i < 24; i++) {
      const lotus = buildGoldenLotus(mats);
      lotus.visible = false;
      scene.add(lotus);
      lotusPool.push({
        mesh: lotus,
        lane: 1,
        y: 0.7,
        z: -120,
        active: false,
        spinOffset: i * 0.65,
      });
    }

    // Pooled Spark Particles for Lotus pickups & hits
    const sparkGeo = new THREE.OctahedronGeometry(0.11, 0);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    extraDisposables.push(sparkGeo, sparkMat);
    const sparkPool: SparkParticle[] = [];
    for (let i = 0; i < 32; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.visible = false;
      scene.add(mesh);
      sparkPool.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.45,
        active: false,
      });
    }

    const spawnSparks = (x: number, y: number, z: number, count = 10) => {
      let spawned = 0;
      for (const p of sparkPool) {
        if (p.active) continue;
        p.active = true;
        p.life = 0;
        p.maxLife = 0.35 + Math.random() * 0.25;
        p.mesh.position.set(x, y, z);
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.4 + Math.random() * 4.2;
        p.vx = Math.cos(angle) * speed;
        p.vy = 2.2 + Math.random() * 4.5;
        p.vz = Math.sin(angle) * speed;
        p.mesh.scale.setScalar(1);
        p.mesh.visible = true;
        spawned++;
        if (spawned >= count) break;
      }
    };

    // Mutable Game Simulation State
    let laneIndex = 1;
    let heroX = 0;
    let heroY = 0;
    let heroVy = 0;
    let grounded = true;
    let coyoteTimer = 0;
    let jumpBufferTimer = 0;
    let fastDropping = false;
    let squashX = 1;
    let squashY = 1;
    let runPhase = 0;

    let speed = BASE_SPEED;
    let distance = 0;
    let bonusScore = 0;
    let lotuses = 0;
    let hearts = 3;
    let combo = 1;
    let invulnTimer = 0;
    let hitstopTimer = 0;
    let shakeIntensity = 0;
    let spawnCooldown = 1.1;
    let hudEmitAccum = 0;
    let titleOrbitAngle = 0;

    const resetWorld = () => {
      laneIndex = 1;
      heroX = 0;
      heroY = 0;
      heroVy = 0;
      grounded = true;
      coyoteTimer = 0;
      jumpBufferTimer = 0;
      fastDropping = false;
      squashX = 1;
      squashY = 1;
      speed = BASE_SPEED;
      distance = 0;
      bonusScore = 0;
      lotuses = 0;
      hearts = 3;
      combo = 1;
      invulnTimer = 0;
      hitstopTimer = 0;
      shakeIntensity = 0;
      spawnCooldown = 1.05;
      hero.visible = true;
      hero.position.set(0, 0, 0);
      hero.rotation.set(0, 0, 0);
      hero.scale.set(1, 1, 1);

      for (const ob of obstaclePool) {
        ob.active = false;
        ob.hit = false;
        ob.mesh.visible = false;
      }
      for (const lt of lotusPool) {
        lt.active = false;
        lt.mesh.visible = false;
      }
      for (const sp of sparkPool) {
        sp.active = false;
        sp.mesh.visible = false;
      }
      setHud({ score: 0, lotuses: 0, distance: 0, hearts: 3, combo: 1 });
    };

    const spawnWave = () => {
      const zStart = -102;
      // Pick 1 or 2 blocked lanes, ALWAYS guaranteeing >= 1 open or jumpable lane
      const lanesOrder = [0, 1, 2].sort(() => Math.random() - 0.5);
      const count = distance > 180 && Math.random() < 0.58 ? 2 : 1;
      const usedLanes = new Set<number>();

      for (let i = 0; i < count; i++) {
        const ln = lanesOrder[i];
        const kind: ObstacleKind = Math.random() < 0.46 ? 'low' : 'tall';
        const ob = obstaclePool.find((o) => !o.active && o.kind === kind);
        if (ob) {
          ob.active = true;
          ob.hit = false;
          ob.lane = ln;
          ob.z = zStart - i * 2.2;
          ob.mesh.position.set(LANES[ln], 0, ob.z);
          ob.mesh.visible = true;
          usedLanes.add(ln);

          // Put an inviting jump arc of lotuses over a low barrier sometimes
          if (kind === 'low' && Math.random() < 0.6) {
            const arcOffsets = [
              { dz: 3.4, y: 1.0 },
              { dz: 0, y: 2.25 },
              { dz: -3.4, y: 1.0 },
            ];
            for (const pt of arcOffsets) {
              const lt = lotusPool.find((l) => !l.active);
              if (lt) {
                lt.active = true;
                lt.lane = ln;
                lt.y = pt.y;
                lt.z = ob.z + pt.dz;
                lt.mesh.position.set(LANES[ln], lt.y, lt.z);
                lt.mesh.visible = true;
              }
            }
          }
        }
      }

      // Spawn a guiding lotus line in an open lane
      const openLane = [0, 1, 2].find((l) => !usedLanes.has(l)) ?? 1;
      const lineCount = 3 + Math.floor(Math.random() * 2);
      for (let k = 0; k < lineCount; k++) {
        const lt = lotusPool.find((l) => !l.active);
        if (!lt) break;
        lt.active = true;
        lt.lane = openLane;
        lt.y = 0.85;
        lt.z = zStart + 4 - k * 3.2;
        lt.mesh.position.set(LANES[openLane], lt.y, lt.z);
        lt.mesh.visible = true;
      }
    };

    const moveLane = (delta: -1 | 1) => {
      if (phaseRef.current !== 'PLAYING') return;
      const next = Math.max(0, Math.min(2, laneIndex + delta));
      if (next !== laneIndex) {
        laneIndex = next;
        sfx.playLane(mutedRef.current);
      }
    };

    const requestJump = () => {
      if (phaseRef.current !== 'PLAYING') return;
      jumpBufferTimer = 0.13;
    };

    const requestFastDrop = () => {
      if (phaseRef.current !== 'PLAYING') return;
      if (!grounded) {
        fastDropping = true;
        if (heroVy > -8) heroVy = -11;
      }
    };

    actionsRef.current = {
      startRun: resetWorld,
      moveLane,
      jump: requestJump,
      fastDrop: requestFastDrop,
    };

    // Keyboard & Touch Input
    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (e.repeat) return;

      if (phaseRef.current === 'TITLE' && (e.code === 'Space' || e.code === 'Enter')) {
        setScoreSavedCloud(false);
        setIsNewRecord(false);
        resetWorld();
        setPhase('PLAYING');
        sfx.playGong(mutedRef.current);
        return;
      }

      if (phaseRef.current === 'GAMEOVER' && (e.code === 'Space' || e.code === 'Enter')) {
        setScoreSavedCloud(false);
        setIsNewRecord(false);
        resetWorld();
        setPhase('PLAYING');
        sfx.playGong(mutedRef.current);
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (phaseRef.current === 'PLAYING') setPhase('PAUSED');
        else if (phaseRef.current === 'PAUSED') setPhase('PLAYING');
        return;
      }

      if (phaseRef.current !== 'PLAYING') return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveLane(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') moveLane(1);
      else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') requestJump();
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') requestFastDrop();
    };

    let touchStartX = 0;
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (phaseRef.current !== 'PLAYING' || e.changedTouches.length === 0) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        moveLane(dx < 0 ? -1 : 1);
      } else if (dy < 0) {
        requestJump();
      } else {
        requestFastDrop();
      }
    };

    const onWindowBlur = () => {
      jumpBufferTimer = 0;
      fastDropping = false;
      if (phaseRef.current === 'PLAYING') {
        setPhase('PAUSED');
      }
    };

    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: true });

    // Software-WebGL-safe frame pacing
    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    let lastTime = performance.now();

    const glCtx = renderer.getContext();
    const gl2 = typeof WebGL2RenderingContext !== 'undefined' && glCtx instanceof WebGL2RenderingContext
      ? glCtx
      : null;

    const afterDraw = (cb: () => void) => {
      if (disposed) return;
      if (!isSoftwareGl) {
        rafId = window.requestAnimationFrame(cb);
        return;
      }
      if (!gl2) {
        timerId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        timerId = window.setTimeout(cb, 80);
        return;
      }
      gl2.flush();
      const poll = () => {
        if (disposed) {
          gl2.deleteSync(sync);
          return;
        }
        const status = gl2.clientWaitSync(sync, 0, 0);
        if (status === gl2.TIMEOUT_EXPIRED) {
          timerId = window.setTimeout(poll, 20);
        } else {
          gl2.deleteSync(sync);
          timerId = window.setTimeout(cb, 80);
        }
      };
      timerId = window.setTimeout(poll, 20);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const currentPhase = phaseRef.current;

      // Ambient floating embers always drift smoothly
      for (let i = 0; i < EMBER_COUNT; i++) {
        const e = emberData[i];
        e.phase += dt * 1.4;
        if (currentPhase === 'PLAYING' && hitstopTimer <= 0) {
          e.z += speed * 0.55 * dt;
          if (e.z > 16) e.z -= 120;
        }
        dummy.position.set(
          e.x + Math.sin(e.phase) * 0.45,
          e.y + Math.cos(e.phase * 1.3) * 0.35,
          e.z,
        );
        const s = 0.75 + Math.sin(e.phase * 2) * 0.25;
        dummy.scale.setScalar(s);
        dummy.rotation.y = e.phase;
        dummy.updateMatrix();
        emberMesh.setMatrixAt(i, dummy.matrix);
      }
      emberMesh.instanceMatrix.needsUpdate = true;

      // Update spark particles
      for (const p of sparkPool) {
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.mesh.visible = false;
          continue;
        }
        p.vy -= 12 * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.rotation.x += dt * 8;
        p.mesh.rotation.y += dt * 6;
        p.mesh.scale.setScalar(Math.max(0.01, 1 - p.life / p.maxLife));
      }

      if (currentPhase === 'TITLE') {
        titleOrbitAngle += dt * 0.32;
        const camX = Math.sin(titleOrbitAngle) * 3.8;
        const camZ = 6.2 + Math.cos(titleOrbitAngle) * 1.1;
        camera.position.set(camX, 3.6 + Math.sin(titleOrbitAngle * 0.7) * 0.25, camZ);
        camera.lookAt(0, 1.35, -3);

        hero.position.set(0, Math.sin(now * 0.003) * 0.08, 0);
        hero.rotation.y = Math.sin(titleOrbitAngle * 0.8) * 0.28;
        hero.rotation.z = 0;

        // Gentle scenic causeway drift behind title screen
        for (const seg of causewaySegments) {
          seg.position.z += 4.2 * dt;
          if (seg.position.z > 24) seg.position.z -= SEGMENT_LEN * SEGMENT_COUNT;
        }
      } else if (currentPhase === 'PLAYING') {
        if (hitstopTimer > 0) {
          hitstopTimer = Math.max(0, hitstopTimer - dt);
        } else {
          // Progressive speed ramp
          speed = Math.min(MAX_SPEED, BASE_SPEED + distance * 0.014);
          distance += speed * dt;
          runPhase += dt * (speed * 0.78);

          // Scroll causeway & flanking Prasat towers
          for (const seg of causewaySegments) {
            seg.position.z += speed * dt;
            if (seg.position.z > 24) {
              seg.position.z -= SEGMENT_LEN * SEGMENT_COUNT;
            }
          }
          for (const tw of flankTowers) {
            tw.position.z += speed * dt;
            if (tw.position.z > 22) {
              tw.position.z -= 128;
            }
          }

          // Hero lane switching with smooth exponential damping
          const targetX = LANES[laneIndex];
          heroX += (targetX - heroX) * (1 - Math.exp(-15 * dt));

          // Coyote time & jump input buffering
          if (grounded) coyoteTimer = 0.1;
          else coyoteTimer = Math.max(0, coyoteTimer - dt);

          if (jumpBufferTimer > 0) {
            jumpBufferTimer = Math.max(0, jumpBufferTimer - dt);
            if (coyoteTimer > 0) {
              heroVy = JUMP_VELOCITY;
              grounded = false;
              coyoteTimer = 0;
              jumpBufferTimer = 0;
              fastDropping = false;
              squashX = 0.82;
              squashY = 1.24;
              sfx.playJump(mutedRef.current);
            }
          }

          // Vertical jump physics
          if (!grounded || heroVy !== 0) {
            const grav = fastDropping ? FAST_DROP_GRAVITY : GRAVITY;
            heroVy -= grav * dt;
            heroY += heroVy * dt;
            if (heroY <= 0) {
              heroY = 0;
              heroVy = 0;
              if (!grounded) {
                grounded = true;
                fastDropping = false;
                squashX = 1.22;
                squashY = 0.78;
                spawnSparks(heroX, 0.12, 0, 5);
              }
            }
          }

          // Recover squash & stretch smoothly
          squashX += (1 - squashX) * (1 - Math.exp(-14 * dt));
          squashY += (1 - squashY) * (1 - Math.exp(-14 * dt));

          const gallopBob = grounded ? Math.abs(Math.sin(runPhase)) * 0.12 : 0;
          hero.position.set(heroX, heroY + gallopBob, 0);
          hero.rotation.y = 0;
          hero.rotation.z = -(targetX - heroX) * 0.13;
          hero.rotation.x = grounded ? Math.sin(runPhase * 2) * 0.04 : -heroVy * 0.015;
          hero.scale.set(squashX, squashY, squashX);

          // Invulnerability blink after damage
          if (invulnTimer > 0) {
            invulnTimer = Math.max(0, invulnTimer - dt);
            hero.visible = Math.floor(invulnTimer * 18) % 2 === 0;
          } else {
            hero.visible = true;
          }

          // Spawn waves
          spawnCooldown -= dt;
          if (spawnCooldown <= 0) {
            spawnWave();
            const interval = Math.max(0.68, 1.52 - (speed - BASE_SPEED) * 0.036);
            spawnCooldown = interval + Math.random() * 0.25;
          }

          // Update obstacles & check collisions
          for (const ob of obstaclePool) {
            if (!ob.active) continue;
            ob.z += speed * dt;
            ob.mesh.position.z = ob.z;

            if (ob.z > 10) {
              ob.active = false;
              ob.mesh.visible = false;
              continue;
            }

            if (!ob.hit && invulnTimer <= 0 && Math.abs(ob.z) < 0.92) {
              const obX = LANES[ob.lane];
              if (Math.abs(heroX - obX) < 0.96) {
                const clearedLow = ob.kind === 'low' && heroY > 0.88;
                if (!clearedLow) {
                  ob.hit = true;
                  hearts -= 1;
                  combo = 1;
                  invulnTimer = 1.5;
                  hitstopTimer = 0.055;
                  shakeIntensity = 0.42;
                  sfx.playHit(mutedRef.current);
                  spawnSparks(heroX, heroY + 0.9, 0, 14);
                  setDamageFlash(true);
                  window.setTimeout(() => setDamageFlash(false), 180);

                  if (hearts <= 0) {
                    const finalScore = Math.floor(distance) + bonusScore;
                    const newBest = finalScore > bestScoreRef.current;
                    if (newBest) {
                      onNewBestScore(finalScore);
                      setIsNewRecord(true);
                    }
                    setHud({
                      score: finalScore,
                      lotuses,
                      distance: Math.floor(distance),
                      hearts: 0,
                      combo: 1,
                    });
                    setPhase('GAMEOVER');
                    sfx.playGong(mutedRef.current);
                  }
                }
              }
            }
          }

          // Update collectible golden lotuses
          for (const lt of lotusPool) {
            if (!lt.active) continue;
            lt.z += speed * dt;
            const bob = Math.sin(now * 0.005 + lt.spinOffset) * 0.16;
            lt.mesh.position.set(LANES[lt.lane], lt.y + bob, lt.z);
            lt.mesh.rotation.y += dt * 2.4;

            if (lt.z > 8) {
              lt.active = false;
              lt.mesh.visible = false;
              continue;
            }

            if (
              Math.abs(lt.z) < 1.15 &&
              Math.abs(heroX - LANES[lt.lane]) < 1.15 &&
              Math.abs(heroY + 0.9 - lt.y) < 1.35
            ) {
              lt.active = false;
              lt.mesh.visible = false;
              lotuses += 1;
              bonusScore += 15 * combo;
              combo = Math.min(5, combo + 1);
              sfx.playLotus(combo, mutedRef.current);
              spawnSparks(LANES[lt.lane], lt.y, lt.z, 10);
            }
          }

          // Smooth camera chase + dynamic FOV + decaying shake
          if (shakeIntensity > 0) {
            shakeIntensity = Math.max(0, shakeIntensity - dt * 1.9);
          }
          const sx = (Math.random() - 0.5) * shakeIntensity;
          const sy = (Math.random() - 0.5) * shakeIntensity;
          const targetCamX = heroX * 0.36;
          camera.position.x += (targetCamX - camera.position.x) * (1 - Math.exp(-8 * dt)) + sx;
          camera.position.y += (4.35 + heroY * 0.28 - camera.position.y) * (1 - Math.exp(-8 * dt)) + sy;
          camera.position.z += (7.5 - camera.position.z) * (1 - Math.exp(-6 * dt));
          camera.lookAt(heroX * 0.25, 1.45 + heroY * 0.15, -14);

          const targetFov = 56 + ((speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED)) * 8;
          if (Math.abs(camera.fov - targetFov) > 0.05) {
            camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-4 * dt));
            camera.updateProjectionMatrix();
          }

          // Throttled HUD updates (~12Hz)
          hudEmitAccum += dt;
          if (hudEmitAccum >= 0.08) {
            hudEmitAccum = 0;
            setHud({
              score: Math.floor(distance) + bonusScore,
              lotuses,
              distance: Math.floor(distance),
              hearts,
              combo,
            });
          }
        }
      }

      renderer.render(scene, camera);
      afterDraw(tick);
    };

    tick();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);

      sfx.dispose();

      // Dispose scene geometries & materials
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
      extraDisposables.forEach((d) => d.dispose());
      mats.sandstone.dispose();
      mats.sandstoneDark.dispose();
      mats.mossyStone.dispose();
      mats.gold.dispose();
      mats.lotusPetal.dispose();
      mats.lotusCore.dispose();
      mats.rubyAccent.dispose();
      mats.jadeAccent.dispose();
      mats.contactShadow.dispose();
      mats.textures.forEach((t) => t.dispose());
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [onNewBestScore]);

  return (
    <div className="fixed inset-0 z-40 h-screen w-screen overflow-hidden bg-[#1e120a] text-amber-50 select-none">
      {/* Isolated WebGL Canvas Container — zero React children inside */}
      <div ref={canvasMountRef} className="h-full w-full" />

      {/* Brief Crimson Hit Flash */}
      {damageFlash && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10 border-[10px] border-red-500/75 bg-red-600/20"
        />
      )}

      {/* TITLE SCREEN OVERLAY */}
      {phase === 'TITLE' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onExit}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-xl border border-amber-300/30 bg-[#1a1009]/88 px-4 py-2.5 text-xs font-bold text-amber-100 shadow-lg transition-colors hover:border-amber-400 hover:bg-[#2a190e]"
            >
              <Home className="h-4 w-4 text-amber-400" />
              ត្រឡប់ទៅសួនកម្សាន្ត
            </button>

            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'បើកសំឡេង' : 'បិទសំឡេង'}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xl border border-amber-300/30 bg-[#1a1009]/88 px-3.5 py-2.5 text-xs font-semibold text-amber-100 hover:border-amber-400"
            >
              {muted ? <VolumeX className="h-4 w-4 text-amber-400" /> : <Volume2 className="h-4 w-4 text-amber-400" />}
              {muted ? 'បិទសំឡេង' : 'សំឡេងបើក'}
            </button>
          </div>

          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            {/* Bespoke Khmer Angkor Lotus Crest SVG */}
            <svg
              viewBox="0 0 120 72"
              className="mb-3 h-14 w-24 drop-shadow-[0_4px_16px_rgba(245,158,11,0.55)]"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="angkorGold" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="55%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
              </defs>
              <path
                d="M60 6 L72 28 L96 22 L80 44 L106 54 L60 64 L14 54 L40 44 L24 22 L48 28 Z"
                fill="url(#angkorGold)"
                stroke="#fffbeb"
                strokeWidth="1.5"
              />
              <circle cx="60" cy="40" r="9" fill="#fef08a" />
            </svg>

            <p className="text-xs font-semibold tracking-wider text-amber-300">
              ហ្គេមរត់ប្រណាំងលើស្ពានថ្មអង្គរ
            </p>
            <h1 className="font-display mt-2 text-4xl font-bold tracking-tight text-amber-50 drop-shadow-[0_4px_18px_rgba(0,0,0,0.85)] sm:text-6xl">
              អង្គររត់ប្រណាំង
            </h1>
            <p className="mt-2 max-w-md text-sm text-amber-100/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              ដឹកនាំសុភាទន្សាយមាសរត់លើស្ពានថ្មអង្គរ គេចសសរប្រាសាទ លោតរំលងនាគ និងប្រមូលផ្កាឈូកមាស។
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleStartGame}
                className="pointer-events-auto inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-600 px-8 py-4 text-base font-bold text-stone-950 shadow-[0_8px_28px_rgba(245,158,11,0.45)] transition-transform hover:scale-105 active:scale-95"
              >
                <Play className="h-5 w-5 fill-stone-950" />
                ចាប់ផ្ដើមរត់ឥឡូវនេះ
              </button>
            </div>

            {bestScore > 0 && (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#1a1009]/85 px-3.5 py-1.5 text-xs font-bold text-amber-300">
                <Crown className="h-3.5 w-3.5" />
                ពិន្ទុខ្ពស់បំផុតរបស់អ្នក៖ <span className="font-mono-num">{bestScore.toLocaleString()}</span>
              </p>
            )}
          </div>

          <div className="mx-auto rounded-xl border border-amber-200/20 bg-[#1a1009]/88 px-5 py-2.5 text-center text-xs font-medium text-amber-100/90">
            ← → ឬ A D ប្ដូរផ្លូវ · Space / ↑ លោតរំលង · ↓ ចុះលឿន · P ផ្អាក (អូសលើអេក្រង់សម្រាប់ទូរស័ព្ទ)
          </div>
        </div>
      )}

      {/* MINIMAL PERIMETER HUD DURING PLAYING */}
      {phase === 'PLAYING' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            {/* Top-Left: Hearts + Score + Combo */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 rounded-xl border border-amber-300/25 bg-[#190f08]/85 px-3.5 py-2 shadow">
                {[0, 1, 2].map((idx) => (
                  <Heart
                    key={idx}
                    className={`h-5 w-5 transition-transform ${
                      idx < hud.hearts
                        ? 'fill-rose-500 text-rose-400 scale-100'
                        : 'text-stone-600 scale-90'
                    }`}
                  />
                ))}
                {hud.combo > 1 && (
                  <span className="ml-2 font-mono-num text-xs font-extrabold text-amber-300">
                    x{hud.combo}
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-amber-300/25 bg-[#190f08]/85 px-4 py-2 shadow">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">
                  ពិន្ទុសរុប
                </p>
                <p className="font-mono-num text-2xl font-extrabold text-amber-50">
                  {hud.score.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Top-Right: Lotuses + Distance + Controls */}
            <div className="flex items-start gap-2">
              <div className="hidden rounded-xl border border-amber-300/25 bg-[#190f08]/85 px-3.5 py-2 text-right shadow sm:block">
                <p className="text-[10px] font-semibold text-amber-300/80">ផ្កាឈូក · ចម្ងាយ</p>
                <p className="font-mono-num text-sm font-bold text-amber-100">
                  <Sparkles className="mr-1 inline h-3.5 w-3.5 text-amber-400" />
                  {hud.lotuses} · {hud.distance}m
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'បើកសំឡេង' : 'បិទសំឡេង'}
                className="pointer-events-auto grid h-10 w-10 place-items-center rounded-xl border border-amber-300/25 bg-[#190f08]/88 text-amber-200 hover:border-amber-400"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={handleTogglePause}
                aria-label="ផ្អាកហ្គេម"
                className="pointer-events-auto grid h-10 w-10 place-items-center rounded-xl border border-amber-300/25 bg-[#190f08]/88 text-amber-200 hover:border-amber-400"
              >
                <Pause className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mobile On-Screen Touch Controls (small screens only) */}
          <div className="flex items-end justify-between sm:hidden">
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="ទៅឆ្វេង"
                onClick={() => actionsRef.current.moveLane(-1)}
                className="pointer-events-auto grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/35 bg-[#190f08]/85 text-amber-200 active:scale-95"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="ទៅស្ដាំ"
                onClick={() => actionsRef.current.moveLane(1)}
                className="pointer-events-auto grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/35 bg-[#190f08]/85 text-amber-200 active:scale-95"
              >
                <ArrowRight className="h-6 w-6" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="ចុះលឿន"
                onClick={() => actionsRef.current.fastDrop()}
                className="pointer-events-auto grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/35 bg-[#190f08]/85 text-amber-200 active:scale-95"
              >
                <ArrowDown className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="លោត"
                onClick={() => actionsRef.current.jump()}
                className="pointer-events-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500 text-stone-950 shadow-lg active:scale-95"
              >
                <ArrowUp className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAUSED OVERLAY */}
      {phase === 'PAUSED' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-amber-300/30 bg-[#1c120a] p-6 text-center shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-amber-100">ផ្អាកហ្គេម</h2>
            <p className="mt-1 text-xs text-amber-200/80">
              ពិន្ទុបច្ចុប្បន្ន៖ <span className="font-mono-num font-bold">{hud.score.toLocaleString()}</span>
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setPhase('PLAYING')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 hover:bg-amber-400"
              >
                <Play className="h-4 w-4 fill-stone-950" />
                បន្តរត់ទៀត
              </button>
              <button
                type="button"
                onClick={handleStartGame}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-[#2a1b10] px-5 py-3 text-sm font-semibold text-amber-100 hover:border-amber-400"
              >
                <RotateCcw className="h-4 w-4" />
                ចាប់ផ្ដើមឡើងវិញ
              </button>
              <button
                type="button"
                onClick={onExit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/20 px-5 py-2.5 text-xs font-medium text-amber-200/85 hover:text-white"
              >
                <Home className="h-4 w-4" />
                ត្រឡប់ទៅសួនកម្សាន្ត
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER + CLOUD LEADERBOARD OVERLAY */}
      {phase === 'GAMEOVER' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl border border-amber-400/35 bg-[#1b1109] p-6 shadow-2xl">
            <div className="text-center">
              {isNewRecord && (
                <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Crown className="h-4 w-4" />
                  កំណត់ត្រាថ្មី!
                </p>
              )}
              <h2 className="font-display text-3xl font-bold text-amber-50">បញ្ចប់ការរត់</h2>
              <p className="font-mono-num mt-2 text-4xl font-extrabold text-amber-400">
                {hud.score.toLocaleString()}
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-amber-300/20 bg-[#27180d] p-3 text-center">
                <div>
                  <p className="text-[11px] text-amber-200/70">ផ្កាឈូកមាស</p>
                  <p className="font-mono-num text-base font-bold text-amber-100">{hud.lotuses}</p>
                </div>
                <div>
                  <p className="text-[11px] text-amber-200/70">ចម្ងាយរត់</p>
                  <p className="font-mono-num text-base font-bold text-amber-100">{hud.distance}m</p>
                </div>
                <div>
                  <p className="text-[11px] text-amber-200/70">ខ្ពស់បំផុត</p>
                  <p className="font-mono-num text-base font-bold text-amber-300">
                    {Math.max(bestScore, hud.score).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Cloud Leaderboard */}
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-[#24160c] p-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
                  <Award className="h-4 w-4 text-amber-400" />
                  តារាងពិន្ទុកំពូល (Leaderboard)
                </h3>
                {user ? (
                  <span className="text-[11px] text-emerald-400">
                    {scoreSavedCloud ? 'បានរក្សាទុកពិន្ទុ' : 'កំពុងរក្សាទុក...'}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={signingIn}
                    onClick={signInWithGoogle}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30"
                  >
                    <LogIn className="h-3 w-3" />
                    ចូល Google ដើម្បីរក្សាពិន្ទុ
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-1.5">
                {loadingBoard ? (
                  <p className="py-2 text-center text-xs text-amber-200/60">កំពុងទាញតារាងពិន្ទុ...</p>
                ) : leaderboard.length === 0 ? (
                  <p className="py-2 text-center text-xs text-amber-200/60">
                    មិនទាន់មានកំណត់ត្រានៅឡើយទេ — ក្លាយជាអ្នកដំបូង!
                  </p>
                ) : (
                  leaderboard.map((row, i) => (
                    <div
                      key={row.id}
                      className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-xs ${
                        user && row.uid === user.uid
                          ? 'bg-amber-500/20 font-bold text-amber-100'
                          : 'bg-[#1a1009] text-amber-100/85'
                      }`}
                    >
                      <span className="truncate">
                        <span className="font-mono-num mr-2 text-amber-400">#{i + 1}</span>
                        {row.playerName}
                      </span>
                      <span className="font-mono-num font-bold text-amber-300">
                        {row.score.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleStartGame}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 hover:bg-amber-400"
              >
                <RotateCcw className="h-4 w-4" />
                លេងម្ដងទៀត
              </button>
              <button
                type="button"
                onClick={onExit}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-[#2a1b10] px-4 py-3 text-sm font-semibold text-amber-100 hover:border-amber-400"
              >
                <Home className="h-4 w-4" />
                ចាកចេញ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
