import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import {
  Sparkles,
  Users,
  Cpu,
  Radio,
  Crosshair,
  Droplets,
  Smartphone,
  Maximize2,
} from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import { Participant } from '../../types/participant';
import { audioService } from '../../services/audio-service';
import { isGameBusy } from '../../engine/game-state-machine';
import { DrawEngine } from '../../engine/draw-engine';
import { useFullscreen } from '../../hooks/useFullscreen';

type CitizenActivity = 'walking' | 'crossing' | 'park_stroll';
type CitizenPhysicsState = 'normal' | 'fallen' | 'in_fountain' | 'abducting';

interface FountainSpec {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  rx: number; // normalized horizontal radius
  ry: number; // normalized vertical radius
}

interface StreetCartSpec {
  x: number;
  y: number;
  name: string;
  awningColor1: string;
  awningColor2: string;
  bodyColor: string;
}

interface CityCitizen {
  participant: Participant;
  x: number; // 0.03 to 0.97 normalized canvas width
  y: number; // 0.47 to 0.93 normalized canvas height
  vx: number;
  vy: number;
  targetY: number;
  facing: 1 | -1;
  activity: CitizenActivity;
  physicsState: CitizenPhysicsState;
  // Fall-down on road state when bumped by a vehicle
  fallTimer: number;
  fallDir: 1 | -1;
  slideVx: number;
  hopY: number;
  // Fall into North Park Water Fountain state ("hiệu ứng té vào bồn nước")
  fountainTimer: number; // frames remaining in fountain sequence (96 -> 0)
  fountainStartX: number;
  fountainStartY: number;
  fountainTargetX: number;
  fountainTargetY: number;
  fountainExitX: number;
  fountainExitY: number;
  hitCooldown: number;
  recoverSpeech: string | null;
  // Visual appearance
  skinColor: string;
  hairColor: string;
  hairStyle: number;
  outfitColor: string;
  pantsColor: string;
  accessoryType: number; // 0: none, 1: glasses, 2: cap, 3: headphones, 4: backpack
  hasPrideAccent: boolean;
  heightScale: number;
  animOffset: number;
  levitationProgress: number; // 0 = ground, 1 = inside UFO (animated by GSAP)
  isTargetWinner: boolean;
}

interface StreetVehicle {
  id: number;
  type: 'motorbike' | 'car' | 'sports-car' | 'taxi';
  laneIndex: number; // 0, 1 (left-bound), 2, 3 (right-bound)
  x: number;
  y: number;
  speed: number;
  direction: 1 | -1;
  color: string;
  riderColor: string;
}

interface WaterSplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface FountainRipple {
  x: number;
  y: number;
  rx: number;
  ry: number;
  maxRx: number;
  life: number;
  maxLife: number;
}

interface BumpEffect {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface BeamParticle {
  xOffset: number;
  yProg: number;
  speed: number;
  radius: number;
  color: string;
}

const MAX_REPRESENTATIVE_BOTS = 100;

const SKIN_PALETTE = ['#FFDFC4', '#F0C8A0', '#DEB38A', '#C68B59', '#8D5524', '#FFE4E1'];
const HAIR_PALETTE = ['#1E1B2E', '#4A2C11', '#8B5CF6', '#FF6B8A', '#38DDF8', '#F59E0B', '#10B981', '#EC4899'];
const OUTFIT_PALETTE = ['#8B5CF6', '#38DDF8', '#FF6B8A', '#FFD166', '#55E6A5', '#6366F1', '#EC4899', '#14B8A6'];
const PANTS_PALETTE = ['#1E293B', '#334155', '#1E1B4B', '#312E81', '#0F172A', '#3F3F46'];
const CAR_COLORS = ['#FF6B8A', '#38DDF8', '#FFD166', '#8B5CF6', '#55E6A5', '#F97316', '#EC4899', '#EF4444'];
const RECOVER_WORDS = ['Ui da! Ngã rồi...', 'Không sao, đi tiếp!', 'Phải nhìn đường mới được!'];
const FOUNTAIN_RECOVER_WORDS = [
  'Ướt nhẹp luôn rồi! 💦',
  'Nước mát quá haha! 💧',
  'Trượt chân té bồn nước! 💦',
];

// Map Vertical Zones (normalized 0..1 of canvas height)
const NORTH_SIDEWALK_MIN = 0.46;
const NORTH_SIDEWALK_MAX = 0.595;
const ROAD_MIN = 0.605;
const ROAD_MAX = 0.795;
const SOUTH_SIDEWALK_MIN = 0.805;
const SOUTH_SIDEWALK_MAX = 0.935;

const LANE_Y = [0.63, 0.675, 0.728, 0.772];

// 1 Single Grand Water Fountain in the North Park Plaza (above the road)
const NORTH_FOUNTAIN: FountainSpec = {
  x: 0.5,
  y: 0.528,
  rx: 0.058,
  ry: 0.044,
};

// Pedestrian Street Food Carts ("Phố đi bộ xe hàng rong") on the South Sidewalk (below the road)
const STREET_FOOD_CARTS: StreetCartSpec[] = [
  {
    x: 0.14,
    y: 0.905,
    name: '🥖 Bánh Mì Sài Gòn',
    awningColor1: '#FF6B8A',
    awningColor2: '#FFFFFF',
    bodyColor: '#D97706',
  },
  {
    x: 0.32,
    y: 0.905,
    name: '🍢 Cá Viên Chiên',
    awningColor1: '#F59E0B',
    awningColor2: '#FEF08A',
    bodyColor: '#B45309',
  },
  {
    x: 0.5,
    y: 0.905,
    name: '🧋 Trà Sữa & Kem',
    awningColor1: '#38DDF8',
    awningColor2: '#FFFFFF',
    bodyColor: '#0284C7',
  },
  {
    x: 0.68,
    y: 0.905,
    name: '🥤 Nước Mía Siêu Sạch',
    awningColor1: '#55E6A5',
    awningColor2: '#FFFFFF',
    bodyColor: '#059669',
  },
  {
    x: 0.86,
    y: 0.905,
    name: '🍜 Hủ Tiếu Gõ',
    awningColor1: '#8B5CF6',
    awningColor2: '#FFD166',
    bodyColor: '#6D28D9',
  },
];

export const UfoAbductionGame: React.FC = () => {
  const participants = useAppStore((s) => s.participants);
  const excludedIds = useAppStore((s) => s.excludedIds);
  const allowRepeatWinner = useAppStore((s) => s.settings.allowRepeatWinner);
  const animationDuration = useAppStore((s) => s.settings.animationDuration);
  const reducedMotion = useAppStore((s) => s.settings.reducedMotion);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const gameState = useAppStore((s) => s.gameState);
  const setGameState = useAppStore((s) => s.setGameState);
  const startDraw = useAppStore((s) => s.startDraw);
  const revealWinnerOverlay = useAppStore((s) => s.revealWinnerOverlay);
  const isFullscreen = useAppStore((s) => s.isFullscreen);
  const { toggleFullscreen } = useFullscreen();

  const eligible = useMemo(
    () => DrawEngine.getEligibleParticipants(participants, excludedIds, allowRepeatWinner),
    [participants, excludedIds, allowRepeatWinner]
  );

  // Sample at most MAX_REPRESENTATIVE_BOTS (100, or 45 in reducedMotion) for buttery 60fps performance
  const maxBots = reducedMotion ? 45 : MAX_REPRESENTATIVE_BOTS;
  const representativePool = useMemo(() => {
    if (eligible.length <= maxBots) return eligible;
    const step = eligible.length / maxBots;
    const sampled: Participant[] = [];
    for (let i = 0; i < maxBots; i++) {
      sampled.push(eligible[Math.floor(i * step)]);
    }
    return sampled;
  }, [eligible, maxBots]);

  const [statusBanner, setStatusBanner] = useState<string>(
    'Công viên Bồn nước & Phố đi bộ Hàng rong • Cư dân đang dạo phố nhộn nhịp'
  );
  const [radarReadout, setRadarReadout] = useState<string | null>(null);

  // Mobile orientation detection & auto-landscape support
  const [viewport, setViewport] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  });
  const [mobileLandscapeEnabled, setMobileLandscapeEnabled] = useState<boolean>(true);

  useEffect(() => {
    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobileDevice = viewport.w < 768 || (viewport.w < 920 && viewport.h < 520);
  const isMobilePortrait = viewport.w < 768 && viewport.h > viewport.w;
  const isForcedMobileLandscape = isMobilePortrait && mobileLandscapeEnabled;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgDimRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 0 });
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  // Build up to 100 representative citizen bots
  const buildRepresentativeCitizens = useCallback(
    (pool: Participant[], winnerId: string | null): CityCitizen[] => {
      const total = Math.max(1, pool.length);
      const scaleFactor = total > 80 ? 0.84 : total > 45 ? 0.9 : 0.98;

      return pool.map((p, idx) => {
        const seed = p.avatarSeed;
        const isTarget = p.id === winnerId;
        const startOnSouth = idx % 2 === 1;

        const baseX = 0.04 + ((idx + 0.5) / total) * 0.92;
        const jitterX = ((seed % 17) - 8) * 0.005;
        let x = Math.max(0.04, Math.min(0.96, baseX + jitterX));

        const yBand = (seed % 100) / 100;
        const y = startOnSouth
          ? SOUTH_SIDEWALK_MIN + yBand * (SOUTH_SIDEWALK_MAX - SOUTH_SIDEWALK_MIN - 0.03)
          : NORTH_SIDEWALK_MIN + yBand * (NORTH_SIDEWALK_MAX - NORTH_SIDEWALK_MIN);

        // Avoid spawning directly inside the North Water Fountain basin at start
        if (!startOnSouth) {
          const dx = (x - NORTH_FOUNTAIN.x) / NORTH_FOUNTAIN.rx;
          const dy = (y - NORTH_FOUNTAIN.y) / NORTH_FOUNTAIN.ry;
          if (dx * dx + dy * dy < 1.3) {
            x = x < NORTH_FOUNTAIN.x ? NORTH_FOUNTAIN.x - NORTH_FOUNTAIN.rx * 1.35 : NORTH_FOUNTAIN.x + NORTH_FOUNTAIN.rx * 1.35;
          }
        }

        const wantsToCross = !isTarget && (seed + idx) % 4 === 0;
        const wantsParkStroll = !isTarget && !wantsToCross && !startOnSouth && (seed + idx) % 3 === 0;
        const speedX = (seed % 2 === 0 ? 1 : -1) * (0.00042 + (seed % 6) * 0.000065);
        const targetY = wantsToCross
          ? startOnSouth
            ? NORTH_SIDEWALK_MIN + 0.045
            : SOUTH_SIDEWALK_MIN + 0.04
          : y;
        const speedY = wantsToCross ? (targetY > y ? 0.00062 : -0.00062) : ((seed % 3) - 1) * 0.00014;

        return {
          participant: p,
          x: isTarget ? Math.max(0.16, Math.min(0.84, x)) : x,
          y,
          vx: speedX,
          vy: speedY,
          targetY,
          facing: (speedX >= 0 ? 1 : -1) as 1 | -1,
          activity: wantsToCross ? 'crossing' : wantsParkStroll ? 'park_stroll' : 'walking',
          physicsState: 'normal',
          fallTimer: 0,
          fallDir: 1,
          slideVx: 0,
          hopY: 0,
          fountainTimer: 0,
          fountainStartX: x,
          fountainStartY: y,
          fountainTargetX: x,
          fountainTargetY: y,
          fountainExitX: x,
          fountainExitY: y,
          hitCooldown: (idx % 5) * 18,
          recoverSpeech: null,
          skinColor: SKIN_PALETTE[seed % SKIN_PALETTE.length],
          hairColor: HAIR_PALETTE[(seed >> 3) % HAIR_PALETTE.length],
          hairStyle: (seed >> 6) % 5,
          outfitColor: OUTFIT_PALETTE[(seed >> 8) % OUTFIT_PALETTE.length],
          pantsColor: PANTS_PALETTE[(seed >> 4) % PANTS_PALETTE.length],
          accessoryType: (seed >> 10) % 5,
          hasPrideAccent: (seed >> 5) % 3 === 0,
          heightScale: scaleFactor,
          animOffset: idx * 0.85,
          levitationProgress: 0,
          isTargetWinner: isTarget,
        };
      });
    },
    []
  );

  const buildInitialVehicles = useCallback((): StreetVehicle[] => {
    const types: StreetVehicle['type'][] = [
      'motorbike',
      'car',
      'motorbike',
      'taxi',
      'motorbike',
      'sports-car',
      'motorbike',
      'car',
    ];
    return types.map((type, i) => {
      const laneIndex = i % 4;
      const direction: 1 | -1 = laneIndex < 2 ? -1 : 1;
      const baseSpeed =
        type === 'sports-car'
          ? 0.0032
          : type === 'motorbike'
          ? 0.0025 + (i % 3) * 0.00032
          : 0.0021 + (i % 2) * 0.00028;
      return {
        id: i + 1,
        type,
        laneIndex,
        x: (i * 0.25) % 1.12,
        y: LANE_Y[laneIndex],
        speed: baseSpeed * direction,
        direction,
        color: type === 'taxi' ? '#FFD166' : CAR_COLORS[i % CAR_COLORS.length],
        riderColor: OUTFIT_PALETTE[(i + 3) % OUTFIT_PALETTE.length],
      };
    });
  }, []);

  const engineRef = useRef<{
    mode:
      | 'idle'
      | 'entering'
      | 'scanning'
      | 'locking'
      | 'abducting'
      | 'departing'
      | 'finished';
    citizens: CityCitizen[];
    vehicles: StreetVehicle[];
    splashes: WaterSplashParticle[];
    ripples: FountainRipple[];
    bumps: BumpEffect[];
    particles: BeamParticle[];
    sceneTime: number;
    ufoX: number;
    ufoY: number;
    ufoScale: number;
    ufoTilt: number;
    cityDimAlpha: number;
    scanAngle: number;
    beamIntensity: number;
    shockwaveRadius: number;
    cameraZoom: number;
    cameraFocusX: number;
    cameraFocusY: number;
    winner: Participant | null;
    targetX: number;
    targetY: number;
    lastHudUpdate: number;
    lastBonkSoundTime: number;
    lastSplashSoundTime: number;
  }>({
    mode: 'idle',
    citizens: [],
    vehicles: buildInitialVehicles(),
    splashes: [],
    ripples: [],
    bumps: [],
    particles: [],
    sceneTime: 0,
    ufoX: 0.5,
    ufoY: -0.25,
    ufoScale: 0.3,
    ufoTilt: 0,
    cityDimAlpha: 0,
    scanAngle: 0,
    beamIntensity: 0,
    shockwaveRadius: 0,
    cameraZoom: 1,
    cameraFocusX: 0.5,
    cameraFocusY: 0.65,
    winner: null,
    targetX: 0.5,
    targetY: 0.56,
    lastHudUpdate: 0,
    lastBonkSoundTime: 0,
    lastSplashSoundTime: 0,
  });

  useEffect(() => {
    if (engineRef.current.mode === 'idle') {
      engineRef.current.citizens = buildRepresentativeCitizens(representativePool, null);
      setRadarReadout(null);
      setStatusBanner(
        `Công viên Bồn nước & Phố Hàng rong • Hiển thị ${representativePool.length} bot đại diện / ${eligible.length} người`
      );
    }
  }, [representativePool, eligible.length, buildRepresentativeCitizens]);

  useEffect(() => {
    if (gameState === 'ready' || gameState === 'idle') {
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
      engineRef.current.mode = 'idle';
      engineRef.current.citizens = buildRepresentativeCitizens(representativePool, null);
      engineRef.current.ufoY = -0.25;
      engineRef.current.cityDimAlpha = 0;
      engineRef.current.beamIntensity = 0;
      engineRef.current.shockwaveRadius = 0;
      engineRef.current.cameraZoom = 1;
      engineRef.current.cameraFocusX = 0.5;
      engineRef.current.cameraFocusY = 0.65;
      setRadarReadout(null);
      setStatusBanner(
        `Công viên Bồn nước & Phố Hàng rong • Hiển thị ${representativePool.length} bot đại diện / ${eligible.length} người`
      );
    }
  }, [gameState, representativePool, eligible.length, buildRepresentativeCitizens]);

  useEffect(() => {
    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, []);

  /**
   * Pre-renders the entire static cityscape (Sky, Moon, 10 Far Towers, 6 North Buildings with Windows,
   * North Park Lawn, 4-Lane Road, Crosswalks, Trees, Streetlights, and South Pedestrian Street with
   * Festive Lanterns & 5 Street Food Carts) into an offscreen canvas so each 60fps frame only blits 1 image!
   */
  const renderStaticCityToCache = useCallback((w: number, h: number, dpr: number) => {
    if (!bgCanvasRef.current) {
      bgCanvasRef.current = document.createElement('canvas');
    }
    const bgCanvas = bgCanvasRef.current;
    bgCanvas.width = Math.round(w * dpr);
    bgCanvas.height = Math.round(h * dpr);
    bgDimRef.current = { w, h, dpr };

    const ctx = bgCanvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    const northSidewalkY = h * NORTH_SIDEWALK_MIN;
    const roadTopY = h * ROAD_MIN;
    const roadBotY = h * ROAD_MAX;
    const southSidewalkBotY = h * 0.955;

    // 1. Night Sky & Stars
    const skyGrad = ctx.createLinearGradient(0, 0, 0, northSidewalkY);
    skyGrad.addColorStop(0, '#040613');
    skyGrad.addColorStop(0.55, '#0F1538');
    skyGrad.addColorStop(1, '#211B52');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, northSidewalkY);

    for (let i = 0; i < 40; i++) {
      const sx = ((i * 137.5) % 100) * 0.01 * w;
      const sy = ((i * 73.1) % 32) * 0.01 * h;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(sx, sy, i % 4 === 0 ? 1.8 : 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Moon with soft radial glow
    const moonX = w * 0.9;
    const moonY = h * 0.095;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 6, moonX, moonY, 42);
    moonGlow.addColorStop(0, 'rgba(255, 243, 176, 0.95)');
    moonGlow.addColorStop(0.45, 'rgba(255, 209, 102, 0.28)');
    moonGlow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFF3B0';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 15, 0, Math.PI * 2);
    ctx.fill();

    // 2. Distant Silhouette + Illuminated High-Rise Skyscrapers (Tòa nhà cao tầng phía sau & hai bên)
    const farSilhouettes = [
      { x: 0.005, w: 0.055, h: 0.41 },
      { x: 0.12, w: 0.06, h: 0.43 },
      { x: 0.28, w: 0.065, h: 0.44 },
      { x: 0.43, w: 0.055, h: 0.39 },
      { x: 0.52, w: 0.055, h: 0.38 },
      { x: 0.69, w: 0.065, h: 0.43 },
      { x: 0.84, w: 0.06, h: 0.42 },
      { x: 0.94, w: 0.055, h: 0.4 },
    ];
    ctx.fillStyle = '#0A0F24';
    farSilhouettes.forEach((b) => {
      ctx.fillRect(b.x * w, northSidewalkY - b.h * h, b.w * w, b.h * h);
    });

    // Mid-ground Illuminated High-Rise Skyscrapers with Lit Windows & Neon Rooftop Signs
    const highRiseTowers = [
      {
        x: 0.01,
        w: 0.11,
        h: 0.35,
        color: '#161F42',
        roofSign: 'LUCKY TOWER',
        signColor: '#38DDF8',
        shopName: 'STAR CAFE ☕',
        hasStreetShop: true,
      },
      {
        x: 0.16,
        w: 0.095,
        h: 0.39,
        color: '#192248',
        roofSign: 'CYBER PLAZA',
        signColor: '#FF6B8A',
        hasStreetShop: false,
      },
      {
        x: 0.31,
        w: 0.085,
        h: 0.36,
        color: '#151D3D',
        roofSign: 'SKY TOWER',
        signColor: '#FFD166',
        hasStreetShop: false,
      },
      {
        x: 0.605,
        w: 0.085,
        h: 0.37,
        color: '#172042',
        roofSign: 'METRO HUB',
        signColor: '#55E6A5',
        hasStreetShop: false,
      },
      {
        x: 0.745,
        w: 0.095,
        h: 0.38,
        color: '#1B234B',
        roofSign: 'NEO HOTEL',
        signColor: '#8B5CF6',
        hasStreetShop: false,
      },
      {
        x: 0.88,
        w: 0.11,
        h: 0.34,
        color: '#1E274E',
        roofSign: 'PRIDE PLAZA',
        signColor: '#FF6B8A',
        shopName: 'ARCADE 24/7 🎮',
        hasStreetShop: true,
      },
    ];

    highRiseTowers.forEach((b, bIdx) => {
      const bx = b.x * w;
      const bw = b.w * w;
      const bh = b.h * h;
      const by = northSidewalkY - bh;

      ctx.fillStyle = b.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      // Rooftop spire / antenna
      ctx.strokeStyle = b.signColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(bx + bw * 0.5, by - 16);
      ctx.lineTo(bx + bw * 0.5, by - 26);
      ctx.stroke();
      ctx.fillStyle = b.signColor;
      ctx.beginPath();
      ctx.arc(bx + bw * 0.5, by - 27, 2, 0, Math.PI * 2);
      ctx.fill();

      // Lit Skyscraper Windows
      const cols = Math.max(2, Math.floor(bw / 20));
      const rows = Math.max(3, Math.floor((bh - 30) / 17));
      const padX = (bw - cols * 10) / (cols + 1);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = bx + padX + c * (10 + padX);
          const wy = by + 10 + r * 16;
          const isLit = (bIdx * 7 + r * 3 + c) % 3 !== 0;
          ctx.fillStyle = isLit
            ? (r + c + bIdx) % 4 === 0
              ? 'rgba(56, 221, 248, 0.72)'
              : 'rgba(255, 209, 102, 0.75)'
            : 'rgba(10, 13, 28, 0.68)';
          ctx.fillRect(wx, wy, 9, 10);
        }
      }

      // Neon Rooftop Signboard
      if (b.roofSign && w > 480) {
        ctx.fillStyle = '#0A0D1C';
        ctx.strokeStyle = b.signColor;
        ctx.lineWidth = 1.4;
        ctx.fillRect(bx + bw * 0.08, by - 15, bw * 0.84, 12.5);
        ctx.strokeRect(bx + bw * 0.08, by - 15, bw * 0.84, 12.5);
        ctx.fillStyle = b.signColor;
        ctx.font = '800 7.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.roofSign, bx + bw * 0.5, by - 8.5);
      }

      // Street-level Shopfront on Far-Left & Far-Right High-Rise Towers
      if (b.hasStreetShop && b.shopName && w > 420) {
        const shopH = 24;
        const shopY = northSidewalkY - shopH;
        ctx.fillStyle = '#0F152B';
        ctx.fillRect(bx + 3, shopY, bw - 6, shopH);
        ctx.fillStyle = b.signColor;
        ctx.fillRect(bx + 2, shopY - 4, bw - 4, 6);
        ctx.font = '800 7.8px "Be Vietnam Pro", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0A0D1C';
        ctx.fillText(b.shopName, bx + bw / 2, shopY - 1);
      }
    });

    // 3. Iconic Landmark Models in the Foreground (Left-Center: TRƯỜNG CAO ĐẲNG TÂY ĐÔ | Center: FOUNTAIN PARK | Right-Center: BẾN XE TRUNG TÂM TP CẦN THƠ)

    // ==================== LANDMARK A (x = 0.13 .. 0.395): TRƯỜNG CAO ĐẲNG TÂY ĐÔ ====================
    {
      const tcX = w * 0.13;
      const tcW = w * 0.265;
      const tcH = h * 0.26;
      const tcY = northSidewalkY - tcH;

      // Dark Charcoal Outer Architectural Frame & Right Glass Tower
      ctx.fillStyle = '#27303F';
      ctx.fillRect(tcX, tcY, tcW, tcH);

      // Left & Right White Multi-Story Academic Wings (4 floors)
      const wingW = tcW * 0.84;
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(tcX + tcW * 0.02, tcY + tcH * 0.06, wingW, tcH * 0.94);

      // Right-hand Vertical Blue Curtain-Wall Glass Tower (as seen in reference photo)
      const rightTowerX = tcX + tcW * 0.85;
      const rightTowerW = tcW * 0.13;
      const glassGrad = ctx.createLinearGradient(rightTowerX, tcY, rightTowerX + rightTowerW, tcY + tcH);
      glassGrad.addColorStop(0, '#38BDF8');
      glassGrad.addColorStop(0.5, '#0284C7');
      glassGrad.addColorStop(1, '#1E3A8A');
      ctx.fillStyle = glassGrad;
      ctx.fillRect(rightTowerX, tcY + tcH * 0.08, rightTowerW, tcH * 0.88);
      // Window mullions on right glass tower
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      for (let r = 1; r < 5; r++) {
        const ry = tcY + tcH * (0.08 + r * 0.17);
        ctx.beginPath();
        ctx.moveTo(rightTowerX, ry);
        ctx.lineTo(rightTowerX + rightTowerW, ry);
        ctx.stroke();
      }

      // 4 Floors of Academic Windows & Horizontal White Spandrel Bands on Left/Right Wings
      const floorCount = 4;
      const floorH = (tcH * 0.72) / floorCount;
      for (let f = 0; f < floorCount; f++) {
        const fy = tcY + tcH * 0.1 + f * floorH;
        // Continuous window strip
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(tcX + tcW * 0.035, fy + 2, wingW - tcW * 0.03, floorH * 0.62);

        // Vertical window dividers & warm/cool lit panes
        const paneCols = Math.max(8, Math.floor(wingW / 16));
        const paneW = (wingW - tcW * 0.03) / paneCols;
        for (let c = 0; c < paneCols; c++) {
          const px = tcX + tcW * 0.035 + c * paneW;
          if ((f + c) % 3 === 0) {
            ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
            ctx.fillRect(px + 1, fy + 2, paneW - 2, floorH * 0.62);
          }
          ctx.fillStyle = '#E2E8F0';
          ctx.fillRect(px, fy + 2, 2, floorH * 0.62);
        }

        // Dark balcony railing line
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(tcX + tcW * 0.035, fy + floorH * 0.54, wingW - tcW * 0.03, 1.5);
      }

      // Central Prominent Vertical-Louvered Blue Facade Block
      const centerW = tcW * 0.34;
      const centerX = tcX + tcW * 0.31;
      const centerY = tcY - tcH * 0.06;
      const centerH = tcH * 1.06;

      ctx.fillStyle = '#1E293B';
      ctx.fillRect(centerX, centerY, centerW, centerH);

      // Blue reflective glass inside central block
      const centerGlass = ctx.createLinearGradient(centerX, centerY, centerX, centerY + centerH);
      centerGlass.addColorStop(0, '#0284C7');
      centerGlass.addColorStop(1, '#1E3A8A');
      ctx.fillStyle = centerGlass;
      ctx.fillRect(centerX + 4, centerY + 22, centerW - 8, centerH - 22);

      // Vertical dark-blue architectural fins (louvers) on central block
      const finCount = 8;
      for (let i = 0; i <= finCount; i++) {
        const fx = centerX + 4 + (i / finCount) * (centerW - 8);
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(fx - 1, centerY + 22, 2.2, centerH - 46);
      }

      // Royal Blue Top Signboard Banner: "TRƯỜNG CAO ĐẲNG TÂY ĐÔ"
      const bannerH = Math.max(18, tcH * 0.16);
      ctx.fillStyle = '#1D4ED8';
      ctx.strokeStyle = '#60A5FA';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(centerX - 4, centerY + 4, centerW + 8, bannerH, 3);
      ctx.fill();
      ctx.stroke();

      // Signboard Text: "TRƯỜNG CAO ĐẲNG TÂY ĐÔ"
      ctx.fillStyle = '#FFFFFF';
      const tcFontSize = Math.max(7, Math.min(11, centerW * 0.068));
      ctx.font = `800 ${tcFontSize}px "Be Vietnam Pro", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TRƯỜNG CAO ĐẲNG TÂY ĐÔ', centerX + centerW / 2, centerY + 4 + bannerH / 2);

      // Ground-Floor Wide Dark-Slate Entrance Canopy & Pillars
      const porchY = northSidewalkY - 26;
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(centerX - 10, porchY, centerW + 20, 6, 2);
      ctx.fill();
      // Canopy pillars
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(centerX - 4, porchY + 6, 5, 20);
      ctx.fillRect(centerX + centerW - 1, porchY + 6, 5, 20);
      // Front entrance steps
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(centerX - 6, northSidewalkY - 4, centerW + 12, 4);

      // Left-Side Dark Granite Monument Wall Sign ("TRƯỜNG CAO ĐẲNG TÂY ĐÔ")
      if (w > 520) {
        const monX = tcX + 4;
        const monY = northSidewalkY - 22;
        const monW = Math.min(88, tcW * 0.23);
        const monH = 18;
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(monX, monY, monW, monH, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 6px "Be Vietnam Pro", sans-serif';
        ctx.fillText('TRƯỜNG CAO ĐẲNG TÂY ĐÔ', monX + monW / 2, monY + monH / 2);
      }
    }

    // ==================== LANDMARK B (x = 0.605 .. 0.87): BẾN XE TRUNG TÂM TP CẦN THƠ ====================
    {
      const bxX = w * 0.605;
      const bxW = w * 0.265;
      const bxH = h * 0.21;
      const bxY = northSidewalkY - bxH;

      // Main Blue Reflective Glass Terminal Building
      const termGrad = ctx.createLinearGradient(bxX, bxY, bxX, northSidewalkY);
      termGrad.addColorStop(0, '#0284C7');
      termGrad.addColorStop(0.55, '#0369A1');
      termGrad.addColorStop(1, '#1E3A8A');
      ctx.fillStyle = termGrad;
      ctx.fillRect(bxX, bxY, bxW, bxH);

      // White Horizontal Fascia Roof Band
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(bxX - 2, bxY - 5, bxW + 4, 7);

      // Glass Curtain-Wall Grid Lines (White/Cyan Mullions)
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
      ctx.lineWidth = 1;
      const gridCols = 14;
      for (let c = 1; c < gridCols; c++) {
        const gx = bxX + (c / gridCols) * bxW;
        ctx.beginPath();
        ctx.moveTo(gx, bxY + 2);
        ctx.lineTo(gx, northSidewalkY);
        ctx.stroke();
      }
      for (let r = 1; r <= 3; r++) {
        const gy = bxY + (r / 4) * bxH;
        ctx.beginPath();
        ctx.moveTo(bxX, gy);
        ctx.lineTo(bxX + bxW, gy);
        ctx.stroke();
      }

      // Curved White Side Drop-Off Canopies (Left & Right Wings)
      [bxX + bxW * 0.02, bxX + bxW * 0.72].forEach((sideX) => {
        const sideW = bxW * 0.26;
        const sideY = northSidewalkY - bxH * 0.48;
        ctx.fillStyle = '#E2E8F0';
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(sideX, sideY, sideW, 7, 4);
        ctx.fill();
        ctx.stroke();

        // V-shaped support struts for side canopy
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 2;
        [sideX + sideW * 0.25, sideX + sideW * 0.75].forEach((px) => {
          ctx.beginPath();
          ctx.moveTo(px, northSidewalkY);
          ctx.lineTo(px, sideY + 7);
          ctx.moveTo(px - 6, sideY + 7);
          ctx.lineTo(px, sideY + 14);
          ctx.lineTo(px + 6, sideY + 7);
          ctx.stroke();
        });
      });

      // Grand Cantilevered Space-Frame Canopy Roof (Over Center of Terminal)
      const canopyW = bxW * 0.68;
      const canopyX = bxX + (bxW - canopyW) / 2;
      const canopyTopY = bxY - bxH * 0.34;
      const canopyBotY = bxY + bxH * 0.14;

      // Slanted translucent glass space-frame roof trapezoid
      const roofGrad = ctx.createLinearGradient(canopyX, canopyTopY, canopyX, canopyBotY);
      roofGrad.addColorStop(0, 'rgba(224, 242, 254, 0.92)');
      roofGrad.addColorStop(0.5, 'rgba(148, 163, 184, 0.85)');
      roofGrad.addColorStop(1, 'rgba(71, 85, 105, 0.9)');
      ctx.fillStyle = roofGrad;
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canopyX - 10, canopyTopY);
      ctx.lineTo(canopyX + canopyW + 10, canopyTopY);
      ctx.lineTo(canopyX + canopyW - 14, canopyBotY);
      ctx.lineTo(canopyX + 14, canopyBotY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Space-frame rafters & warm ceiling spotlights under the grand canopy
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
      ctx.lineWidth = 1.4;
      for (let i = 1; i <= 5; i++) {
        const rxTop = canopyX - 10 + (i / 6) * (canopyW + 20);
        const rxBot = canopyX + 14 + (i / 6) * (canopyW - 28);
        ctx.beginPath();
        ctx.moveTo(rxTop, canopyTopY);
        ctx.lineTo(rxBot, canopyBotY);
        ctx.stroke();

        // Warm spotlight dot
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc((rxTop + rxBot) / 2, (canopyTopY + canopyBotY) / 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Two Iconic White Branching Tree Columns (Cột chữ V phân nhánh) supporting the Grand Canopy!
      [canopyX + canopyW * 0.24, canopyX + canopyW * 0.76].forEach((colX) => {
        const trunkTopY = bxY + bxH * 0.22;
        // Main white vertical column trunk
        ctx.fillStyle = '#F1F5F9';
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.2;
        ctx.fillRect(colX - 4, trunkTopY, 8, northSidewalkY - trunkTopY);
        ctx.strokeRect(colX - 4, trunkTopY, 8, northSidewalkY - trunkTopY);

        // 4 V-shaped Diagonal Branching Struts reaching up to the Space-Frame Canopy
        ctx.strokeStyle = '#F8FAFC';
        ctx.lineWidth = 2.6;
        [-28, -11, 11, 28].forEach((offsetX) => {
          ctx.beginPath();
          ctx.moveTo(colX, trunkTopY + 2);
          ctx.lineTo(colX + offsetX, canopyTopY + 6);
          ctx.stroke();
        });
      });

      // Bold 3D Blue Signboard across the Top Edge of the Grand Canopy: "BẾN XE TRUNG TÂM TP CẦN THƠ"
      const signH = Math.max(16, bxH * 0.17);
      const signY = canopyTopY - signH + 2;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(canopyX - 8, signY, canopyW + 16, signH, 4);
      ctx.fill();
      ctx.stroke();

      const bxFontSize = Math.max(6.8, Math.min(10.5, canopyW * 0.045));
      ctx.font = `800 ${bxFontSize}px "Be Vietnam Pro", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(
        'BẾN XE TRUNG TÂM TP CẦN THƠ',
        canopyX + canopyW / 2,
        signY + signH / 2
      );
    }

    // 4. North Park Plaza Archway & Trees (at x = 0.39..0.61)
    const parkLeft = w * 0.39;
    const parkRight = w * 0.61;
    const parkWidth = parkRight - parkLeft;
    for (let tx = parkLeft + 14; tx <= parkRight - 14; tx += 26) {
      ctx.fillStyle = '#064E3B';
      ctx.beginPath();
      ctx.arc(tx, northSidewalkY - 20, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(tx, northSidewalkY - 24, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    if (w > 420) {
      ctx.fillStyle = '#0A0D1C';
      ctx.strokeStyle = '#55E6A5';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(w * 0.42, northSidewalkY - 37, w * 0.16, 15, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#55E6A5';
      ctx.font = '800 8.5px "Be Vietnam Pro", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⛲ CÔNG VIÊN BỒN NƯỚC', w * 0.5, northSidewalkY - 27);
    }

    // 5. North Sidewalk & North Fountain Park Lawn
    const nSidewalkGrad = ctx.createLinearGradient(0, northSidewalkY, 0, roadTopY);
    nSidewalkGrad.addColorStop(0, '#2B365A');
    nSidewalkGrad.addColorStop(1, '#1E2642');
    ctx.fillStyle = nSidewalkGrad;
    ctx.fillRect(0, northSidewalkY, w, roadTopY - northSidewalkY);

    ctx.fillStyle = '#065F46';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(parkLeft, northSidewalkY + 4, parkWidth, roadTopY - northSidewalkY - 9, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.fillRect(0, roadTopY - 3, w, 3);

    // Ornamental Trees & Streetlights along North Promenade
    [0.09, 0.23, 0.36, 0.64, 0.77, 0.91].forEach((lp, idx) => {
      const lx = lp * w;
      const tx = lx - 18;
      ctx.fillStyle = '#4B2E1E';
      ctx.fillRect(tx - 2, northSidewalkY - 18, 4, 20);
      ctx.fillStyle = idx % 2 === 0 ? '#10B981' : '#059669';
      ctx.beginPath();
      ctx.arc(tx, northSidewalkY - 23, 10, 0, Math.PI * 2);
      ctx.arc(tx - 6, northSidewalkY - 19, 8, 0, Math.PI * 2);
      ctx.arc(tx + 6, northSidewalkY - 19, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, northSidewalkY + 3);
      ctx.lineTo(lx, northSidewalkY - 38);
      ctx.lineTo(lx + 8, northSidewalkY - 38);
      ctx.stroke();

      ctx.fillStyle = '#FFD166';
      ctx.beginPath();
      ctx.arc(lx + 8, northSidewalkY - 36, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6. Central 4-Lane Road & 3 Zebra Crosswalks
    ctx.fillStyle = '#0B0F22';
    ctx.fillRect(0, roadTopY, w, roadBotY - roadTopY);

    const roadMidY = (roadTopY + roadBotY) / 2;
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(0, roadMidY - 2, w, 1.5);
    ctx.fillRect(0, roadMidY + 1, w, 1.5);

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.setLineDash([18, 16]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, (roadTopY + roadMidY) / 2);
    ctx.lineTo(w, (roadTopY + roadMidY) / 2);
    ctx.moveTo(0, (roadMidY + roadBotY) / 2);
    ctx.lineTo(w, (roadMidY + roadBotY) / 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    [w * 0.22, w * 0.5, w * 0.78].forEach((cwX) => {
      for (let s = 0; s < 6; s++) {
        ctx.fillRect(cwX - 13, roadTopY + 4 + s * ((roadBotY - roadTopY - 8) / 6), 26, 5);
      }
    });

    // 7. South Sidewalk: Warm Brick-Paved Pedestrian Street ("Phố đi bộ xe hàng rong")
    const sSidewalkGrad = ctx.createLinearGradient(0, roadBotY, 0, h);
    sSidewalkGrad.addColorStop(0, '#2A2444');
    sSidewalkGrad.addColorStop(0.7, '#1F1B36');
    sSidewalkGrad.addColorStop(1, '#141126');
    ctx.fillStyle = sSidewalkGrad;
    ctx.fillRect(0, roadBotY, w, h - roadBotY);

    // Decorative pedestrian paving tile lines
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.08)';
    ctx.lineWidth = 1;
    for (let px = 0; px < w; px += 36) {
      ctx.beginPath();
      ctx.moveTo(px, roadBotY);
      ctx.lineTo(px - 18, southSidewalkBotY);
      ctx.stroke();
    }
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(0, roadBotY, w, 3);

    // Festive Overhead Lantern String Lights along the South Pedestrian Promenade
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, roadBotY + 8);
    for (let lx = 0; lx <= w; lx += w / 6) {
      ctx.quadraticCurveTo(lx - w / 12, roadBotY + 18, lx, roadBotY + 8);
    }
    ctx.stroke();

    const lanternColors = ['#FFD166', '#FF6B8A', '#38DDF8', '#55E6A5'];
    for (let lx = 24; lx < w - 20; lx += 38) {
      ctx.fillStyle = lanternColors[Math.floor(lx / 38) % lanternColors.length];
      ctx.beginPath();
      ctx.arc(lx, roadBotY + 12, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw the 5 Colorful Street Food Carts ("Xe Hàng Rong") along the bottom of the Pedestrian Street
    STREET_FOOD_CARTS.forEach((cart) => {
      const cx = cart.x * w;
      const cy = cart.y * h;
      const cw = Math.min(115, Math.max(66, w * 0.095));
      const ch = 22;

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 12, cw * 0.54, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Support poles
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - cw * 0.42, cy);
      ctx.lineTo(cx - cw * 0.42, cy - 22);
      ctx.moveTo(cx + cw * 0.42, cy);
      ctx.lineTo(cx + cw * 0.42, cy - 22);
      ctx.stroke();

      // Warm hanging bulb under awning
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(cx, cy - 17, 3, 0, Math.PI * 2);
      ctx.fill();

      // Counter display glass & snacks
      ctx.fillStyle = 'rgba(224, 242, 254, 0.35)';
      ctx.fillRect(cx - cw * 0.4, cy - 10, cw * 0.8, 10);
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(cx - 10, cy - 4, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#FB7185';
      ctx.arc(cx + 2, cy - 4, 3, 0, Math.PI * 2);
      ctx.fill();

      // Cart Wooden/Metal Lower Body
      ctx.fillStyle = cart.bodyColor;
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(cx - cw * 0.46, cy - 2, cw * 0.92, ch - 8, 4);
      ctx.fill();
      ctx.stroke();

      // Striped Canopy Awning
      const stripes = 6;
      const sw = (cw * 1.04) / stripes;
      const startAx = cx - cw * 0.52;
      for (let s = 0; s < stripes; s++) {
        ctx.fillStyle = s % 2 === 0 ? cart.awningColor1 : cart.awningColor2;
        ctx.beginPath();
        ctx.roundRect(startAx + s * sw, cy - 27, sw + 0.5, 8, 2);
        ctx.fill();
      }

      // Cart Name Signboard
      if (w > 440) {
        ctx.fillStyle = '#0A0D1C';
        ctx.strokeStyle = cart.awningColor1;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(cx - cw * 0.44, cy + 1, cw * 0.88, 11, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 7.5px "Be Vietnam Pro", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cart.name, cx, cy + 6.5);
      }

      // Spoked Street-Cart Wheels
      [-cw * 0.34, cw * 0.34].forEach((wx) => {
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(cx + wx, cy + 12, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    });

    ctx.restore();
  }, []);

  useEffect(() => {
    let rafId = 0;
    let isMounted = true;

    const triggerFountainSplash = (fx: number, fy: number, now: number) => {
      const st = engineRef.current;
      st.ripples.push({
        x: fx,
        y: fy,
        rx: 0.006,
        ry: 0.004,
        maxRx: 0.044,
        life: 0,
        maxLife: 32,
      });

      const dropletCount = reducedMotion ? 6 : 12;
      for (let i = 0; i < dropletCount; i++) {
        const angle = -Math.PI * (0.15 + 0.7 * (i / dropletCount)) + (Math.random() - 0.5) * 0.2;
        const speed = 0.0018 + Math.random() * 0.0024;
        st.splashes.push({
          x: fx + (Math.random() - 0.5) * 0.014,
          y: fy,
          vx: Math.cos(angle) * speed * 0.7,
          vy: Math.sin(angle) * speed * 1.4,
          radius: 2 + Math.random() * 2,
          color: i % 2 === 0 ? '#38DDF8' : '#E0F2FE',
          life: 0,
          maxLife: 22 + Math.floor(Math.random() * 8),
        });
      }

      st.bumps.push({
        x: fx,
        y: fy - 0.02,
        text: 'TÙM! 💦',
        color: '#38DDF8',
        life: 0,
        maxLife: 30,
      });

      if (now - st.lastSplashSoundTime > 260) {
        st.lastSplashSoundTime = now;
        audioService.playWaterSplash();
      }
    };

    const sendCitizenIntoFountain = (c: CityCitizen, fountain: FountainSpec) => {
      c.physicsState = 'in_fountain';
      c.fountainTimer = 96;
      c.fountainStartX = c.x;
      c.fountainStartY = c.y;
      const angleInBasin = ((c.participant.avatarSeed % 12) / 12) * Math.PI * 2;
      c.fountainTargetX = fountain.x + Math.cos(angleInBasin) * (fountain.rx * 0.42);
      c.fountainTargetY = fountain.y + Math.sin(angleInBasin) * (fountain.ry * 0.38);
      const exitDir = c.fountainStartX < fountain.x ? -1 : 1;
      c.fountainExitX = Math.max(0.05, Math.min(0.95, fountain.x + exitDir * (fountain.rx * 1.42)));
      c.fountainExitY = fountain.y + ((c.participant.avatarSeed % 3) - 1) * 0.014;
    };

    const renderLoop = (now: number) => {
      if (!isMounted) return;
      const st = engineRef.current;
      st.sceneTime += 0.032;

      // ==================== 1. UPDATE TRAFFIC VEHICLES ====================
      if (!reducedMotion) {
        st.vehicles.forEach((v) => {
          v.x += v.speed;
          if (v.direction === 1 && v.x > 1.12) {
            v.x = -0.12;
            v.color =
              v.type === 'taxi'
                ? '#FFD166'
                : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
          } else if (v.direction === -1 && v.x < -0.12) {
            v.x = 1.12;
            v.color =
              v.type === 'taxi'
                ? '#FFD166'
                : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
          }
        });
      }

      // ==================== 2. UPDATE CITIZENS (MAX 100 REPRESENTATIVE BOTS) ====================
      st.citizens.forEach((c) => {
        if (c.hitCooldown > 0) c.hitCooldown--;

        if (
          c.isTargetWinner &&
          (st.mode === 'locking' || st.mode === 'abducting' || st.mode === 'departing')
        ) {
          c.physicsState = 'abducting';
          c.fallTimer = 0;
          c.fountainTimer = 0;
          c.hopY = 0;
          c.recoverSpeech = null;
          return;
        }

        // ---- STATE A: Citizen fell into the North Park Water Fountain ("hiệu ứng té vào bồn nước") ----
        if (c.physicsState === 'in_fountain') {
          if (c.fountainTimer > 80) {
            const diveProg = (96 - c.fountainTimer) / 16;
            c.x = c.fountainStartX + (c.fountainTargetX - c.fountainStartX) * diveProg;
            c.y = c.fountainStartY + (c.fountainTargetY - c.fountainStartY) * diveProg;
            c.hopY = Math.sin(diveProg * Math.PI) * 19;

            if (c.fountainTimer === 81) {
              triggerFountainSplash(c.fountainTargetX, c.fountainTargetY, now);
            }
          } else if (c.fountainTimer > 16) {
            c.x = c.fountainTargetX + Math.sin(st.sceneTime * 12 + c.animOffset) * 0.0018;
            c.y = c.fountainTargetY;
            c.hopY = Math.sin(st.sceneTime * 16 + c.animOffset) * 2.5;

            if (!reducedMotion && c.fountainTimer % 20 === 0) {
              st.splashes.push({
                x: c.x,
                y: c.y - 0.01,
                vx: (Math.random() - 0.5) * 0.0015,
                vy: -0.002,
                radius: 2,
                color: '#E0F2FE',
                life: 0,
                maxLife: 15,
              });
            }
          } else {
            const exitProg = (16 - c.fountainTimer) / 16;
            c.x = c.fountainTargetX + (c.fountainExitX - c.fountainTargetX) * exitProg;
            c.y = c.fountainTargetY + (c.fountainExitY - c.fountainTargetY) * exitProg;
            c.hopY = Math.sin(exitProg * Math.PI) * 15;
          }

          c.fountainTimer--;
          if (c.fountainTimer <= 0) {
            c.physicsState = 'normal';
            c.hopY = 0;
            c.hitCooldown = 190;
            c.vx = (c.fountainExitX < 0.5 ? -1 : 1) * Math.abs(c.vx || 0.00045);
            c.facing = c.vx >= 0 ? 1 : -1;
            c.recoverSpeech =
              FOUNTAIN_RECOVER_WORDS[c.participant.avatarSeed % FOUNTAIN_RECOVER_WORDS.length];
            window.setTimeout(() => {
              c.recoverSpeech = null;
            }, 1200);
          }
          return;
        }

        // ---- STATE B: Citizen was bumped on the road: fall down on the spot, then stand back up ----
        if (c.physicsState === 'fallen') {
          c.x = Math.max(0.03, Math.min(0.97, c.x + c.slideVx));
          c.slideVx *= 0.82;

          if (c.fallTimer > 42) {
            const hopProg = (56 - c.fallTimer) / 14;
            c.hopY = Math.sin(hopProg * Math.PI) * 10;
          } else {
            c.hopY = 0;
          }

          c.fallTimer--;
          if (c.fallTimer <= 0) {
            c.physicsState = 'normal';
            c.hitCooldown = 140;
            c.recoverSpeech = RECOVER_WORDS[c.participant.avatarSeed % RECOVER_WORDS.length];
            window.setTimeout(() => {
              c.recoverSpeech = null;
            }, 1000);
          }
          return;
        }

        // ---- STATE C: Normal 2D movement across North Park, Road & South Street Food Promenade ----
        if (!reducedMotion) {
          c.x += c.vx;
          c.y += c.vy;

          if (c.vx > 0) c.facing = 1;
          else if (c.vx < 0) c.facing = -1;

          if (c.x < 0.03) {
            c.x = 0.03;
            c.vx = Math.abs(c.vx);
          } else if (c.x > 0.97) {
            c.x = 0.97;
            c.vx = -Math.abs(c.vx);
          }

          if (c.activity === 'crossing') {
            if (Math.abs(c.y - c.targetY) < 0.015) {
              c.y = c.targetY;
              c.activity = Math.random() < 0.45 ? 'park_stroll' : 'walking';
              c.vy = (Math.random() - 0.5) * 0.00018;
            }
          } else {
            const onNorth = c.y < (ROAD_MIN + ROAD_MAX) / 2;
            if (onNorth) {
              if (c.y < NORTH_SIDEWALK_MIN) {
                c.y = NORTH_SIDEWALK_MIN;
                c.vy = Math.abs(c.vy);
              } else if (c.y > NORTH_SIDEWALK_MAX) {
                c.y = NORTH_SIDEWALK_MAX;
                c.vy = -Math.abs(c.vy);
              }
              if (c.activity === 'park_stroll' && Math.abs(c.x - 0.5) > 0.07) {
                c.vx = (0.5 > c.x ? 1 : -1) * Math.abs(c.vx);
              }
            } else {
              if (c.y < SOUTH_SIDEWALK_MIN) {
                c.y = SOUTH_SIDEWALK_MIN;
                c.vy = Math.abs(c.vy);
              } else if (c.y > SOUTH_SIDEWALK_MAX - 0.025) {
                c.y = SOUTH_SIDEWALK_MAX - 0.025;
                c.vy = -Math.abs(c.vy);
              }
            }

            const canCross = !(c.isTargetWinner && st.mode !== 'idle');
            if (canCross && Math.random() < 0.0028) {
              c.activity = 'crossing';
              c.targetY = onNorth
                ? SOUTH_SIDEWALK_MIN + Math.random() * 0.07
                : NORTH_SIDEWALK_MIN + Math.random() * 0.08;
              c.vy = c.targetY > c.y ? 0.0007 : -0.0007;
            }
          }

          const isProtectedTarget = c.isTargetWinner && st.mode !== 'idle';

          // 1) Check if citizen walks into / trips on the rim of the North Park Water Fountain
          if (!isProtectedTarget && c.hitCooldown <= 0 && c.y < ROAD_MIN) {
            const dx = (c.x - NORTH_FOUNTAIN.x) / NORTH_FOUNTAIN.rx;
            const dy = (c.y - NORTH_FOUNTAIN.y) / NORTH_FOUNTAIN.ry;
            const distSq = dx * dx + dy * dy;
            if (distSq <= 1.18) {
              if (Math.random() < 0.45 || distSq <= 0.92) {
                sendCitizenIntoFountain(c, NORTH_FOUNTAIN);
              } else {
                c.vx = (c.x < NORTH_FOUNTAIN.x ? -1 : 1) * Math.abs(c.vx);
                c.hitCooldown = 35;
              }
            }
          }

          // 2) Check collision with passing Motorbikes & Cars when crossing the road
          if (
            !isProtectedTarget &&
            c.physicsState === 'normal' &&
            c.hitCooldown <= 0 &&
            c.y >= ROAD_MIN - 0.005 &&
            c.y <= ROAD_MAX + 0.005
          ) {
            for (const v of st.vehicles) {
              const hitRadiusX = v.type === 'motorbike' ? 0.021 : 0.034;
              const hitRadiusY = 0.022;
              if (Math.abs(c.x - v.x) < hitRadiusX && Math.abs(c.y - v.y) < hitRadiusY) {
                const nearNorthFountain =
                  Math.abs(c.x - NORTH_FOUNTAIN.x) < 0.095 &&
                  Math.abs(c.y - NORTH_FOUNTAIN.y) < 0.14;

                if (nearNorthFountain) {
                  sendCitizenIntoFountain(c, NORTH_FOUNTAIN);
                } else {
                  c.physicsState = 'fallen';
                  c.fallTimer = 56;
                  c.fallDir = v.direction;
                  c.slideVx = v.direction * 0.0045;
                  c.hopY = 4;

                  st.bumps.push({
                    x: c.x,
                    y: c.y,
                    text: 'BỐP!',
                    color: '#FFD166',
                    life: 0,
                    maxLife: 24,
                  });

                  if (now - st.lastBonkSoundTime > 220) {
                    st.lastBonkSoundTime = now;
                    audioService.playWallBounce();
                  }
                }
                break;
              }
            }
          }
        }
      });

      // Live HUD update during scanning mode
      if (st.mode === 'scanning' && now - st.lastHudUpdate > 150 && st.citizens.length > 0) {
        st.lastHudUpdate = now;
        let closest = st.citizens[0];
        let minDist = 999;
        for (const c of st.citizens) {
          const d = Math.abs(c.x - st.ufoX);
          if (d < minDist) {
            minDist = d;
            closest = c;
          }
        }
        setRadarReadout(`ĐANG QUÉT: #${closest.participant.displayCode} ${closest.participant.name}`);
      }

      // ==================== 3. RENDER SCENE WITH CACHED STATIC LAYER ====================
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;

          if (w > 0 && h > 0) {
            const targetW = Math.round(w * dpr);
            const targetH = Math.round(h * dpr);
            if (canvas.width !== targetW || canvas.height !== targetH) {
              canvas.width = targetW;
              canvas.height = targetH;
            }

            if (
              bgDimRef.current.w !== w ||
              bgDimRef.current.h !== h ||
              bgDimRef.current.dpr !== dpr ||
              !bgCanvasRef.current
            ) {
              renderStaticCityToCache(w, h, dpr);
            }

            ctx.save();
            ctx.scale(dpr, dpr);

            const t = st.sceneTime;

            if (st.cameraZoom > 1.001) {
              const focusPxX = st.cameraFocusX * w;
              const focusPxY = st.cameraFocusY * h;
              ctx.translate(focusPxX, focusPxY);
              ctx.scale(st.cameraZoom, st.cameraZoom);
              ctx.translate(-focusPxX, -focusPxY);
            }

            // Blit pre-rendered static background in 1 drawImage call!
            if (bgCanvasRef.current) {
              ctx.drawImage(bgCanvasRef.current, 0, 0, w, h);
            }

            // ---- Draw the Single North Park Water Fountain (Animated Water & Jets) ----
            const fx = NORTH_FOUNTAIN.x * w;
            const fy = NORTH_FOUNTAIN.y * h;
            const rx = NORTH_FOUNTAIN.rx * w;
            const ry = NORTH_FOUNTAIN.ry * h;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
            ctx.beginPath();
            ctx.ellipse(fx, fy + 4, rx + 6, ry + 4, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#94A3B8';
            ctx.strokeStyle = '#F8FAFC';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(fx, fy, rx + 4, ry + 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#0284C7';
            ctx.beginPath();
            ctx.ellipse(fx, fy, rx - 2, ry - 2, 0, 0, Math.PI * 2);
            ctx.fill();

            for (let r = 0; r < 2; r++) {
              const prog = (t * 0.7 + r * 0.5) % 1;
              ctx.strokeStyle = `rgba(224, 242, 254, ${(1 - prog) * 0.55})`;
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.ellipse(fx, fy, (rx - 5) * prog, (ry - 4) * prog, 0, 0, Math.PI * 2);
              ctx.stroke();
            }

            ctx.fillStyle = '#CBD5E1';
            ctx.beginPath();
            ctx.ellipse(fx, fy, rx * 0.22, ry * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#F1F5F9';
            ctx.fillRect(fx - 4, fy - 14, 8, 14);

            ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
            ctx.lineWidth = 1.8;
            [-1, -0.5, 0.5, 1].forEach((dir, jIdx) => {
              const jetW = rx * 0.55 * dir;
              const jetH = 15 + Math.sin(t * 9 + jIdx) * 3;
              ctx.beginPath();
              ctx.moveTo(fx, fy - 14);
              ctx.quadraticCurveTo(fx + jetW * 0.5, fy - 14 - jetH, fx + jetW, fy - 2);
              ctx.stroke();
            });

            // Interactive Splash Ripples inside North Fountain
            for (let i = st.ripples.length - 1; i >= 0; i--) {
              const rp = st.ripples[i];
              rp.life++;
              if (rp.life >= rp.maxLife) {
                st.ripples.splice(i, 1);
                continue;
              }
              const p = rp.life / rp.maxLife;
              ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - p) * 0.9})`;
              ctx.lineWidth = 2.2;
              ctx.beginPath();
              ctx.ellipse(
                rp.x * w,
                rp.y * h,
                (rp.rx + (rp.maxRx - rp.rx) * p) * w,
                (rp.ry + (rp.maxRx * 0.65 - rp.ry) * p) * h,
                0,
                0,
                Math.PI * 2
              );
              ctx.stroke();
            }

            // ---- Depth-Sorted Entities (Citizens + Motorbikes + Cars) ----
            type RenderItem =
              | { kind: 'citizen'; y: number; data: CityCitizen }
              | { kind: 'vehicle'; y: number; data: StreetVehicle };

            const renderItems: RenderItem[] = [];
            st.citizens.forEach((c) => renderItems.push({ kind: 'citizen', y: c.y, data: c }));
            st.vehicles.forEach((v) => renderItems.push({ kind: 'vehicle', y: v.y, data: v }));
            renderItems.sort((a, b) => a.y - b.y);

            const isUfoPresent = st.mode !== 'idle';
            const ufoActualX = st.ufoX * w;
            const ufoActualY = st.ufoY * h;
            const totalCitizens = st.citizens.length;
            const mobileScale = w < 640 ? 0.84 : 1;

            const drawVehicle = (v: StreetVehicle) => {
              const vx = v.x * w;
              const vy = v.y * h;
              const bounce = reducedMotion ? 0 : Math.sin(t * 24 + v.id) * 0.5;

              ctx.save();
              ctx.translate(vx, vy + bounce);
              ctx.scale(v.direction * mobileScale, mobileScale);

              // Fast translucent headlight cone
              ctx.fillStyle = 'rgba(255, 243, 176, 0.24)';
              ctx.beginPath();
              ctx.moveTo(14, -3);
              ctx.lineTo(66, -12);
              ctx.lineTo(66, 9);
              ctx.lineTo(14, 4);
              ctx.closePath();
              ctx.fill();

              if (v.type === 'motorbike') {
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath();
                ctx.ellipse(0, 5.5, 13, 3.5, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#0F172A';
                ctx.strokeStyle = '#CBD5E1';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(-9, 2, 4.8, 0, Math.PI * 2);
                ctx.arc(9, 2, 4.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = v.color;
                ctx.beginPath();
                ctx.moveTo(-11, 1);
                ctx.lineTo(3, 1);
                ctx.lineTo(8.5, -9);
                ctx.lineTo(11.5, 1);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = v.riderColor;
                ctx.beginPath();
                ctx.roundRect(-6, -14.5, 8, 10.5, 3.5);
                ctx.fill();

                ctx.fillStyle = '#FFD166';
                ctx.beginPath();
                ctx.arc(-1, -18.5, 4.6, 0, Math.PI * 2);
                ctx.fill();
              } else {
                ctx.fillStyle = 'rgba(0,0,0,0.44)';
                ctx.beginPath();
                ctx.ellipse(0, 6.5, 25, 5.5, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = v.color;
                ctx.strokeStyle = '#0F172A';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(-24, -7.5, 48, 12, 5.5);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#1E293B';
                ctx.beginPath();
                ctx.moveTo(-14, -7.5);
                ctx.lineTo(-7.5, -16);
                ctx.lineTo(10, -16);
                ctx.lineTo(15.5, -7.5);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#38DDF8';
                ctx.beginPath();
                ctx.moveTo(-11, -8.5);
                ctx.lineTo(-6, -14);
                ctx.lineTo(8, -14);
                ctx.lineTo(12.5, -8.5);
                ctx.closePath();
                ctx.fill();

                if (v.type === 'taxi') {
                  ctx.fillStyle = '#FFD166';
                  ctx.fillRect(-4.5, -20, 9, 4);
                }

                ctx.fillStyle = '#0F172A';
                ctx.strokeStyle = '#CBD5E1';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(-14, 5, 5, 0, Math.PI * 2);
                ctx.arc(14, 5, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              }

              ctx.restore();
            };

            const drawCitizen = (c: CityCitizen) => {
              const groundX = c.x * w;
              const groundY = c.y * h;

              const currentX =
                c.levitationProgress > 0
                  ? groundX + (ufoActualX - groundX) * c.levitationProgress
                  : groundX;
              const currentY =
                c.levitationProgress > 0
                  ? groundY + (ufoActualY + 12 - groundY) * Math.pow(c.levitationProgress, 0.88)
                  : groundY;

              const shrink =
                c.levitationProgress > 0.68 ? 1 - (c.levitationProgress - 0.68) / 0.32 : 1;
              if (shrink <= 0.02) return;

              const isUnderRadar =
                (st.mode === 'scanning' || st.mode === 'locking') &&
                Math.abs(c.x - st.ufoX) < 0.085;

              const isTargetActive =
                c.isTargetWinner && (st.mode === 'locking' || st.mode === 'abducting');

              const isFallen = c.physicsState === 'fallen';
              const isInFountain = c.physicsState === 'in_fountain';
              const isSubmergedInBasin =
                isInFountain && c.fountainTimer <= 80 && c.fountainTimer > 16;

              const walkCycle = t * 9.5 + c.animOffset;
              const bobY =
                isFallen || isInFountain
                  ? -c.hopY
                  : c.levitationProgress > 0
                  ? Math.sin(t * 14) * 4
                  : Math.abs(Math.sin(walkCycle)) * -3.5;

              ctx.save();
              ctx.translate(currentX, currentY + bobY);

              if (c.levitationProgress < 0.25 && !isSubmergedInBasin) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
                ctx.beginPath();
                ctx.ellipse(0, 2.5, isFallen ? 14 : 9, 3.2, 0, 0, Math.PI * 2);
                ctx.fill();
              }

              if (isFallen) {
                const standUpRatio = c.fallTimer < 14 ? c.fallTimer / 14 : 1;
                ctx.translate(0, -6 * standUpRatio);
                ctx.rotate(c.fallDir * (Math.PI / 2.15) * standUpRatio);
              } else if (isInFountain && c.fountainTimer > 80) {
                const diveProg = (96 - c.fountainTimer) / 16;
                ctx.rotate((c.fountainTargetX >= c.fountainStartX ? 1 : -1) * diveProg * 0.65);
              } else if (isSubmergedInBasin) {
                ctx.translate(0, 9);
                ctx.rotate(Math.sin(t * 14 + c.animOffset) * 0.14);
              } else if (c.levitationProgress > 0) {
                ctx.rotate(Math.sin(t * 10) * 0.18);
              }

              const finalScale = c.heightScale * shrink * mobileScale;
              ctx.scale(finalScale, finalScale);

              if (isTargetActive && c.levitationProgress < 0.35) {
                ctx.strokeStyle = '#FFD166';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.ellipse(0, 2, 19 + Math.sin(t * 12) * 3, 6.5, 0, 0, Math.PI * 2);
                ctx.stroke();
              }

              if (!isSubmergedInBasin) {
                const stride = isFallen
                  ? 2
                  : c.levitationProgress > 0
                  ? Math.sin(t * 16) * 3.5
                  : Math.sin(walkCycle) * 4.6;
                ctx.strokeStyle = c.pantsColor;
                ctx.lineWidth = 3.4;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(-3.2, -12);
                ctx.lineTo(-4 + stride, -1);
                ctx.moveTo(3.2, -12);
                ctx.lineTo(4 - stride, -1);
                ctx.stroke();

                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.ellipse(-4 + stride + c.facing * 1.2, 0, 2.6, 1.5, 0, 0, Math.PI * 2);
                ctx.ellipse(4 - stride + c.facing * 1.2, 0, 2.6, 1.5, 0, 0, Math.PI * 2);
                ctx.fill();
              }

              // Torso / Hoodie
              ctx.fillStyle = c.outfitColor;
              ctx.beginPath();
              ctx.roundRect(-7.5, -26.5, 15, 15.5, 4.5);
              ctx.fill();

              if (c.hasPrideAccent) {
                ctx.fillStyle = '#FFD166';
                ctx.fillRect(-4, -21, 8, 3);
              }

              // Arms
              ctx.strokeStyle = c.outfitColor;
              ctx.lineWidth = 3;
              ctx.beginPath();
              let leftHandX = -9.5;
              let leftHandY = -14;
              let rightHandX = 9.5;
              let rightHandY = -14;

              if (
                isFallen ||
                isInFountain ||
                c.levitationProgress > 0 ||
                (isUfoPresent && Math.abs(c.x - st.ufoX) < 0.2)
              ) {
                const wave = Math.sin(t * 18 + c.animOffset) * 4.2;
                leftHandX = -13;
                leftHandY = -33 + wave;
                rightHandX = 13;
                rightHandY = -33 - wave;
              } else {
                const swing = Math.sin(walkCycle) * 3.4;
                leftHandX = -9.5;
                leftHandY = -14.5 + swing;
                rightHandX = 9.5;
                rightHandY = -14.5 - swing;
              }
              ctx.moveTo(-6.8, -23.5);
              ctx.lineTo(leftHandX, leftHandY);
              ctx.moveTo(6.8, -23.5);
              ctx.lineTo(rightHandX, rightHandY);
              ctx.stroke();

              // Head
              ctx.fillStyle = c.skinColor;
              ctx.beginPath();
              ctx.arc(0, -34.5, 7.6, 0, Math.PI * 2);
              ctx.fill();

              // Hair
              ctx.fillStyle = c.hairColor;
              if (c.hairStyle === 0 || c.hairStyle === 1) {
                ctx.beginPath();
                ctx.arc(0, -36.5, 7.9, Math.PI, 0);
                ctx.fill();
              } else if (c.hairStyle === 2) {
                ctx.beginPath();
                ctx.arc(0, -36.5, 9.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = c.skinColor;
                ctx.beginPath();
                ctx.arc(0, -34, 7.2, 0, Math.PI * 2);
                ctx.fill();
              } else {
                ctx.beginPath();
                ctx.arc(-5.8, -41.5, 3.2, 0, Math.PI * 2);
                ctx.arc(5.8, -41.5, 3.2, 0, Math.PI * 2);
                ctx.arc(0, -36.5, 7.9, Math.PI, 0);
                ctx.fill();
              }

              // Eyes & Mouth
              ctx.fillStyle = '#0F172A';
              ctx.beginPath();
              ctx.arc(-2.5, -34.5, 1.2, 0, Math.PI * 2);
              ctx.arc(2.5, -34.5, 1.2, 0, Math.PI * 2);
              ctx.fill();

              if (isFallen || isInFountain || c.levitationProgress > 0 || isTargetActive) {
                ctx.beginPath();
                ctx.arc(0, -31.2, 2.1, 0, Math.PI * 2);
                ctx.fill();
              }

              if (isSubmergedInBasin) {
                ctx.strokeStyle = '#E0F2FE';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.ellipse(0, -13, 12 + Math.sin(t * 15) * 2.5, 4.2, 0, 0, Math.PI * 2);
                ctx.stroke();
              }

              ctx.restore();

              // Citizen Name Tag
              const showTag =
                isTargetActive ||
                isUnderRadar ||
                isFallen ||
                isInFountain ||
                c.recoverSpeech !== null ||
                totalCitizens <= (w < 640 ? 18 : 36);

              if (showTag) {
                ctx.save();
                const tagY =
                  currentY + bobY - (isFallen || isSubmergedInBasin ? 32 : 48 * finalScale);
                const displayTxt = isTargetActive
                  ? `🎯 #${c.participant.displayCode} ${c.participant.name}`
                  : isInFountain
                  ? `💦 ${c.participant.name} (Té bồn nước!)`
                  : isFallen
                  ? `💫 ${c.participant.name} (Ngã!)`
                  : c.recoverSpeech
                  ? `${c.participant.name}: ${c.recoverSpeech}`
                  : c.participant.name.length > 13
                  ? `${c.participant.name.slice(0, 12)}…`
                  : c.participant.name;

                ctx.font =
                  isTargetActive || isInFountain
                    ? '800 10.5px "Be Vietnam Pro", sans-serif'
                    : '600 8.5px "Be Vietnam Pro", sans-serif';
                const tw = ctx.measureText(displayTxt).width;

                ctx.fillStyle = isTargetActive
                  ? 'rgba(255, 209, 102, 0.96)'
                  : isInFountain
                  ? 'rgba(56, 221, 248, 0.95)'
                  : isFallen
                  ? 'rgba(255, 107, 138, 0.92)'
                  : isUnderRadar
                  ? 'rgba(56, 221, 248, 0.92)'
                  : 'rgba(10, 13, 28, 0.78)';
                ctx.strokeStyle =
                  isTargetActive || isUnderRadar || isFallen || isInFountain
                    ? '#FFFFFF'
                    : 'rgba(255, 255, 255, 0.2)';
                ctx.lineWidth = isTargetActive ? 2 : 1;
                ctx.beginPath();
                ctx.roundRect(currentX - tw / 2 - 4, tagY - 8, tw + 8, 16, 4);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle =
                  isTargetActive || isUnderRadar || isFallen || isInFountain
                    ? '#0A0D1C'
                    : '#E2E8F0';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(displayTxt, currentX, tagY);
                ctx.restore();
              }
            };

            renderItems.forEach((item) => {
              if (item.kind === 'vehicle') {
                drawVehicle(item.data);
              } else {
                drawCitizen(item.data);
              }
            });

            // Water Splash Droplets
            for (let i = st.splashes.length - 1; i >= 0; i--) {
              const sp = st.splashes[i];
              sp.x += sp.vx;
              sp.y += sp.vy;
              sp.vy += 0.00018;
              sp.life++;
              if (sp.life >= sp.maxLife) {
                st.splashes.splice(i, 1);
                continue;
              }
              ctx.fillStyle = sp.color;
              ctx.beginPath();
              ctx.arc(sp.x * w, sp.y * h, sp.radius, 0, Math.PI * 2);
              ctx.fill();
            }

            // Floating Comic Texts ("TÙM! 💦" / "BỐP!")
            for (let i = st.bumps.length - 1; i >= 0; i--) {
              const b = st.bumps[i];
              b.life++;
              if (b.life >= b.maxLife) {
                st.bumps.splice(i, 1);
                continue;
              }
              const prog = b.life / b.maxLife;
              ctx.save();
              ctx.globalAlpha = 1 - prog;
              ctx.fillStyle = b.color;
              ctx.font = '800 11px "Fredoka", sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(b.text, b.x * w, b.y * h - 18 - prog * 14);
              ctx.restore();
            }

            if (st.cityDimAlpha > 0.01) {
              ctx.fillStyle = `rgba(5, 7, 20, ${st.cityDimAlpha * 0.65})`;
              ctx.fillRect(0, 0, w, h);
            }

            // ---- E. Hero UFO, Radar Cone, Tractor Beam & Shockwave ----
            if (st.mode !== 'idle') {
              const ux = ufoActualX;
              const uy = ufoActualY + Math.sin(t * 4) * 3.5;
              const groundTargetY = st.targetY * h;

              if (st.shockwaveRadius > 1) {
                ctx.save();
                ctx.strokeStyle = `rgba(56, 221, 248, ${Math.max(0, 1 - st.shockwaveRadius / 260)})`;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(st.targetX * w, h * 0.18, st.shockwaveRadius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
              }

              if (st.mode === 'scanning' || st.mode === 'locking') {
                ctx.save();
                const scanGroundX = ux + Math.sin(st.scanAngle) * 150;
                const scanGrad = ctx.createLinearGradient(ux, uy + 14, scanGroundX, h * 0.88);
                scanGrad.addColorStop(0, 'rgba(56, 221, 248, 0.62)');
                scanGrad.addColorStop(1, 'rgba(56, 221, 248, 0.04)');
                ctx.fillStyle = scanGrad;
                ctx.beginPath();
                ctx.moveTo(ux - 18, uy + 12);
                ctx.lineTo(ux + 18, uy + 12);
                ctx.lineTo(scanGroundX + 82, h * 0.88);
                ctx.lineTo(scanGroundX - 82, h * 0.88);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
              }

              if (st.beamIntensity > 0.01) {
                ctx.save();
                const topW = 30 * st.ufoScale * mobileScale;
                const botW = 74 * st.ufoScale * st.beamIntensity * mobileScale;

                const beamGrad = ctx.createLinearGradient(ux, uy + 12, ux, groundTargetY);
                beamGrad.addColorStop(0, `rgba(56, 221, 248, ${0.86 * st.beamIntensity})`);
                beamGrad.addColorStop(0.5, `rgba(139, 92, 246, ${0.65 * st.beamIntensity})`);
                beamGrad.addColorStop(1, `rgba(85, 230, 165, ${0.35 * st.beamIntensity})`);

                ctx.fillStyle = beamGrad;
                ctx.beginPath();
                ctx.moveTo(ux - topW, uy + 12);
                ctx.lineTo(ux + topW, uy + 12);
                ctx.lineTo(ux + botW, groundTargetY);
                ctx.lineTo(ux - botW, groundTargetY);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = '#38DDF8';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.ellipse(ux, groundTargetY - 3, botW * 0.85, 11, 0, 0, Math.PI * 2);
                ctx.stroke();

                for (let r = 0; r < 5; r++) {
                  const rProg = (t * 1.6 + r * 0.2) % 1;
                  const ry = groundTargetY - rProg * (groundTargetY - (uy + 16));
                  const rw = botW * (1 - rProg * 0.55);
                  ctx.strokeStyle = `rgba(255, 209, 102, ${(1 - rProg) * st.beamIntensity})`;
                  ctx.lineWidth = 2.2;
                  ctx.beginPath();
                  ctx.ellipse(ux, ry, rw * 0.72, 6.5, 0, 0, Math.PI * 2);
                  ctx.stroke();
                }

                st.particles.forEach((pt) => {
                  pt.yProg = (pt.yProg + pt.speed) % 1;
                  const py = groundTargetY - pt.yProg * (groundTargetY - (uy + 16));
                  const px = ux + Math.sin(t * 5 + pt.yProg * 8) * pt.xOffset;
                  ctx.fillStyle = pt.color;
                  ctx.beginPath();
                  ctx.arc(px, py, pt.radius, 0, Math.PI * 2);
                  ctx.fill();
                });

                ctx.restore();
              }

              // UFO Spacecraft with Cute Alien Pilot
              ctx.save();
              ctx.translate(ux, uy);
              ctx.scale(st.ufoScale * mobileScale, st.ufoScale * mobileScale);
              ctx.rotate(st.ufoTilt);

              const domeGrad = ctx.createRadialGradient(-8, -18, 4, 0, -8, 36);
              domeGrad.addColorStop(0, 'rgba(224, 242, 254, 0.72)');
              domeGrad.addColorStop(0.6, 'rgba(56, 221, 248, 0.45)');
              domeGrad.addColorStop(1, 'rgba(139, 92, 246, 0.35)');
              ctx.fillStyle = domeGrad;
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(0, -6, 35, Math.PI, 0);
              ctx.fill();
              ctx.stroke();

              const alienBob = Math.sin(t * 6) * 1.5;
              ctx.strokeStyle = '#55E6A5';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(0, -25 + alienBob);
              ctx.lineTo(Math.sin(t * 8) * 3, -32 + alienBob);
              ctx.stroke();
              ctx.fillStyle = '#FFD166';
              ctx.beginPath();
              ctx.arc(Math.sin(t * 8) * 3, -33 + alienBob, 2.5, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = '#55E6A5';
              ctx.beginPath();
              ctx.ellipse(0, -16 + alienBob, 10.5, 12, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#0A0D1C';
              ctx.beginPath();
              ctx.ellipse(-3.8, -17 + alienBob, 2.8, 3.8, -0.2, 0, Math.PI * 2);
              ctx.ellipse(3.8, -17 + alienBob, 2.8, 3.8, 0.2, 0, Math.PI * 2);
              ctx.fill();

              const hullGrad = ctx.createLinearGradient(-74, 0, 74, 0);
              hullGrad.addColorStop(0, '#4C1D95');
              hullGrad.addColorStop(0.5, '#8B5CF6');
              hullGrad.addColorStop(1, '#3B0764');
              ctx.fillStyle = hullGrad;
              ctx.strokeStyle = '#38DDF8';
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.ellipse(0, 2, 74, 18.5, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = '#38DDF8';
              ctx.beginPath();
              ctx.ellipse(0, 13.5, 28, 7, 0, 0, Math.PI * 2);
              ctx.fill();

              const rimCols = ['#FFD166', '#38DDF8', '#FF6B8A', '#55E6A5'];
              for (let i = 0; i < 8; i++) {
                const ang = (i / 8) * Math.PI * 2 + t * 5.8;
                const lx = Math.cos(ang) * 57;
                const ly = Math.sin(ang) * 11 + 2;
                ctx.fillStyle = rimCols[i % rimCols.length];
                ctx.beginPath();
                ctx.arc(lx, ly, 4.8, 0, Math.PI * 2);
                ctx.fill();
              }

              ctx.restore();
            }

            ctx.restore();
          }
        }
      }

      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => {
      isMounted = false;
      cancelAnimationFrame(rafId);
    };
  }, [reducedMotion, renderStaticCityToCache]);

  // Choreographed GSAP Timeline for UFO Abduction (picks random winner from FULL eligible list!)
  const handleLaunchUfoAbduction = () => {
    if (isGameBusy(gameState) || eligible.length === 0) {
      return;
    }

    const outcome = startDraw();
    if (!outcome) return;

    // True random winner selected by DrawEngine from the ENTIRE eligible list (up to 1,000 people)
    const winner = outcome.primaryWinner;
    const st = engineRef.current;

    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    // Reset all bots first
    st.citizens.forEach((c) => {
      c.isTargetWinner = false;
      c.levitationProgress = 0;
    });

    // Find if the winner is already among the <= 100 representative bots; if not, assign winner to a central bot!
    let targetCitizen = st.citizens.find((c) => c.participant.id === winner.id);
    if (!targetCitizen && st.citizens.length > 0) {
      const midIdx = Math.floor(st.citizens.length / 2);
      targetCitizen = st.citizens[midIdx];
      targetCitizen.participant = winner;
    }

    if (!targetCitizen) {
      st.citizens = buildRepresentativeCitizens([winner], winner.id);
      targetCitizen = st.citizens[0];
    }

    targetCitizen.isTargetWinner = true;
    targetCitizen.x = Math.max(0.18, Math.min(0.82, targetCitizen.x));
    targetCitizen.y = Math.max(
      NORTH_SIDEWALK_MIN + 0.03,
      Math.min(SOUTH_SIDEWALK_MAX - 0.04, targetCitizen.y)
    );
    targetCitizen.vx = 0;
    targetCitizen.vy = 0;
    targetCitizen.physicsState = 'normal';
    targetCitizen.fallTimer = 0;
    targetCitizen.fountainTimer = 0;
    targetCitizen.hopY = 0;
    targetCitizen.levitationProgress = 0;

    st.winner = winner;
    st.targetX = targetCitizen.x;
    st.targetY = targetCitizen.y;
    st.ufoX = 0.12;
    st.ufoY = -0.24;
    st.ufoScale = 0.32;
    st.ufoTilt = 0.25;
    st.cityDimAlpha = 0;
    st.scanAngle = 0;
    st.beamIntensity = 0;
    st.shockwaveRadius = 0;
    st.cameraZoom = 1;
    st.cameraFocusX = 0.5;
    st.cameraFocusY = 0.65;
    st.particles = Array.from({ length: reducedMotion ? 10 : 22 }, (_, i) => ({
      xOffset: ((i % 7) - 3) * 11,
      yProg: (i / 22) % 1,
      speed: 0.013 + (i % 4) * 0.004,
      radius: 2 + (i % 3),
      color: i % 2 === 0 ? '#38DDF8' : '#FFD166',
    }));

    setGameState('running');

    const totalSec = Math.max(4.8, animationDuration);
    const tl = gsap.timeline();
    timelineRef.current = tl;

    // Phase 1: UFO Swoops In from Deep Space (16% duration)
    tl.call(() => {
      st.mode = 'entering';
      audioService.playUfoArrival();
      setStatusBanner('🛸 CẢNH BÁO: Phi thuyền UFO vừa tiến vào bầu trời đại lộ & phố đi bộ!');
    });
    tl.to(st, {
      ufoX: 0.2,
      ufoY: 0.18,
      ufoScale: 1,
      ufoTilt: 0.08,
      cityDimAlpha: 0.35,
      duration: totalSec * 0.16,
      ease: 'back.out(1.3)',
    });

    // Phase 2: Radar Sweep Across the Fountain Park & Street Food Promenade (32% duration)
    tl.call(() => {
      st.mode = 'scanning';
      audioService.playUfoScanSweep();
      setStatusBanner('🔍 UFO đang quét Radar khắp công viên bồn nước & phố hàng rong...');
    });
    tl.to(st, {
      ufoX: 0.84,
      ufoTilt: -0.1,
      scanAngle: 0.42,
      duration: totalSec * 0.16,
      ease: 'sine.inOut',
    });
    tl.to(st, {
      ufoX: 0.24,
      ufoTilt: 0.1,
      scanAngle: -0.42,
      duration: totalSec * 0.16,
      ease: 'sine.inOut',
    });

    // Phase 3: Target Lock & Subtle Camera Zoom In (14% duration)
    tl.call(() => {
      st.mode = 'locking';
      setRadarReadout(`🎯 ĐÃ KHÓA MỤC TIÊU: #${winner.displayCode} ${winner.name}`);
      setStatusBanner(`🎯 ĐÃ KHÓA MỤC TIÊU: #${winner.displayCode} — ${winner.name}!`);
    });
    tl.to(st, {
      ufoX: st.targetX,
      ufoTilt: 0,
      scanAngle: 0,
      cameraZoom: reducedMotion ? 1 : 1.15,
      cameraFocusX: st.targetX,
      cameraFocusY: st.targetY * 0.72,
      duration: totalSec * 0.14,
      ease: 'power3.out',
    });

    // Phase 4: Tractor Beam & Citizen Levitation (26% duration)
    tl.call(() => {
      st.mode = 'abducting';
      audioService.playTractorBeam();
      setStatusBanner(`✨ Tia Tractor Beam đang hút ${winner.name} lên phi thuyền!`);
    });
    tl.to(st, {
      beamIntensity: 1,
      duration: totalSec * 0.06,
      ease: 'power2.out',
    });
    tl.to(
      targetCitizen,
      {
        levitationProgress: 1,
        duration: totalSec * 0.24,
        ease: 'power2.inOut',
      },
      '-=0.15'
    );
    tl.call(
      () => {
        audioService.playUfoAbductWhoosh();
      },
      undefined,
      '-=0.35'
    );

    // Phase 5: Hyper-Warp Exit & Camera Reset (12% duration)
    tl.call(() => {
      st.mode = 'departing';
    });
    tl.to(st, {
      beamIntensity: 0,
      cityDimAlpha: 0,
      cameraZoom: 1,
      shockwaveRadius: 260,
      ufoX: st.targetX + 0.45,
      ufoY: -0.38,
      ufoScale: 1.32,
      ufoTilt: -0.28,
      duration: totalSec * 0.12,
      ease: 'power3.in',
    });

    // Complete -> Reveal Winner Overlay
    tl.call(() => {
      st.mode = 'finished';
      setStatusBanner(`🚀 UFO đã bắt thành công người chiến thắng: ${winner.name}!`);
      setGameState('revealing');
      window.setTimeout(() => {
        revealWinnerOverlay();
      }, 450);
    });
  };

  const busy = isGameBusy(gameState);

  return (
    <div
      className={`flex-1 flex flex-col items-center justify-between mx-auto w-full ${
        isForcedMobileLandscape
          ? 'px-3 py-1.5 gap-1.5 bg-[#050816]'
          : isFullscreen
          ? 'max-w-none h-[calc(100dvh-8px)] px-3 sm:px-5 py-2 gap-2 overflow-hidden'
          : 'max-w-[1920px] px-2 sm:px-4 lg:px-6 py-1.5 gap-2'
      }`}
      style={
        isForcedMobileLandscape
          ? {
              position: 'fixed',
              top: 0,
              left: '100vw',
              width: '100dvh',
              height: '100vw',
              transform: 'rotate(90deg)',
              transformOrigin: 'top left',
              zIndex: 30,
            }
          : undefined
      }
    >
      {/* Top Telemetry & Radar Scanner Bar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl arcade-glass border border-cyan-400/35 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-[#38DDF8] text-[10px] sm:text-xs font-bold uppercase shrink-0">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>ĐẠI LỘ UFO ({representativePool.length} BOT / {eligible.length})</span>
          </span>
          <span className="text-xs sm:text-sm font-medium text-slate-200 truncate">
            {statusBanner}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <AnimatePresence mode="wait">
            {radarReadout && (
              <motion.span
                key={radarReadout}
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="px-2.5 py-0.5 sm:py-1 rounded-xl bg-amber-400/20 border border-amber-400/45 text-[#FFD166] font-mono text-[10px] sm:text-xs font-bold flex items-center gap-1"
              >
                <Crosshair className="w-3.5 h-3.5 text-[#38DDF8] shrink-0" />
                <span className="truncate max-w-[150px] sm:max-w-xs">{radarReadout}</span>
              </motion.span>
            )}
          </AnimatePresence>

          {isMobileDevice && (
            <button
              onClick={() => setMobileLandscapeEnabled((v) => !v)}
              className="px-2.5 py-1 rounded-xl border bg-purple-500/20 border-purple-400/40 text-purple-200 text-[11px] font-semibold flex items-center gap-1"
              title="Chuyển đổi màn hình ngang / dọc trên điện thoại"
            >
              <Smartphone className={`w-3.5 h-3.5 ${isForcedMobileLandscape ? 'rotate-90' : ''}`} />
              <span>{isForcedMobileLandscape ? 'Thoát ngang' : 'Màn hình ngang'}</span>
            </button>
          )}

          {!isFullscreen && !isForcedMobileLandscape && (
            <button
              onClick={toggleFullscreen}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl border bg-sky-500/15 border-sky-400/35 text-sky-200 text-xs font-semibold hover:bg-sky-500/25 transition-colors"
              title="Mở toàn màn hình trình chiếu"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Trình chiếu</span>
            </button>
          )}

          <button
            onClick={() => updateSettings({ reducedMotion: !reducedMotion })}
            disabled={busy}
            className={`px-2.5 py-1 rounded-xl border text-[10px] sm:text-xs font-semibold flex items-center gap-1 transition-colors ${
              reducedMotion
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="Chế độ tối ưu cho máy cấu hình thấp"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{reducedMotion ? 'Chế độ Nhẹ' : 'Hiệu ứng Cao'}</span>
          </button>

          <span className="text-[10px] sm:text-xs font-mono text-slate-300 bg-[#0A0D1C]/80 border border-white/10 px-2.5 py-1 rounded-xl flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-[#38DDF8]" />
            {eligible.length}/{participants.length}
          </span>
        </div>
      </div>

      {/* Wide Panoramic 2.5D Avenue & Fountain Park Viewport */}
      <div
        className={`relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-purple-500/45 shadow-[0_0_65px_-12px_rgba(56,221,248,0.4)] bg-[#050816] ${
          isForcedMobileLandscape || isFullscreen
            ? 'flex-1 min-h-0'
            : 'flex-1 h-[calc(100dvh-220px)] min-h-[380px] sm:min-h-[460px] lg:min-h-[520px] max-h-[820px]'
        }`}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Dedicated Bottom Control Bar */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 px-1 sm:px-2 shrink-0">
        <p className="text-[11px] sm:text-xs text-slate-300 hidden sm:flex items-center gap-1.5">
          <Droplets className="w-4 h-4 text-[#38DDF8] shrink-0" />
          <span>
            Hiển thị tối đa <strong>{representativePool.length} bot đại diện</strong> (60fps mượt mà) • Quay ngẫu nhiên trên toàn bộ <strong>{eligible.length} người</strong>.
          </span>
        </p>

        <motion.button
          whileHover={{ scale: busy ? 1 : 1.03 }}
          whileTap={{ scale: busy ? 1 : 0.97 }}
          onClick={handleLaunchUfoAbduction}
          disabled={busy}
          className="w-full sm:w-auto px-7 sm:px-10 py-2.5 sm:py-3 rounded-2xl bg-gradient-to-r from-[#38DDF8] via-[#8B5CF6] to-[#FF6B8A] text-white font-display font-extrabold text-sm sm:text-lg tracking-wider shadow-[0_0_38px_-5px_rgba(56,221,248,0.85)] border border-white/35 flex items-center justify-center gap-2.5 disabled:opacity-50 shrink-0"
        >
          <Sparkles className="w-5 h-5 text-[#FFD166] shrink-0" />
          <span>{busy ? 'UFO ĐANG BẮT NGƯỜI...' : 'PHÓNG UFO BẮT NGƯỜI'}</span>
        </motion.button>
      </div>
    </div>
  );
};
