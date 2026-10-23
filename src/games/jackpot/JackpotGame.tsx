import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Zap, RotateCcw, Play, Palette, Users } from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import { JackpotTheme } from '../../types/game';
import { audioService } from '../../services/audio-service';
import { isGameBusy } from '../../engine/game-state-machine';
import { ParticipantAvatarSvg } from '../../components/shared/ParticipantAvatarSvg';
import { Participant } from '../../types/participant';

type ArcadeSymbolId = 'star' | 'diamond' | 'bolt' | 'crown' | 'seven';

const SYMBOLS: { id: ArcadeSymbolId; label: string; color: string }[] = [
  { id: 'star', label: 'NGÔI SAO', color: '#FFD166' },
  { id: 'diamond', label: 'KIM CƯƠNG', color: '#38DDF8' },
  { id: 'bolt', label: 'TIA CHỚP', color: '#55E6A5' },
  { id: 'crown', label: 'VƯƠNG MIỆN', color: '#FF6B8A' },
  { id: 'seven', label: 'LUCKY 777', color: '#8B5CF6' },
];

const THEME_CONFIG: Record<
  JackpotTheme,
  { name: string; border: string; glow: string; headerBg: string; accent: string }
> = {
  'cyber-neon': {
    name: 'Cyber Neon',
    border: 'border-[#8B5CF6]',
    glow: 'shadow-[0_0_75px_-12px_rgba(139,92,246,0.55)]',
    headerBg: 'from-[#8B5CF6] via-[#EC4899] to-[#38DDF8]',
    accent: '#38DDF8',
  },
  'royal-gold': {
    name: 'Royal Gold',
    border: 'border-[#FFD166]',
    glow: 'shadow-[0_0_75px_-12px_rgba(255,209,102,0.55)]',
    headerBg: 'from-amber-400 via-yellow-500 to-orange-500',
    accent: '#FFD166',
  },
  'cosmic-arcade': {
    name: 'Cosmic Arcade',
    border: 'border-[#55E6A5]',
    glow: 'shadow-[0_0_75px_-12px_rgba(85,230,165,0.55)]',
    headerBg: 'from-emerald-400 via-teal-500 to-cyan-500',
    accent: '#55E6A5',
  },
};

const ArcadeSymbolSvg: React.FC<{ id: ArcadeSymbolId }> = ({ id }) => {
  switch (id) {
    case 'star':
      return (
        <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
          <polygon
            points="32,6 39,22 57,24 43,36 47,54 32,44 17,54 21,36 7,24 25,22"
            fill="#FFD166"
            stroke="#FFFFFF"
            strokeWidth="2.5"
          />
        </svg>
      );
    case 'diamond':
      return (
        <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
          <polygon
            points="18,12 46,12 56,26 32,54 8,26"
            fill="#38DDF8"
            stroke="#FFFFFF"
            strokeWidth="2.5"
          />
          <line x1="8" y1="26" x2="56" y2="26" stroke="#FFFFFF" strokeWidth="2" />
        </svg>
      );
    case 'bolt':
      return (
        <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
          <polygon
            points="36,6 14,34 30,34 24,58 50,28 34,28"
            fill="#55E6A5"
            stroke="#FFFFFF"
            strokeWidth="2.5"
          />
        </svg>
      );
    case 'crown':
      return (
        <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
          <polygon
            points="10,48 14,20 26,32 32,16 38,32 50,20 54,48"
            fill="#FF6B8A"
            stroke="#FFD166"
            strokeWidth="2.5"
          />
        </svg>
      );
    case 'seven':
      return (
        <div className="font-display font-extrabold text-5xl text-transparent bg-clip-text bg-gradient-to-b from-[#FFD166] to-[#FF6B8A] drop-shadow">
          777
        </div>
      );
  }
};

export const JackpotGame: React.FC = () => {
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
  const theme = THEME_CONFIG[settings.jackpotTheme || 'cyber-neon'];

  const [reelSymbols, setReelSymbols] = useState<[ArcadeSymbolId, ArcadeSymbolId, ArcadeSymbolId]>([
    'seven',
    'star',
    'diamond',
  ]);
  const [reelLocked, setReelLocked] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [leverPulled, setLeverPulled] = useState(false);
  const [rollingParticipant, setRollingParticipant] = useState<Participant | null>(null);

  const timersRef = useRef<number[]>([]);
  const spinIntervalRef = useRef<number | null>(null);

  const clearAllTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
    if (spinIntervalRef.current !== null) {
      clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  const handlePullJackpot = () => {
    if (isGameBusy(gameState) || eligible.length === 0) return;
    clearAllTimers();

    const outcome = startDraw();
    if (!outcome) return;

    const winner = outcome.primaryWinner;
    const winningSymbol = SYMBOLS[winner.avatarSeed % SYMBOLS.length].id;

    setLeverPulled(true);
    setTimeout(() => setLeverPulled(false), 450);

    setReelLocked([false, false, false]);
    setGameState('running');

    const localLocked: [boolean, boolean, boolean] = [false, false, false];

    spinIntervalRef.current = window.setInterval(() => {
      setReelSymbols((prev) => [
        localLocked[0] ? prev[0] : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].id,
        localLocked[1] ? prev[1] : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].id,
        localLocked[2] ? prev[2] : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].id,
      ]);

      const randomCandidate = eligible[Math.floor(Math.random() * eligible.length)];
      if (randomCandidate) setRollingParticipant(randomCandidate);
      audioService.playReelSpinTick();
    }, 75);

    const totalMs = Math.max(2700, settings.animationDuration * 1000);
    const stepMs = totalMs / 3;

    [0, 1, 2].forEach((reelIdx) => {
      const t = window.setTimeout(() => {
        localLocked[reelIdx] = true;
        setReelLocked([...localLocked] as [boolean, boolean, boolean]);
        setReelSymbols((prev) => {
          const next = [...prev] as [ArcadeSymbolId, ArcadeSymbolId, ArcadeSymbolId];
          next[reelIdx] = winningSymbol;
          return next;
        });
        audioService.playReelStop(reelIdx);

        if (reelIdx === 2) {
          if (spinIntervalRef.current !== null) {
            clearInterval(spinIntervalRef.current);
            spinIntervalRef.current = null;
          }
          setRollingParticipant(winner);
          setGameState('revealing');

          const tReveal = window.setTimeout(() => {
            revealWinnerOverlay();
          }, 950);
          timersRef.current.push(tReveal);
        }
      }, stepMs * (reelIdx + 1));

      timersRef.current.push(t);
    });
  };

  const busy = isGameBusy(gameState);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-3 max-w-5xl mx-auto w-full">
      {/* Arcade Cabinet Frame */}
      <div
        className={`relative w-full rounded-3xl arcade-glass border-2 ${theme.border} ${theme.glow} p-5 sm:p-8 overflow-hidden`}
      >
        {/* Top Controls & Theme Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div
            className={`px-4 py-1.5 rounded-full bg-gradient-to-r ${theme.headerBg} text-slate-950 font-display font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5 shadow`}
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>SUPER JACKPOT ARCADE</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#0A0D1C]/80 border border-white/10 rounded-xl px-2.5 py-1 text-xs">
              <Palette className="w-3.5 h-3.5 text-purple-300 mr-1" />
              {(['cyber-neon', 'royal-gold', 'cosmic-arcade'] as JackpotTheme[]).map((tKey) => (
                <button
                  key={tKey}
                  disabled={busy}
                  onClick={() => updateSettings({ jackpotTheme: tKey })}
                  className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                    settings.jackpotTheme === tKey
                      ? 'bg-white text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {THEME_CONFIG[tKey].name}
                </button>
              ))}
            </div>

            <span className="text-xs font-mono text-slate-300 bg-[#0A0D1C]/80 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#55E6A5]" />
              {eligible.length}/{participants.length}
            </span>
          </div>
        </div>

        {/* Chasing Light Bulb Marquee */}
        <div className="flex items-center justify-between px-4 py-2 rounded-2xl bg-[#0A0D1C] border border-white/10 mb-5">
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i % 2 === 0
                  ? 'bg-[#FFD166] shadow-[0_0_8px_#FFD166]'
                  : 'bg-[#FF6B8A] shadow-[0_0_8px_#FF6B8A]'
              } ${busy ? 'animate-ping' : ''}`}
            />
          ))}
        </div>

        {/* 3 Vertical Reels + Arcade Lever */}
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <div className="grid grid-cols-3 gap-3 sm:gap-5 flex-1 max-w-2xl">
            {reelSymbols.map((symId, idx) => {
              const isLocked = reelLocked[idx];
              const symMeta = SYMBOLS.find((s) => s.id === symId) || SYMBOLS[0];

              return (
                <motion.div
                  key={idx}
                  animate={
                    isLocked
                      ? { scale: [1.08, 1] }
                      : gameState === 'running'
                      ? { y: [-6, 6, -4, 4, 0] }
                      : {}
                  }
                  transition={{
                    duration: isLocked ? 0.22 : 0.16,
                    repeat: gameState === 'running' && !isLocked ? Infinity : 0,
                  }}
                  className={`relative h-36 sm:h-44 rounded-2xl bg-gradient-to-b from-[#080B18] via-[#131B3A] to-[#080B18] border-2 flex flex-col items-center justify-center p-4 shadow-inner ${
                    isLocked
                      ? 'border-[#FFD166] shadow-[0_0_25px_rgba(255,209,102,0.45)]'
                      : 'border-white/15'
                  }`}
                >
                  <ArcadeSymbolSvg id={symId} />
                  <span
                    className="mt-2 font-mono text-[10px] sm:text-xs font-bold tracking-wider"
                    style={{ color: symMeta.color }}
                  >
                    {symMeta.label}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Interactive Mechanical Arcade Lever on Desktop */}
          <div className="hidden sm:flex flex-col items-center justify-center pl-2">
            <button
              onClick={handlePullJackpot}
              disabled={busy}
              className="group relative h-40 w-12 flex flex-col items-center justify-end cursor-pointer disabled:cursor-not-allowed"
              title="Giật cần quay Jackpot"
            >
              {/* Lever Shaft */}
              <motion.div
                animate={leverPulled ? { height: 45, y: 40 } : { height: 110, y: 0 }}
                className="w-3 bg-gradient-to-b from-slate-200 to-slate-500 rounded-full origin-bottom"
              />
              {/* Lever Ball Knob */}
              <motion.div
                animate={leverPulled ? { y: 65, scale: 1.1 } : { y: -95 }}
                className="absolute w-11 h-11 rounded-full bg-gradient-to-br from-[#FF6B8A] to-rose-700 border-2 border-white shadow-[0_0_20px_#FF6B8A] group-hover:scale-110 transition-transform"
              />
              {/* Base Mount */}
              <div className="w-10 h-8 rounded-xl bg-slate-700 border border-white/20" />
            </button>
          </div>
        </div>

        {/* Big Jumbo Winner Display Screen */}
        <div className="mt-6 max-w-2xl mx-auto rounded-2xl bg-[#080B18] border-2 border-amber-400/40 p-4 sm:p-5 text-center shadow-inner min-h-[105px] flex flex-col items-center justify-center">
          {rollingParticipant ? (
            <div className="flex flex-col sm:flex-row items-center gap-3.5">
              <ParticipantAvatarSvg
                seed={rollingParticipant.avatarSeed}
                size={58}
                expression={gameState === 'revealing' ? 'celebrating' : 'normal'}
              />
              <div className="text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-amber-400/20 text-[#FFD166] font-bold">
                    #{rollingParticipant.displayCode}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    {gameState === 'revealing' ? '🎉 NỔ HŨ JACKPOT CHIẾN THẮNG! 🎉' : 'Đang quay trục thưởng...'}
                  </span>
                </div>
                <h3 className="font-display text-2xl sm:text-4xl font-extrabold text-white mt-1">
                  {rollingParticipant.name}
                </h3>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-display text-lg sm:text-xl font-bold text-[#FFD166]">
                MÀN HÌNH VINH DANH SUPER JACKPOT
              </p>
              <p className="text-xs text-slate-400">
                Nhấn nút GIẬT CẦN QUAY hoặc kéo cần gạt bên phải để tìm chủ nhân giải thưởng!
              </p>
            </div>
          )}
        </div>

        {/* Bottom Action Buttons (Quay Lại & Chơi Tiếp) */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <motion.button
            whileHover={{ scale: busy ? 1 : 1.03 }}
            whileTap={{ scale: busy ? 1 : 0.97 }}
            onClick={handlePullJackpot}
            disabled={busy}
            className={`px-10 py-4 rounded-2xl bg-gradient-to-r ${theme.headerBg} text-slate-950 font-display font-extrabold text-lg sm:text-xl tracking-wide shadow-lg flex items-center gap-2.5 disabled:opacity-50`}
          >
            <Play className="w-6 h-6 fill-current" />
            <span>{busy ? 'ĐANG QUAY JACKPOT...' : currentOutcome ? 'CHƠI TIẾP LƯỢT MỚI' : 'GIẬT CẦN QUAY JACKPOT'}</span>
          </motion.button>

          {!busy && rollingParticipant && (
            <button
              onClick={() => {
                setRollingParticipant(null);
                setReelLocked([false, false, false]);
              }}
              className="px-5 py-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs sm:text-sm font-bold text-white flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>ĐẶT LẠI MÀN HÌNH</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

