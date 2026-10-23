import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Sparkles, RotateCcw, Users } from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import { audioService } from '../../services/audio-service';
import { isGameBusy } from '../../engine/game-state-machine';
import { ParticipantAvatarSvg } from '../../components/shared/ParticipantAvatarSvg';

const BOX_COLORS = [
  { body: '#FF6B8A', lid: '#F43F5E', ribbon: '#FFD166', glow: 'rgba(255,107,138,0.45)' },
  { body: '#8B5CF6', lid: '#7C3AED', ribbon: '#38DDF8', glow: 'rgba(139,92,246,0.45)' },
  { body: '#38DDF8', lid: '#0284C7', ribbon: '#FFD166', glow: 'rgba(56,221,248,0.45)' },
  { body: '#55E6A5', lid: '#10B981', ribbon: '#8B5CF6', glow: 'rgba(85,230,165,0.45)' },
  { body: '#F59E0B', lid: '#D97706', ribbon: '#FFFBEB', glow: 'rgba(245,158,11,0.45)' },
];

export const MysteryBoxGame: React.FC = () => {
  const getEligibleParticipants = useAppStore((s) => s.getEligibleParticipants);
  const participants = useAppStore((s) => s.participants);
  const gameState = useAppStore((s) => s.gameState);
  const setGameState = useAppStore((s) => s.setGameState);
  const startDraw = useAppStore((s) => s.startDraw);
  const revealWinnerOverlay = useAppStore((s) => s.revealWinnerOverlay);
  const currentOutcome = useAppStore((s) => s.currentOutcome);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const eligible = getEligibleParticipants();
  const boxCount = settings.mysteryBoxCount || 9;

  const [scanningBoxIndex, setScanningBoxIndex] = useState<number | null>(null);
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | null>(null);
  const [openedBoxes, setOpenedBoxes] = useState<Record<number, string>>({});
  const [boxStagePhase, setBoxStagePhase] = useState<'idle' | 'shaking' | 'burst'>('idle');

  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    setOpenedBoxes({});
    setSelectedBoxIndex(null);
    setScanningBoxIndex(null);
    setBoxStagePhase('idle');
  }, [boxCount]);

  useEffect(() => {
    if (gameState === 'ready' || gameState === 'idle') {
      setSelectedBoxIndex(null);
      setScanningBoxIndex(null);
      setBoxStagePhase('idle');
    }
  }, [gameState]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const triggerBoxOpeningSequence = (targetIndex: number) => {
    if (isGameBusy(gameState) || eligible.length === 0) return;
    clearTimers();

    const outcome = startDraw();
    if (!outcome) return;

    setGameState('running');

    // Rapid spotlight scan across unopened boxes before settling on targetIndex
    const unopenedIndices = Array.from({ length: boxCount }, (_, i) => i).filter(
      (i) => !openedBoxes[i]
    );
    const poolToScan = unopenedIndices.length > 0 ? unopenedIndices : [targetIndex];

    const totalScanTime = Math.max(1600, (settings.animationDuration - 2) * 650);
    const steps = 14;
    const stepMs = totalScanTime / steps;

    for (let s = 0; s < steps; s++) {
      const t = window.setTimeout(() => {
        const pick = s === steps - 1 ? targetIndex : poolToScan[s % poolToScan.length];
        setScanningBoxIndex(pick);
        audioService.playWheelTick(0.9 + (s / steps) * 0.4);
      }, s * stepMs);
      timersRef.current.push(t);
    }

    // Center & Shake the chosen box
    const tShake = window.setTimeout(() => {
      setScanningBoxIndex(null);
      setSelectedBoxIndex(targetIndex);
      setBoxStagePhase('shaking');
      audioService.playBoxShake();
    }, totalScanTime + 150);

    // Burst lid open & reveal winner inside
    const tBurst = window.setTimeout(() => {
      setBoxStagePhase('burst');
      setGameState('revealing');
      audioService.playBoxOpenMagic();
      setOpenedBoxes((prev) => ({
        ...prev,
        [targetIndex]: outcome.primaryWinner.name,
      }));
    }, totalScanTime + 1350);

    // Transition to Grand Winner Overlay
    const tOverlay = window.setTimeout(() => {
      revealWinnerOverlay();
    }, totalScanTime + 2650);

    timersRef.current.push(tShake, tBurst, tOverlay);
  };

  const handleRandomDrawClick = () => {
    const unopened = Array.from({ length: boxCount }, (_, i) => i).filter((i) => !openedBoxes[i]);
    const pool = unopened.length > 0 ? unopened : Array.from({ length: boxCount }, (_, i) => i);
    if (unopened.length === 0) {
      setOpenedBoxes({});
    }
    const randomBoxIdx = pool[Math.floor(Math.random() * pool.length)];
    triggerBoxOpeningSequence(randomBoxIdx);
  };

  const busy = isGameBusy(gameState);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-3 max-w-6xl mx-auto w-full">
      <div className="relative w-full rounded-3xl arcade-glass border border-pink-400/30 p-5 sm:p-8 shadow-2xl overflow-hidden">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/35 text-rose-200 text-xs font-bold uppercase tracking-wider">
              <Gift className="w-3.5 h-3.5 text-[#FFD166]" /> KHO BÁU HỘP QUÀ BÍ ẨN
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-[#0A0D1C]/80 border border-white/10 rounded-xl px-3 py-1 text-xs">
              <span className="text-slate-400">Số hộp:</span>
              {[6, 9, 12, 16].map((cnt) => (
                <button
                  key={cnt}
                  disabled={busy}
                  onClick={() => updateSettings({ mysteryBoxCount: cnt })}
                  className={`px-2 py-0.5 rounded font-mono font-bold ${
                    boxCount === cnt ? 'bg-[#FF6B8A] text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>

            {Object.keys(openedBoxes).length > 0 && !busy && (
              <button
                onClick={() => setOpenedBoxes({})}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-amber-300"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đóng lại tất cả hộp</span>
              </button>
            )}

            <span className="text-xs font-mono text-slate-300 bg-[#0A0D1C]/80 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#FF6B8A]" />
              {eligible.length}/{participants.length}
            </span>
          </div>
        </div>

        {/* Grid of Floating Mystery Boxes */}
        <div
          className={`grid gap-3 sm:gap-4 my-2 ${
            boxCount <= 6
              ? 'grid-cols-2 sm:grid-cols-3'
              : boxCount <= 9
              ? 'grid-cols-3'
              : 'grid-cols-3 sm:grid-cols-4'
          }`}
        >
          {Array.from({ length: boxCount }, (_, idx) => {
            const palette = BOX_COLORS[idx % BOX_COLORS.length];
            const isScanning = scanningBoxIndex === idx;
            const openedWinnerName = openedBoxes[idx];
            const isOpened = Boolean(openedWinnerName);

            return (
              <motion.button
                key={idx}
                onClick={() => !busy && triggerBoxOpeningSequence(idx)}
                disabled={busy}
                animate={
                  isScanning
                    ? { scale: 1.08, y: -6 }
                    : !settings.reducedMotion && !isOpened
                    ? { y: [0, -5, 0] }
                    : {}
                }
                transition={{
                  duration: isScanning ? 0.15 : 2.6 + (idx % 4) * 0.35,
                  repeat: isScanning ? 0 : Infinity,
                  ease: 'easeInOut',
                }}
                whileHover={!busy ? { scale: 1.05, y: -4 } : {}}
                className={`relative group rounded-2xl p-4 flex flex-col items-center justify-center min-h-[125px] sm:min-h-[145px] border transition-all ${
                  isScanning
                    ? 'bg-gradient-to-b from-amber-400/30 to-purple-900/50 border-[#FFD166] shadow-[0_0_30px_rgba(255,209,102,0.75)]'
                    : isOpened
                    ? 'bg-[#0A0D1C]/65 border-white/10 opacity-75'
                    : 'bg-[#141C3A]/85 hover:bg-[#1B254B] border-white/15'
                }`}
              >
                {/* Box Number Tag */}
                <span className="absolute top-2.5 left-3 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-black/40 text-slate-300 border border-white/10">
                  HỘP #{String(idx + 1).padStart(2, '0')}
                </span>

                {/* Custom SVG Gift Box */}
                <svg width="68" height="68" viewBox="0 0 80 80" fill="none" className="drop-shadow-lg">
                  {isOpened ? (
                    <>
                      {/* Opened Box Base */}
                      <rect x="18" y="42" width="44" height="28" rx="4" fill={palette.body} opacity="0.6" />
                      <rect x="36" y="42" width="8" height="28" fill={palette.ribbon} opacity="0.6" />
                      {/* Tilted Open Lid */}
                      <g transform="rotate(-28 18 36)">
                        <rect x="14" y="26" width="52" height="12" rx="3" fill={palette.lid} opacity="0.7" />
                      </g>
                      <circle cx="40" cy="34" r="10" fill="#FFD166" fillOpacity="0.25" />
                      <path d="M35 34L39 38L46 30" stroke="#55E6A5" strokeWidth="3" strokeLinecap="round" />
                    </>
                  ) : (
                    <>
                      {/* Closed Box Base */}
                      <rect
                        x="18"
                        y="36"
                        width="44"
                        height="34"
                        rx="5"
                        fill={palette.body}
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                      {/* Vertical Ribbon */}
                      <rect x="36" y="24" width="8" height="46" fill={palette.ribbon} />
                      {/* Horizontal Ribbon */}
                      <rect x="18" y="49" width="44" height="7" fill={palette.ribbon} />
                      {/* Box Lid */}
                      <rect
                        x="14"
                        y="24"
                        width="52"
                        height="13"
                        rx="4"
                        fill={palette.lid}
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                      {/* Ribbon Bow */}
                      <path
                        d="M40 24C31 12 22 18 31 24H40Z"
                        fill={palette.ribbon}
                        stroke="#10152B"
                        strokeWidth="1.2"
                      />
                      <path
                        d="M40 24C49 12 58 18 49 24H40Z"
                        fill={palette.ribbon}
                        stroke="#10152B"
                        strokeWidth="1.2"
                      />
                    </>
                  )}
                </svg>

                <span className="mt-2 text-xs font-semibold truncate max-w-full px-2">
                  {isOpened ? (
                    <span className="text-amber-300">★ {openedWinnerName}</span>
                  ) : (
                    <span className="text-slate-300 group-hover:text-[#FFD166] transition-colors">
                      Nhấn để khui quà
                    </span>
                  )}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Center Stage Box Opening Spotlight Modal */}
        <AnimatePresence>
          {selectedBoxIndex !== null && currentOutcome && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-[#0A0D1C]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
            >
              <p className="font-mono text-xs uppercase tracking-widest text-[#FFD166] mb-3">
                {boxStagePhase === 'shaking'
                  ? `ĐANG MỞ HỘP QUÀ SỐ #${String(selectedBoxIndex + 1).padStart(2, '0')}...`
                  : '✨ KHO BÁU ĐÃ MỞ RA! ✨'}
              </p>

              {boxStagePhase === 'shaking' ? (
                <motion.div
                  animate={{
                    rotate: [-8, 8, -10, 10, -6, 6, 0],
                    scale: [1, 1.12, 1.06, 1.18, 1.22],
                  }}
                  transition={{ duration: 1.1 }}
                  className="my-4"
                >
                  <svg width="150" height="150" viewBox="0 0 80 80" fill="none">
                    <circle cx="40" cy="42" r="36" fill="rgba(255,209,102,0.22)" />
                    <rect x="18" y="36" width="44" height="34" rx="5" fill="#FF6B8A" stroke="#FFD166" strokeWidth="2" />
                    <rect x="36" y="24" width="8" height="46" fill="#FFD166" />
                    <rect x="14" y="24" width="52" height="13" rx="4" fill="#F43F5E" stroke="#FFD166" strokeWidth="2" />
                  </svg>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0.4, y: 30, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  transition={{ type: 'spring', damping: 16, stiffness: 220 }}
                  className="flex flex-col items-center space-y-3 my-2"
                >
                  <ParticipantAvatarSvg
                    seed={currentOutcome.primaryWinner.avatarSeed}
                    size={108}
                    expression="celebrating"
                  />
                  <span className="font-mono text-xs px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                    MÃ SỐ #{currentOutcome.primaryWinner.displayCode}
                  </span>
                  <h3 className="font-display text-3xl sm:text-5xl font-extrabold text-[#FFD166]">
                    {currentOutcome.primaryWinner.name}
                  </h3>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom CTA Button */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
          <motion.button
            whileHover={{ scale: busy ? 1 : 1.03 }}
            whileTap={{ scale: busy ? 1 : 0.97 }}
            onClick={handleRandomDrawClick}
            disabled={busy}
            className="px-10 py-4 rounded-2xl bg-gradient-to-r from-[#FF6B8A] via-[#EC4899] to-[#FFD166] text-slate-950 font-display font-extrabold text-lg sm:text-xl tracking-wide shadow-[0_0_35px_-5px_rgba(255,107,138,0.65)] flex items-center gap-2.5 disabled:opacity-50"
          >
            <Sparkles className="w-6 h-6" />
            <span>{busy ? 'ĐANG MỞ HỘP QUÀ...' : 'BẮT HỘP QUÀ NGẪU NHIÊN'}</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

