import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { Play, Sparkles, Users, Trophy } from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import { Participant } from '../../types/participant';
import { audioService } from '../../services/audio-service';
import { isGameBusy } from '../../engine/game-state-machine';
import { DrawEngine } from '../../engine/draw-engine';
import { cryptoShuffle } from '../../engine/random';

const SLICE_PALETTE = [
  '#8B5CF6', // Electric Purple
  '#38DDF8', // Arcade Cyan
  '#FF6B8A', // Coral
  '#FFD166', // Sunshine Yellow
  '#55E6A5', // Mint
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#F97316', // Orange
];

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const MAX_WHEEL_SLICES = 120;

export const LuckyWheelGame: React.FC = () => {
  const participants = useAppStore((s) => s.participants);
  const excludedIds = useAppStore((s) => s.excludedIds);
  const allowRepeatWinner = useAppStore((s) => s.settings.allowRepeatWinner);
  const animationDuration = useAppStore((s) => s.settings.animationDuration);
  const reducedMotion = useAppStore((s) => s.settings.reducedMotion);
  const gameState = useAppStore((s) => s.gameState);
  const setGameState = useAppStore((s) => s.setGameState);
  const startDraw = useAppStore((s) => s.startDraw);
  const revealWinnerOverlay = useAppStore((s) => s.revealWinnerOverlay);
  const isFullscreen = useAppStore((s) => s.isFullscreen);

  const eligible = useMemo(
    () => DrawEngine.getEligibleParticipants(participants, excludedIds, allowRepeatWinner),
    [participants, excludedIds, allowRepeatWinner]
  );

  const baseSlices = useMemo(() => {
    if (eligible.length <= MAX_WHEEL_SLICES) {
      return eligible;
    }
    const step = eligible.length / MAX_WHEEL_SLICES;
    const sampled: Participant[] = [];
    for (let i = 0; i < MAX_WHEEL_SLICES; i++) {
      sampled.push(eligible[Math.floor(i * step)]);
    }
    return sampled;
  }, [eligible]);

  const [currentPointerPerson, setCurrentPointerPerson] = useState<Participant | null>(
    baseSlices[0] ?? null
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spinTlRef = useRef<gsap.core.Timeline | null>(null);

  const engineRef = useRef<{
    mode: 'idle' | 'spinning' | 'revealing';
    slices: Participant[];
    rotation: number;
    lastSliceIdx: number;
    pegBounce: number;
    ledPhase: number;
    revealPulse: number;
    winner: Participant | null;
    sparks: SparkParticle[];
  }>({
    mode: 'idle',
    slices: baseSlices,
    rotation: 0,
    lastSliceIdx: -1,
    pegBounce: 0,
    ledPhase: 0,
    revealPulse: 0,
    winner: null,
    sparks: [],
  });

  function getSliceIndexAtPointer(rotRad: number, count: number): number {
    if (count <= 0) return 0;
    const sliceAngle = (Math.PI * 2) / count;
    const norm = ((-rotRad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return Math.floor(norm / sliceAngle) % count;
  }

  useEffect(() => {
    if (engineRef.current.mode === 'idle') {
      engineRef.current.slices = baseSlices;
      if (baseSlices.length > 0) {
        const idx = getSliceIndexAtPointer(engineRef.current.rotation, baseSlices.length);
        setCurrentPointerPerson(baseSlices[idx] || baseSlices[0]);
      } else {
        setCurrentPointerPerson(null);
      }
    }
  }, [baseSlices]);

  useEffect(() => {
    if (gameState === 'ready' || gameState === 'idle') {
      if (spinTlRef.current) {
        spinTlRef.current.kill();
        spinTlRef.current = null;
      }
      engineRef.current.mode = 'idle';
      engineRef.current.slices = baseSlices;
      engineRef.current.revealPulse = 0;
    }
  }, [gameState, baseSlices]);

  useEffect(() => {
    return () => {
      if (spinTlRef.current) {
        spinTlRef.current.kill();
      }
    };
  }, []);

  const spawnPegSparks = (x: number, y: number, count: number) => {
    if (reducedMotion) return;
    const colors = ['#FFD166', '#38DDF8', '#FF6B8A', '#55E6A5', '#FFFFFF'];
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * 2.2;
      const speed = 2.2 + Math.random() * 5.5;
      engineRef.current.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 0,
        maxLife: 18 + Math.random() * 16,
        color: colors[i % colors.length],
        size: 2 + Math.random() * 2.5,
      });
    }
  };

  useEffect(() => {
    let rafId = 0;
    let isMounted = true;

    const renderLoop = () => {
      if (!isMounted) return;
      const st = engineRef.current;
      const slices = st.slices;
      const count = Math.max(1, slices.length);

      if (st.mode === 'idle') {
        st.ledPhase += 0.04;
        if (!reducedMotion) {
          st.rotation += 0.0022;
        }
        st.pegBounce *= 0.85;
      } else if (st.mode === 'spinning') {
        st.ledPhase += 0.26;
        const currentIdx = getSliceIndexAtPointer(st.rotation, count);
        if (currentIdx !== st.lastSliceIdx) {
          st.lastSliceIdx = currentIdx;
          st.pegBounce = -0.36;
          audioService.playWheelTick(0.95);
          const person = slices[currentIdx];
          if (person) {
            setCurrentPointerPerson(person);
          }

          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const outerR = Math.min(cx, cy) - 16;
            spawnPegSparks(cx + outerR - 12, cy, 3);
          }
        } else {
          st.pegBounce *= 0.82;
        }
      } else if (st.mode === 'revealing') {
        st.ledPhase += 0.25;
        st.revealPulse += 0.12;
        st.pegBounce *= 0.82;
      }

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
            const cx = w / 2;
            const cy = h / 2;
            const isSmall = w < 380;
            const outerRadius = Math.min(cx, cy) - (isSmall ? 12 : 18);
            const wheelRadius = outerRadius - (isSmall ? 12 : 16);

            ctx.clearRect(0, 0, w, h);

            // Outer Bezel
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#121836';
            ctx.shadowColor = st.mode === 'revealing' ? '#FFD166' : '#8B5CF6';
            ctx.shadowBlur = st.mode === 'revealing' ? 38 : 26;
            ctx.fill();
            ctx.lineWidth = isSmall ? 3 : 4.5;
            ctx.strokeStyle = '#FFD166';
            ctx.stroke();
            ctx.restore();

            // Rim LED Bulbs
            const bulbCount = isSmall ? 24 : 32;
            for (let i = 0; i < bulbCount; i++) {
              const angle = (i / bulbCount) * Math.PI * 2;
              const bx = cx + Math.cos(angle) * (outerRadius - (isSmall ? 6 : 8));
              const by = cy + Math.sin(angle) * (outerRadius - (isSmall ? 6 : 8));
              const isLit = (i + Math.floor(st.ledPhase)) % 2 === 0;

              ctx.beginPath();
              ctx.arc(bx, by, isLit ? (isSmall ? 3 : 4.2) : 2.5, 0, Math.PI * 2);
              ctx.fillStyle = isLit ? (i % 4 === 0 ? '#38DDF8' : '#FFD166') : '#334155';
              ctx.fill();
            }

            // Wheel Slices
            const sliceAngle = (Math.PI * 2) / count;
            const activeIdx = getSliceIndexAtPointer(st.rotation, count);

            for (let i = 0; i < count; i++) {
              const startAngle = st.rotation + i * sliceAngle;
              const endAngle = startAngle + sliceAngle;
              const color = SLICE_PALETTE[i % SLICE_PALETTE.length];
              const isWinningSlice = i === activeIdx && st.mode === 'revealing';

              ctx.save();
              ctx.beginPath();
              ctx.moveTo(cx, cy);
              ctx.arc(cx, cy, isWinningSlice ? wheelRadius + 5 : wheelRadius, startAngle, endAngle);
              ctx.closePath();

              ctx.fillStyle = color;
              ctx.fill();

              if (isWinningSlice) {
                ctx.fillStyle = `rgba(255, 255, 255, ${0.28 + Math.sin(st.revealPulse) * 0.22})`;
                ctx.fill();
                ctx.lineWidth = 2.8;
                ctx.strokeStyle = '#FFFFFF';
                ctx.stroke();
              } else {
                ctx.lineWidth = count > 60 ? 0.5 : count > 30 ? 1 : 1.8;
                ctx.strokeStyle = '#0F152B';
                ctx.stroke();
              }

              const item = slices[i];
              if (item) {
                ctx.translate(cx, cy);
                ctx.rotate(startAngle + sliceAngle / 2);
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';

                const baseFont = count > 80 ? 8 : count > 50 ? 9.5 : count > 28 ? 11 : 13;
                const fontSize = isSmall ? Math.max(7.5, baseFont - 1.5) : baseFont;
                ctx.font = `${isWinningSlice ? '800' : '700'} ${fontSize}px "Be Vietnam Pro", sans-serif`;
                const isLightBg =
                  color === '#FFD166' || color === '#55E6A5' || color === '#38DDF8';
                ctx.fillStyle = isLightBg ? '#0A0D1C' : '#FFFFFF';

                const maxChars = isSmall ? 12 : count > 60 ? 12 : count > 30 ? 15 : 20;
                const displayTxt =
                  item.name.length > maxChars ? `${item.name.slice(0, maxChars - 1)}…` : item.name;
                ctx.fillText(displayTxt, wheelRadius - 12, 0);
              }
              ctx.restore();

              if (count <= 70 || i % 2 === 0) {
                const pegX = cx + Math.cos(startAngle) * (wheelRadius - 2);
                const pegY = cy + Math.sin(startAngle) * (wheelRadius - 2);
                ctx.beginPath();
                ctx.arc(pegX, pegY, count > 50 ? 1.8 : 2.6, 0, Math.PI * 2);
                ctx.fillStyle = '#FFFFFF';
                ctx.fill();
              }
            }

            // 3D Glossy Inner Ring Overlay on Wheel
            ctx.save();
            const glossGrad = ctx.createRadialGradient(
              cx - wheelRadius * 0.25,
              cy - wheelRadius * 0.25,
              wheelRadius * 0.1,
              cx,
              cy,
              wheelRadius
            );
            glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
            glossGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0)');
            glossGrad.addColorStop(1, 'rgba(10, 13, 28, 0.24)');
            ctx.fillStyle = glossGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, wheelRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Center Hub Cap
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, wheelRadius * 0.19, 0, Math.PI * 2);
            const hubGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, wheelRadius * 0.19);
            hubGrad.addColorStop(0, '#3B0764');
            hubGrad.addColorStop(1, '#10152B');
            ctx.fillStyle = hubGrad;
            ctx.fill();
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = '#FFD166';
            ctx.stroke();
            ctx.restore();

            // Sparks
            for (let s = st.sparks.length - 1; s >= 0; s--) {
              const sp = st.sparks[s];
              sp.x += sp.vx;
              sp.y += sp.vy;
              sp.vy += 0.15;
              sp.life++;
              if (sp.life >= sp.maxLife) {
                st.sparks.splice(s, 1);
                continue;
              }
              const alpha = 1 - sp.life / sp.maxLife;
              ctx.save();
              ctx.globalAlpha = alpha;
              ctx.fillStyle = sp.color;
              ctx.beginPath();
              ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }

            // Pointer Arrow
            ctx.save();
            const pointerX = cx + outerRadius + 6;
            const pointerY = cy;
            ctx.translate(pointerX, pointerY);
            ctx.rotate(st.pegBounce);

            ctx.beginPath();
            ctx.moveTo(isSmall ? -28 : -36, 0);
            ctx.lineTo(4, isSmall ? -12 : -15);
            ctx.lineTo(12, 0);
            ctx.lineTo(4, isSmall ? 12 : 15);
            ctx.closePath();
            ctx.fillStyle = '#FF6B8A';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#FFD166';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = '#FFD166';
            ctx.fill();
            ctx.restore();

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

  const handleSpin = () => {
    if (isGameBusy(gameState) || eligible.length === 0) {
      return;
    }

    const outcome = startDraw();
    if (!outcome) return;

    const winner = outcome.primaryWinner;
    const st = engineRef.current;

    if (spinTlRef.current) {
      spinTlRef.current.kill();
    }

    let activeSlices = [...baseSlices];
    let targetSliceIndex = activeSlices.findIndex((p) => p.id === winner.id);
    if (targetSliceIndex === -1) {
      activeSlices = cryptoShuffle([
        winner,
        ...eligible.filter((p) => p.id !== winner.id).slice(0, MAX_WHEEL_SLICES - 1),
      ]);
      targetSliceIndex = activeSlices.findIndex((p) => p.id === winner.id);
    }

    const count = activeSlices.length;
    const sliceAngle = (Math.PI * 2) / count;
    const innerOffset = 0.25 + (winner.avatarSeed % 50) * 0.01;
    const targetSliceAngle = (targetSliceIndex + innerOffset) * sliceAngle;

    const currentRot = st.rotation;
    const currentNorm = ((currentRot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const desiredNorm =
      (((Math.PI * 2 - targetSliceAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    let delta = desiredNorm - currentNorm;
    if (delta <= 0) delta += Math.PI * 2;

    const fullSpins = reducedMotion ? 4 : Math.max(6, Math.round(animationDuration * 1.45));
    const finalRotation = currentRot + fullSpins * Math.PI * 2 + delta;

    st.slices = activeSlices;
    st.winner = winner;
    st.lastSliceIdx = getSliceIndexAtPointer(currentRot, count);
    st.revealPulse = 0;
    st.mode = 'spinning';

    setGameState('running');

    const totalSec = Math.max(3.2, animationDuration);
    const tl = gsap.timeline();
    spinTlRef.current = tl;

    // Slight wind-up back-spin followed by ultra-smooth power4.out deceleration
    tl.to(st, {
      rotation: currentRot - 0.24,
      duration: totalSec * 0.07,
      ease: 'power2.inOut',
    });
    tl.to(st, {
      rotation: finalRotation,
      duration: totalSec * 0.93,
      ease: 'power4.out',
      onComplete: () => {
        st.rotation = finalRotation;
        st.pegBounce = 0;
        st.mode = 'revealing';
        st.revealPulse = 0;
        setCurrentPointerPerson(winner);
        setGameState('revealing');

        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          spawnPegSparks(
            rect.width / 2 + Math.min(rect.width, rect.height) / 2 - 26,
            rect.height / 2,
            26
          );
        }

        window.setTimeout(() => {
          revealWinnerOverlay();
        }, 850);
      },
    });
  };

  const busy = isGameBusy(gameState);

  return (
    <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-8 px-3 sm:px-6 py-2 max-w-[1550px] mx-auto w-full">
      {/* Left/Center: Wheel Canvas (Responsive for Mobile, Tablet & Desktop) */}
      <div className="relative flex items-center justify-center w-full max-w-[330px] sm:max-w-[460px] lg:max-w-[560px] aspect-square shrink-0">
        <canvas ref={canvasRef} className="w-full h-full block select-none" />

        {/* Center Spin Hub Button */}
        <motion.button
          whileHover={{ scale: busy ? 1 : 1.08 }}
          whileTap={{ scale: busy ? 1 : 0.94 }}
          onClick={handleSpin}
          disabled={busy}
          className="absolute w-16 h-16 sm:w-22 sm:h-22 lg:w-24 lg:h-24 rounded-full bg-gradient-to-br from-[#8B5CF6] via-[#EC4899] to-[#FFD166] p-1 shadow-[0_0_35px_rgba(255,209,102,0.75)] disabled:opacity-60 disabled:cursor-not-allowed"
          title="Nhấn để quay vòng quay may mắn"
        >
          <div className="w-full h-full rounded-full bg-[#10152B] flex flex-col items-center justify-center text-white">
            <Play className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFD166] fill-current mb-0.5" />
            <span className="font-display font-bold text-[10px] sm:text-[11px] tracking-wider text-[#FFD166]">
              QUAY
            </span>
          </div>
        </motion.button>
      </div>

      {/* Right Control & Live Readout Panel */}
      <div className="w-full max-w-md flex flex-col gap-3">
        <div className="rounded-2xl sm:rounded-3xl arcade-glass border border-white/15 p-4 sm:p-6 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-[11px] sm:text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-[#FFD166]" /> VÒNG QUAY MAY MẮN
            </span>
            <span className="text-[11px] sm:text-xs font-mono text-slate-300 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#38DDF8]" />
              Số ô: <strong className="text-[#FFD166]">{baseSlices.length}</strong> ({eligible.length})
            </span>
          </div>

          {/* Live Pointer Readout */}
          <div className="p-3.5 sm:p-5 rounded-2xl bg-[#0A0D1C]/90 border-2 border-purple-500/30 text-center space-y-1 shadow-inner overflow-hidden">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-widest text-slate-400 font-semibold flex items-center justify-center gap-1.5">
              {gameState === 'revealing' ? (
                <>
                  <Trophy className="w-3.5 h-3.5 text-[#FFD166]" /> KẾT QUẢ DỪNG TẠI Ô:
                </>
              ) : busy ? (
                'Kim chỉ đang lướt qua...'
              ) : (
                'Kim chỉ hiện tại'
              )}
            </p>
            <div className="min-h-[52px] sm:min-h-[58px] flex flex-col items-center justify-center">
              <AnimatePresence mode="popLayout">
                {currentPointerPerson ? (
                  <motion.div
                    key={currentPointerPerson.id}
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.14 }}
                    className="flex flex-col items-center"
                  >
                    <span className="font-mono text-[11px] sm:text-xs px-2.5 py-0.5 rounded-full bg-[#38DDF8]/15 text-[#38DDF8] border border-[#38DDF8]/30">
                      MÃ #{currentPointerPerson.displayCode}
                    </span>
                    <p className="font-display text-xl sm:text-3xl font-extrabold text-[#FFD166] truncate max-w-[280px] sm:max-w-[340px] mt-1">
                      {currentPointerPerson.name}
                    </p>
                  </motion.div>
                ) : (
                  <span className="text-sm text-slate-400">Nhấn nút QUAY NGAY để bắt đầu</span>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Main Spin CTA */}
          <motion.button
            whileHover={{ scale: busy ? 1 : 1.02 }}
            whileTap={{ scale: busy ? 1 : 0.98 }}
            onClick={handleSpin}
            disabled={busy}
            className="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#FFD166] text-slate-950 font-display font-extrabold text-base sm:text-xl tracking-wide shadow-[0_0_35px_-5px_rgba(236,72,153,0.65)] flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
            <span>{busy ? 'VÒNG QUAY ĐANG CHẠY...' : 'QUAY NGAY'}</span>
          </motion.button>
        </div>

        {!isFullscreen && (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-2.5 text-xs text-slate-300 flex items-center justify-between">
            <span>
              Thời lượng: <strong>{animationDuration} giây</strong>
            </span>
            <span>
              Chế độ: <strong>{allowRepeatWinner ? 'Có thể trúng lại' : 'Không lặp lại'}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
