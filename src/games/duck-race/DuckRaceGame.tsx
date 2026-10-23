import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { Flag, Trophy, Users, Sparkles } from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import { Participant } from '../../types/participant';
import { audioService } from '../../services/audio-service';
import { isGameBusy } from '../../engine/game-state-machine';
import { DrawEngine } from '../../engine/draw-engine';
import { cryptoShuffle } from '../../engine/random';

const DUCK_BODY_COLORS = [
  '#FFD166', // Classic Sunny Yellow
  '#FF6B8A', // Coral Pink
  '#38DDF8', // Aqua Blue
  '#55E6A5', // Mint Green
  '#C084FC', // Electric Lavender
  '#FB923C', // Tangerine Orange
  '#F472B6', // Hot Rose
  '#FACC15', // Gold
  '#2DD4BF', // Teal
  '#A78BFA', // Violet
];

interface DuckRacer {
  participant: Participant;
  depthY: number; // 0.06 to 0.94 vertical position in river
  bodyColor: string;
  hatType: number; // 0: crown, 1: headband, 2: sunglasses, 3: sailor cap, 4: pride bow
  progress: number; // 0 (start) to 1 (finish line)
  bobPhase: number;
  jumpY: number;
  speedBurst: boolean;
  isWinner: boolean;
  freq1: number;
  freq2: number;
  amp1: number;
  amp2: number;
  finalCap: number;
}

interface WaterDroplet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

const MAX_ACTIVE_DUCKS = 60;

export const DuckRaceGame: React.FC = () => {
  const participants = useAppStore((s) => s.participants);
  const excludedIds = useAppStore((s) => s.excludedIds);
  const allowRepeatWinner = useAppStore((s) => s.settings.allowRepeatWinner);
  const animationDuration = useAppStore((s) => s.settings.animationDuration);
  const reducedMotion = useAppStore((s) => s.settings.reducedMotion);
  const gameState = useAppStore((s) => s.gameState);
  const setGameState = useAppStore((s) => s.setGameState);
  const startDraw = useAppStore((s) => s.startDraw);
  const revealWinnerOverlay = useAppStore((s) => s.revealWinnerOverlay);

  const eligible = useMemo(
    () => DrawEngine.getEligibleParticipants(participants, excludedIds, allowRepeatWinner),
    [participants, excludedIds, allowRepeatWinner]
  );

  // Dynamically determine active duck count based on participant list!
  const activeDuckLimit = reducedMotion
    ? Math.min(25, eligible.length)
    : Math.min(MAX_ACTIVE_DUCKS, eligible.length);

  const idlePool = useMemo(() => {
    return eligible.slice(0, Math.max(1, activeDuckLimit));
  }, [eligible, activeDuckLimit]);

  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [racePhaseLabel, setRacePhaseLabel] = useState<string>(
    'Đàn vịt đang khởi động tại vạch xuất phát'
  );
  const [topLeaders, setTopLeaders] = useState<Participant[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const buildRacers = useCallback((pool: Participant[], winnerId: string | null): DuckRacer[] => {
    const total = Math.max(1, pool.length);
    return pool
      .map((p, idx) => {
        const seed = p.avatarSeed;
        const baseDepth = (idx + 0.5) / total;
        const jitter = ((seed % 11) - 5) * 0.004;
        const depthY = Math.max(0.06, Math.min(0.94, baseDepth + jitter));

        return {
          participant: p,
          depthY,
          bodyColor: DUCK_BODY_COLORS[seed % DUCK_BODY_COLORS.length],
          hatType: (seed >> 3) % 5,
          progress: 0,
          bobPhase: idx * 0.75 + (seed % 7),
          jumpY: 0,
          speedBurst: false,
          isWinner: p.id === winnerId,
          freq1: 2 + (seed % 3),
          freq2: 3 + ((seed >> 2) % 4),
          amp1: ((seed % 17) - 8) * 0.011,
          amp2: (((seed >> 4) % 15) - 7) * 0.009,
          finalCap: 0.84 + (seed % 12) * 0.011, // 0.84 to 0.96
        };
      })
      .sort((a, b) => a.depthY - b.depthY);
  }, []);

  const engineRef = useRef<{
    mode: 'idle' | 'countdown' | 'racing' | 'finished';
    racers: DuckRacer[];
    droplets: WaterDroplet[];
    raceTimeNorm: number; // Driven 0 -> 1 by GSAP
    cameraScroll: number;
    waterTime: number;
    winnerBounceY: number;
    lastQuackTime: number;
    lastUiSyncTime: number;
    winner: Participant | null;
  }>({
    mode: 'idle',
    racers: [],
    droplets: [],
    raceTimeNorm: 0,
    cameraScroll: 0,
    waterTime: 0,
    winnerBounceY: 0,
    lastQuackTime: 0,
    lastUiSyncTime: 0,
    winner: null,
  });

  // Sync idle flock when participant list changes
  useEffect(() => {
    if (engineRef.current.mode === 'idle') {
      engineRef.current.racers = buildRacers(idlePool, null);
      setTopLeaders(idlePool.slice(0, 4));
      setRacePhaseLabel(`Sẵn sàng xuất phát (${idlePool.length} chú vịt trên sông)`);
    }
  }, [idlePool, buildRacers]);

  // Reset engine when returning from WinnerOverlay
  useEffect(() => {
    if (gameState === 'ready' || gameState === 'idle') {
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
      engineRef.current.mode = 'idle';
      engineRef.current.racers = buildRacers(idlePool, null);
      engineRef.current.raceTimeNorm = 0;
      engineRef.current.cameraScroll = 0;
      engineRef.current.winnerBounceY = 0;
      setCountdownText(null);
      setTopLeaders(idlePool.slice(0, 4));
      setRacePhaseLabel(`Sẵn sàng xuất phát (${idlePool.length} chú vịt trên sông)`);
    }
  }, [gameState, idlePool, buildRacers]);

  useEffect(() => {
    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, []);

  // Master persistent 60fps Canvas Loop
  useEffect(() => {
    let rafId = 0;
    let isMounted = true;

    const renderLoop = (now: number) => {
      if (!isMounted) return;
      const st = engineRef.current;

      // 1. Update simulation
      if (st.mode === 'idle' || st.mode === 'countdown') {
        st.waterTime += 0.025;
        st.cameraScroll += 0.45;
      } else if (st.mode === 'racing') {
        const tNorm = st.raceTimeNorm;

        st.waterTime += 0.058;
        st.cameraScroll += 6.8 * (0.4 + Math.sin(tNorm * Math.PI) * 0.85);

        if (now - st.lastQuackTime > 580 && tNorm < 0.94) {
          st.lastQuackTime = now;
          audioService.playDuckQuack(0.85 + Math.random() * 0.35);
        }

        st.racers.forEach((r) => {
          const wave =
            Math.sin(tNorm * Math.PI * r.freq1) * r.amp1 * 3.5 +
            Math.sin(tNorm * Math.PI * r.freq2) * r.amp2 * 3.2;

          if (r.isWinner) {
            const surge = tNorm > 0.68 ? Math.pow((tNorm - 0.68) / 0.32, 1.45) * 0.095 : 0;
            r.progress = Math.min(1, Math.max(0, tNorm * 0.925 + wave * (1 - tNorm) + surge));
            if (tNorm >= 0.995) r.progress = 1;
            r.speedBurst = tNorm > 0.66;
          } else {
            r.progress = Math.min(
              r.finalCap,
              Math.max(0, tNorm * r.finalCap + wave * (1 - tNorm * 0.85))
            );
            r.speedBurst = wave > 0.014 && tNorm < 0.72;
          }

          // Jump over river whirlpools/buoys at 0.38 and 0.68
          const d1 = Math.abs(r.progress - 0.38);
          const d2 = Math.abs(r.progress - 0.68);
          if (d1 < 0.042) {
            r.jumpY = Math.cos((d1 / 0.042) * (Math.PI / 2)) * 14;
          } else if (d2 < 0.042) {
            r.jumpY = Math.cos((d2 / 0.042) * (Math.PI / 2)) * 14;
          } else {
            r.jumpY = 0;
          }
        });

        // Update React HUD every 180ms
        if (now - st.lastUiSyncTime > 180) {
          st.lastUiSyncTime = now;
          const sortedByProgress = [...st.racers].sort((a, b) => b.progress - a.progress);
          setTopLeaders(sortedByProgress.slice(0, 4).map((d) => d.participant));

          if (tNorm < 0.25) {
            setRacePhaseLabel('🚀 Giai đoạn 1: Xuất phát! Đàn vịt lao xuống dòng nước xanh!');
          } else if (tNorm < 0.58) {
            setRacePhaseLabel('🌊 Giai đoạn 2: Vượt xoáy nước & bứt phá tốc độ!');
          } else if (tNorm < 0.82) {
            setRacePhaseLabel('🔥 Giai đoạn 3: Rượt đuổi nghẹt thở từng centimet!');
          } else {
            setRacePhaseLabel('⚡ Giai đoạn 4: Nước rút thần tốc về vạch đích!');
          }
        }
      } else if (st.mode === 'finished') {
        st.waterTime += 0.032;
      }

      // 2. Render Canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const targetW = Math.round(rect.width * dpr);
            const targetH = Math.round(rect.height * dpr);
            if (canvas.width !== targetW || canvas.height !== targetH) {
              canvas.width = targetW;
              canvas.height = targetH;
            }

            ctx.save();
            ctx.scale(dpr, dpr);

            const w = rect.width;
            const h = rect.height;
            const t = st.waterTime;

            // Top Stadium & Riverbank (17% height)
            const bankH = Math.max(66, h * 0.17);
            const skyGrad = ctx.createLinearGradient(0, 0, 0, bankH);
            skyGrad.addColorStop(0, '#090E1D');
            skyGrad.addColorStop(1, '#1E293B');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, w, bankH);

            // Scrolling Arcade Banners
            const bannerW = 215;
            for (
              let bx = -((st.cameraScroll * 0.4) % bannerW);
              bx < w + bannerW;
              bx += bannerW
            ) {
              ctx.fillStyle = '#182042';
              ctx.strokeStyle = '#38DDF8';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.roundRect(bx + 10, bankH - 36, bannerW - 20, 24, 6);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = '#FFD166';
              ctx.font = '800 10px "Fredoka", sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('★ LUCKYVERSE SUPER DUCK DERBY ★', bx + bannerW / 2, bankH - 21);
            }

            // Cheering Crowd along top bank with waving arms
            const crowdColors = ['#8B5CF6', '#38DDF8', '#FF6B8A', '#FFD166', '#55E6A5'];
            for (let cx = 16; cx < w; cx += 22) {
              const jump = reducedMotion ? 0 : Math.abs(Math.sin(t * 5.5 + cx * 0.2)) * -5.5;
              const col = crowdColors[Math.floor(cx / 22) % crowdColors.length];
              ctx.fillStyle = col;
              ctx.beginPath();
              ctx.arc(cx, bankH - 44 + jump, 5, 0, Math.PI * 2);
              ctx.fill();

              // Little cheering glowstick
              if (!reducedMotion && Math.floor(cx / 22) % 2 === 0) {
                const waveX = cx + Math.sin(t * 8 + cx) * 4;
                ctx.strokeStyle = '#FFD166';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(cx + 3, bankH - 44 + jump);
                ctx.lineTo(waveX + 5, bankH - 52 + jump);
                ctx.stroke();
              }
            }

            // Grassy Riverbank Edge with flowers
            ctx.fillStyle = '#10B981';
            ctx.fillRect(0, bankH - 8, w, 8);
            ctx.fillStyle = '#059669';
            ctx.fillRect(0, bankH - 3, w, 3);

            // Water Canal Area
            const riverTop = bankH;
            const riverH = h - riverTop;
            const waterGrad = ctx.createLinearGradient(0, riverTop, 0, h);
            waterGrad.addColorStop(0, '#0284C7');
            waterGrad.addColorStop(0.5, '#0369A1');
            waterGrad.addColorStop(1, '#083344');
            ctx.fillStyle = waterGrad;
            ctx.fillRect(0, riverTop, w, riverH);

            // Animated Water Currents & Shimmer Lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.lineWidth = 1.6;
            for (let ry = riverTop + 16; ry < h - 12; ry += 25) {
              for (let rx = -((st.cameraScroll * 1.15) % 105); rx < w + 105; rx += 105) {
                ctx.beginPath();
                ctx.moveTo(rx, ry);
                ctx.quadraticCurveTo(rx + 24, ry - 4.5, rx + 48, ry);
                ctx.stroke();
              }
            }

            const startX = w < 640 ? 54 : 82;
            const finishX = w - (w < 640 ? 60 : 95);
            const trackSpan = Math.max(160, finishX - startX);

            // Whirlpool / Speed Booster Rings at 38% and 68%
            [0.38, 0.68].forEach((pos, idx) => {
              const wx = startX + pos * trackSpan;
              for (let wy = riverTop + 35; wy < h - 25; wy += 65) {
                ctx.save();
                ctx.translate(wx, wy);
                ctx.strokeStyle =
                  idx === 0 ? 'rgba(56, 221, 248, 0.5)' : 'rgba(255, 209, 102, 0.5)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(0, 0, 15, 6.5, 0, 0, Math.PI * 2);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.ellipse(0, 0, 8 + Math.sin(t * 6) * 2, 3.5, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
              }
            });

            // Start Gate Line
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
            ctx.setLineDash([6, 6]);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX, riverTop);
            ctx.lineTo(startX, h);
            ctx.stroke();
            ctx.restore();

            // Checkered Finish Line Banner + Buoys
            const sq = 11;
            for (let cy = riverTop; cy < h; cy += sq) {
              const row = Math.floor((cy - riverTop) / sq);
              for (let col = 0; col < 2; col++) {
                ctx.fillStyle = (row + col) % 2 === 0 ? '#FFFFFF' : '#0F172A';
                ctx.fillRect(finishX + col * sq, cy, sq, Math.min(sq, h - cy));
              }
            }

            // Finish Arch Post at top of finish line
            ctx.fillStyle = '#FFD166';
            ctx.beginPath();
            ctx.arc(finishX + sq, riverTop + 6, 7, 0, Math.PI * 2);
            ctx.fill();

            // Find current Top 5 racers to highlight their labels prominently
            const racers = st.racers;
            const topIds = new Set(
              [...racers]
                .sort((a, b) => b.progress - a.progress)
                .slice(0, 5)
                .map((r) => r.participant.id)
            );

            const duckScale =
              (w < 640 ? 0.82 : 1) *
              (racers.length > 35 ? 0.74 : racers.length > 18 ? 0.86 : 1.0);

            // Draw Ducks from back (top of river) to front (bottom of river) for true 2.5D overlap
            racers.forEach((racer) => {
              const duckX = startX + racer.progress * trackSpan;
              const baseY = riverTop + racer.depthY * riverH;
              const bob = reducedMotion ? 0 : Math.sin(t * 7.5 + racer.bobPhase) * 2.6;
              const winBounce = racer.isWinner ? st.winnerBounceY : 0;
              const duckY = baseY + bob - racer.jumpY - winBounce;

              const isTopLeader = topIds.has(racer.participant.id) || racer.isWinner;

              ctx.save();
              ctx.translate(duckX, duckY);
              ctx.scale(duckScale, duckScale);

              // Forward tilt when speed bursting or jumping
              const pitchAngle =
                racer.jumpY > 1
                  ? -0.18
                  : racer.speedBurst
                  ? 0.08 + Math.sin(t * 18) * 0.04
                  : Math.sin(t * 6 + racer.bobPhase) * 0.03;
              ctx.rotate(pitchAngle);

              // Golden Turbo Aura when bursting forward
              if (racer.speedBurst) {
                ctx.save();
                const auraGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 28);
                auraGrad.addColorStop(0, 'rgba(255, 209, 102, 0.55)');
                auraGrad.addColorStop(1, 'rgba(255, 209, 102, 0)');
                ctx.fillStyle = auraGrad;
                ctx.beginPath();
                ctx.ellipse(0, 0, 28, 17, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
              }

              // Animated Webbed Feet Paddling Underwater (visible through translucent water!)
              if (racer.jumpY < 2) {
                const paddleSpeed = st.mode === 'racing' ? 20 : 8;
                const foot1Angle = Math.sin(t * paddleSpeed + racer.bobPhase) * 5;
                const foot2Angle = Math.cos(t * paddleSpeed + racer.bobPhase) * 5;
                ctx.fillStyle = 'rgba(249, 115, 22, 0.72)';
                ctx.beginPath();
                ctx.ellipse(-6 + foot1Angle, 12.5, 4.2, 2.2, 0.3, 0, Math.PI * 2);
                ctx.ellipse(2 + foot2Angle, 13, 4.2, 2.2, -0.2, 0, Math.PI * 2);
                ctx.fill();
              }

              // Water Ring & Foam Wake
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.ellipse(-1, 9.5, 16, 4.2, 0, 0, Math.PI * 2);
              ctx.stroke();

              if (racer.progress > 0.005 && racer.progress < 1) {
                ctx.strokeStyle = racer.speedBurst ? '#FFD166' : 'rgba(255, 255, 255, 0.82)';
                ctx.lineWidth = racer.speedBurst ? 2.8 : 1.8;
                ctx.beginPath();
                ctx.moveTo(-16, 5);
                ctx.lineTo(-32 - (racer.speedBurst ? 14 : 0), 1.5);
                ctx.moveTo(-14, 9);
                ctx.lineTo(-28, 12);
                ctx.stroke();
              }

              // Plump Shaded Duck Body
              ctx.fillStyle = racer.bodyColor;
              ctx.strokeStyle = '#0F172A';
              ctx.lineWidth = 1.6;
              ctx.beginPath();
              ctx.ellipse(-2, 3.5, 14.5, 9.8, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              // Soft Belly Highlight
              ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
              ctx.beginPath();
              ctx.ellipse(0, 6, 10, 4.5, 0, 0, Math.PI * 2);
              ctx.fill();

              // Perky Tail Feathers
              ctx.fillStyle = racer.bodyColor;
              ctx.beginPath();
              ctx.moveTo(-13.5, 1.5);
              ctx.lineTo(-22, -5.5);
              ctx.lineTo(-18, 1);
              ctx.lineTo(-22, 3.5);
              ctx.lineTo(-13, 7);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              // Articulated Flapping Wing
              const flapFreq = racer.speedBurst ? 24 : st.mode === 'racing' ? 16 : 6;
              const wingRot = reducedMotion
                ? 0
                : Math.sin(t * flapFreq + racer.bobPhase) * (racer.speedBurst ? 0.48 : 0.28);
              ctx.save();
              ctx.translate(-2.5, 2.5);
              ctx.rotate(wingRot);
              ctx.fillStyle = racer.bodyColor;
              ctx.beginPath();
              ctx.ellipse(0, 1.5, 8.2, 4.6, -0.18, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
              ctx.beginPath();
              ctx.ellipse(0.5, 1, 5.5, 2.5, -0.18, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();

              // Duck Head
              ctx.fillStyle = racer.bodyColor;
              ctx.beginPath();
              ctx.arc(8.8, -6, 8.4, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              // Rosy Cheek
              ctx.fillStyle = 'rgba(255, 107, 138, 0.55)';
              ctx.beginPath();
              ctx.arc(10, -3.5, 2.2, 0, Math.PI * 2);
              ctx.fill();

              // Expressive Beak (Opens to quack when speed bursting!)
              ctx.fillStyle = '#F97316';
              ctx.strokeStyle = '#0F172A';
              ctx.lineWidth = 1.2;
              if (racer.speedBurst) {
                // Open quacking beak
                ctx.beginPath();
                ctx.moveTo(15, -8.5);
                ctx.lineTo(24.5, -7);
                ctx.lineTo(15.5, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(15.5, -5);
                ctx.lineTo(23.5, -2.2);
                ctx.lineTo(14.5, -2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
              } else {
                // Classic cute curved bill
                ctx.beginPath();
                ctx.moveTo(15, -8);
                ctx.quadraticCurveTo(24.5, -6, 23.5, -4);
                ctx.quadraticCurveTo(19, -2, 15, -2.2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
              }

              // Blinking Eye + Determined Eyebrow when bursting
              const isBlinking = Math.sin(t * 2.4 + racer.bobPhase * 2) > 0.96;
              if (isBlinking && !racer.speedBurst) {
                ctx.strokeStyle = '#0F172A';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(9.5, -7.2);
                ctx.lineTo(13, -7.2);
                ctx.stroke();
              } else {
                ctx.fillStyle = '#0F172A';
                ctx.beginPath();
                ctx.arc(11.4, -7.4, 2.1, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(12, -8, 0.8, 0, Math.PI * 2);
                ctx.fill();

                if (racer.speedBurst) {
                  ctx.strokeStyle = '#0F172A';
                  ctx.lineWidth = 1.6;
                  ctx.beginPath();
                  ctx.moveTo(9.2, -10.5);
                  ctx.lineTo(13.8, -9);
                  ctx.stroke();
                }
              }

              // Detailed Hats & Accessories
              if (racer.hatType === 0) {
                // Royal Gold Crown with Ruby Gem
                ctx.fillStyle = '#FFD166';
                ctx.strokeStyle = '#0F172A';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(3.5, -13);
                ctx.lineTo(4.5, -20);
                ctx.lineTo(8.8, -15.5);
                ctx.lineTo(13, -20);
                ctx.lineTo(14, -13);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#EF4444';
                ctx.beginPath();
                ctx.arc(8.8, -15, 1.3, 0, Math.PI * 2);
                ctx.fill();
              } else if (racer.hatType === 1) {
                // Red Ninja / Sport Headband with fluttering tail
                ctx.fillStyle = '#EF4444';
                ctx.fillRect(1.5, -12, 14, 3.2);
                const tailWave = Math.sin(t * 18 + racer.bobPhase) * 2.5;
                ctx.beginPath();
                ctx.moveTo(1.5, -11);
                ctx.lineTo(-6, -13 + tailWave);
                ctx.lineTo(-5, -9 + tailWave);
                ctx.closePath();
                ctx.fill();
              } else if (racer.hatType === 2) {
                // Cool Aviator Sunglasses
                ctx.fillStyle = '#0F172A';
                ctx.fillRect(8, -9.5, 8.5, 3.8);
                ctx.strokeStyle = '#38DDF8';
                ctx.lineWidth = 1;
                ctx.strokeRect(8, -9.5, 8.5, 3.8);
              } else if (racer.hatType === 3) {
                // Captain Sailor Cap
                ctx.fillStyle = '#FFFFFF';
                ctx.strokeStyle = '#0F172A';
                ctx.lineWidth = 1.1;
                ctx.beginPath();
                ctx.roundRect(2.5, -17, 12, 5, 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#0284C7';
                ctx.fillRect(2.5, -13.5, 12, 2);
              } else if (racer.hatType === 4) {
                // Cute Pride Ribbon Bow
                ctx.fillStyle = '#FF6B8A';
                ctx.beginPath();
                ctx.arc(5.5, -14, 2.8, 0, Math.PI * 2);
                ctx.arc(10.5, -14, 2.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFD166';
                ctx.beginPath();
                ctx.arc(8, -14, 1.6, 0, Math.PI * 2);
                ctx.fill();
              }

              ctx.restore();

              // Draw Name Tag
              const showFullTag =
                racers.length <= 18 || isTopLeader || st.mode === 'idle';

              if (showFullTag) {
                const rawName = `#${racer.participant.displayCode} ${racer.participant.name}`;
                const label = rawName.length > 18 ? `${rawName.slice(0, 17)}…` : rawName;
                ctx.font = isTopLeader
                  ? '800 10.5px "Be Vietnam Pro", sans-serif'
                  : '600 9.5px "Be Vietnam Pro", sans-serif';
                const tw = ctx.measureText(label).width;
                const tagX = Math.max(8, duckX - tw - 23 * duckScale);
                const tagY = duckY - 8;

                ctx.fillStyle =
                  isTopLeader && st.mode === 'racing'
                    ? 'rgba(15, 23, 42, 0.92)'
                    : 'rgba(15, 23, 42, 0.74)';
                ctx.strokeStyle =
                  isTopLeader && st.mode === 'racing' ? '#FFD166' : racer.bodyColor;
                ctx.lineWidth = isTopLeader && st.mode === 'racing' ? 1.6 : 1;
                ctx.beginPath();
                ctx.roundRect(tagX, tagY, tw + 10, 17, 5);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle =
                  isTopLeader && st.mode === 'racing' ? '#FFD166' : '#FFFFFF';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, tagX + 5, tagY + 8.5);
              }
            });

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
  }, [reducedMotion]);

  const handleStartRace = () => {
    if (isGameBusy(gameState) || eligible.length === 0) {
      return;
    }

    const outcome = startDraw();
    if (!outcome) return;

    const winner = outcome.primaryWinner;
    const st = engineRef.current;

    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    // Build flock of up to MAX_ACTIVE_DUCKS guaranteed to include the exact DrawEngine winner
    let racePool: Participant[];
    if (eligible.length <= activeDuckLimit) {
      racePool = cryptoShuffle(eligible);
    } else {
      const others = cryptoShuffle(eligible.filter((p) => p.id !== winner.id)).slice(
        0,
        Math.max(1, activeDuckLimit - 1)
      );
      racePool = cryptoShuffle([winner, ...others]);
    }

    st.racers = buildRacers(racePool, winner.id);
    st.winner = winner;
    st.raceTimeNorm = 0;
    st.winnerBounceY = 0;
    st.mode = 'countdown';

    const raceDurationSec = Math.max(4, animationDuration);
    const tl = gsap.timeline();
    timelineRef.current = tl;

    // 3 - 2 - 1 - GO Countdown via GSAP Timeline
    tl.call(() => {
      setCountdownText('3');
      setRacePhaseLabel(`Chuẩn bị xuất phát ${racePool.length} vận động viên vịt!`);
      audioService.playCountdownBeep(false);
    });
    tl.to({}, { duration: 0.55 });
    tl.call(() => {
      setCountdownText('2');
      audioService.playCountdownBeep(false);
    });
    tl.to({}, { duration: 0.55 });
    tl.call(() => {
      setCountdownText('1');
      audioService.playCountdownBeep(false);
    });
    tl.to({}, { duration: 0.55 });
    tl.call(() => {
      setCountdownText('XUẤT PHÁT!');
      audioService.playRaceWhistle();
      setGameState('running');
      const now = performance.now();
      st.lastQuackTime = now;
      st.lastUiSyncTime = now;
      st.mode = 'racing';
    });
    tl.call(
      () => {
        setCountdownText(null);
      },
      undefined,
      '+=0.45'
    );

    // Main GSAP Race Progress Tween (0 -> 1)
    tl.to(
      st,
      {
        raceTimeNorm: 1,
        duration: raceDurationSec,
        ease: 'none',
      },
      '-=0.45'
    );

    // Finish Line Celebration Bounce for Winner Duck!
    tl.call(() => {
      st.mode = 'finished';
      setTopLeaders([winner]);
      setRacePhaseLabel(`🏆 QUÁN QUÂN ĐƯỜNG ĐUA VỊT: #${winner.displayCode} ${winner.name}!`);
      setGameState('revealing');
    });
    tl.to(st, {
      winnerBounceY: 16,
      duration: 0.22,
      yoyo: true,
      repeat: 3,
      ease: 'sine.out',
      onComplete: () => {
        revealWinnerOverlay();
      },
    });
  };

  const busy = isGameBusy(gameState);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-2.5 sm:px-5 py-1.5 sm:py-2 max-w-[1600px] mx-auto w-full gap-2.5">
      {/* Top Telemetry & Live Top Leaderboard Bar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 rounded-2xl arcade-glass border border-amber-400/35">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[11px] sm:text-xs font-bold uppercase shrink-0">
            <Flag className="w-3.5 h-3.5" /> ĐUA VỊT ({idlePool.length})
          </span>
          <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
            {racePhaseLabel}
          </span>
        </div>

        {/* Live Top 3 Leaderboard Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {topLeaders.slice(0, 3).map((leader, idx) => (
            <div
              key={leader.id}
              className={`${idx > 0 ? 'hidden sm:flex' : 'flex'} items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl border text-[11px] sm:text-xs ${
                idx === 0
                  ? 'bg-amber-400/20 border-amber-400/50 text-[#FFD166] font-bold'
                  : 'bg-[#0A0D1C]/80 border-white/10 text-slate-300'
              }`}
            >
              {idx === 0 && <Trophy className="w-3.5 h-3.5 text-[#FFD166] shrink-0" />}
              <span className="font-mono">#{idx + 1}:</span>
              <span className="truncate max-w-[90px] sm:max-w-[110px]">{leader.name}</span>
            </div>
          ))}

          <span className="text-[11px] sm:text-xs font-mono text-slate-300 bg-[#0A0D1C]/80 border border-white/10 px-2.5 py-1 rounded-xl flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-[#38DDF8]" />
            {eligible.length}/{participants.length}
          </span>
        </div>
      </div>

      {/* Main River Race Track Canvas */}
      <div className="relative w-full h-[330px] sm:h-[420px] lg:h-[470px] rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-[#38DDF8]/45 shadow-2xl bg-[#0369A1]">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Countdown Overlay */}
        <AnimatePresence mode="wait">
          {countdownText && (
            <motion.div
              key={countdownText}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center z-20 pointer-events-none"
            >
              <motion.span
                initial={{ scale: 0.35, opacity: 0, rotate: -8 }}
                animate={{ scale: 1.15, opacity: 1, rotate: 0 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                className="font-display font-extrabold text-5xl sm:text-8xl text-[#FFD166] drop-shadow-[0_0_30px_rgba(0,0,0,0.95)]"
              >
                {countdownText}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Action Bar */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2.5 px-1 sm:px-2">
        <p className="text-[11px] sm:text-xs text-slate-300 flex items-center gap-1.5 text-center sm:text-left">
          <Sparkles className="w-4 h-4 text-[#FFD166] shrink-0 hidden sm:inline" />
          <span>
            Đang hiển thị trực tiếp <strong>{idlePool.length}</strong> chú vịt đua trên dòng sông ({eligible.length} người đủ điều kiện).
          </span>
        </p>

        <motion.button
          whileHover={{ scale: busy ? 1 : 1.03 }}
          whileTap={{ scale: busy ? 1 : 0.97 }}
          onClick={handleStartRace}
          disabled={busy}
          className="w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-[#FFD166] via-[#F59E0B] to-[#38DDF8] text-slate-950 font-display font-extrabold text-base sm:text-lg tracking-wide shadow-[0_0_35px_-5px_rgba(255,209,102,0.7)] flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
        >
          <Flag className="w-5 h-5 fill-current" />
          <span>{busy ? 'ĐÀN VỊT ĐANG ĐUA...' : 'THỔI CÒI XUẤT PHÁT'}</span>
        </motion.button>
      </div>
    </div>
  );
};
