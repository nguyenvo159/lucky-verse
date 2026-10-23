import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Sparkles, Hash, Users } from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import { audioService } from '../../services/audio-service';
import { isGameBusy } from '../../engine/game-state-machine';
import { Participant } from '../../types/participant';
import { ParticipantAvatarSvg } from '../../components/shared/ParticipantAvatarSvg';

export const LuckyLotteryGame: React.FC = () => {
  const getEligibleParticipants = useAppStore((s) => s.getEligibleParticipants);
  const participants = useAppStore((s) => s.participants);
  const gameState = useAppStore((s) => s.gameState);
  const setGameState = useAppStore((s) => s.setGameState);
  const startDraw = useAppStore((s) => s.startDraw);
  const revealWinnerOverlay = useAppStore((s) => s.revealWinnerOverlay);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const eligible = getEligibleParticipants();
  const digitCount = Math.max(3, Math.min(6, settings.lotteryDigits || 4));

  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const [displayedDigits, setDisplayedDigits] = useState<string[]>(() =>
    Array(digitCount).fill('0')
  );
  const [lockedFlags, setLockedFlags] = useState<boolean[]>(() =>
    Array(digitCount).fill(false)
  );
  const [scanningCandidate, setScanningCandidate] = useState<Participant | null>(null);

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
    setDisplayedDigits(Array(digitCount).fill('0'));
    setLockedFlags(Array(digitCount).fill(false));
  }, [digitCount]);

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  const formatTargetCode = (code: string, digits: number): string[] => {
    const clean = code.replace(/\D/g, '') || '1';
    const padded = clean.padStart(digits, '0').slice(-digits);
    return padded.split('');
  };

  const handleStartLottery = () => {
    if (isGameBusy(gameState) || eligible.length === 0) return;
    clearAllTimers();

    const outcome = startDraw();
    if (!outcome) return;

    const winner = outcome.primaryWinner;
    const targetDigits = formatTargetCode(winner.displayCode, digitCount);

    setLockedFlags(Array(digitCount).fill(false));
    setCountdownNum(3);
    audioService.playCountdownBeep(false);

    const t1 = window.setTimeout(() => {
      setCountdownNum(2);
      audioService.playCountdownBeep(false);
    }, 650);

    const t2 = window.setTimeout(() => {
      setCountdownNum(1);
      audioService.playCountdownBeep(false);
    }, 1300);

    const tStart = window.setTimeout(() => {
      setCountdownNum(null);
      audioService.playCountdownBeep(true);
      setGameState('running');

      const lockedLocal = Array(digitCount).fill(false);

      // High-speed electronic digit cycling
      spinIntervalRef.current = window.setInterval(() => {
        setDisplayedDigits((prev) =>
          prev.map((d, idx) =>
            lockedLocal[idx] ? targetDigits[idx] : String(Math.floor(Math.random() * 10))
          )
        );
        const randomCandidate = eligible[Math.floor(Math.random() * eligible.length)];
        if (randomCandidate) setScanningCandidate(randomCandidate);
        audioService.playLotteryDigitTick();
      }, 65);

      const totalSpinMs = Math.max(2500, settings.animationDuration * 1000 - 1500);
      const stepPerDigit = totalSpinMs / digitCount;

      targetDigits.forEach((digitChar, idx) => {
        const lockTimer = window.setTimeout(() => {
          lockedLocal[idx] = true;
          setLockedFlags([...lockedLocal]);
          setDisplayedDigits((prev) => {
            const copy = [...prev];
            copy[idx] = digitChar;
            return copy;
          });
          audioService.playLotteryDigitLock(idx);

          // Last digit locked
          if (idx === digitCount - 1) {
            if (spinIntervalRef.current !== null) {
              clearInterval(spinIntervalRef.current);
              spinIntervalRef.current = null;
            }
            setScanningCandidate(winner);
            setGameState('revealing');

            const revealTimer = window.setTimeout(() => {
              revealWinnerOverlay();
            }, 950);
            timersRef.current.push(revealTimer);
          }
        }, stepPerDigit * (idx + 1));

        timersRef.current.push(lockTimer);
      });
    }, 1950);

    timersRef.current.push(t1, t2, tStart);
  };

  const busy = isGameBusy(gameState);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 max-w-5xl mx-auto w-full">
      {/* Main Broadcast Stage Board */}
      <div className="relative w-full rounded-3xl arcade-glass border-2 border-[#38DDF8]/40 p-6 sm:p-10 shadow-[0_0_70px_-15px_rgba(56,221,248,0.4)] overflow-hidden">
        {/* Scanline & LED Matrix Texture */}
        <div className="absolute inset-0 scanline-overlay pointer-events-none opacity-40" />

        {/* Header Status Bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#38DDF8]/20 border border-[#38DDF8]/40 text-[#38DDF8] text-xs font-bold tracking-wider uppercase">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> TRỰC TIẾP QUAY SỐ TRÚNG THƯỞNG
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-[#0A0D1C]/80 border border-white/10 rounded-xl px-3 py-1 text-xs">
              <Hash className="w-3.5 h-3.5 text-[#55E6A5]" />
              <span className="text-slate-400">Số chữ số:</span>
              {[3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  disabled={busy}
                  onClick={() => updateSettings({ lotteryDigits: n })}
                  className={`px-2 py-0.5 rounded font-mono font-bold transition-colors ${
                    digitCount === n
                      ? 'bg-[#38DDF8] text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <span className="text-xs font-mono text-slate-300 bg-[#0A0D1C]/80 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#38DDF8]" />
              {eligible.length}/{participants.length}
            </span>
          </div>
        </div>

        {/* Countdown Overlay */}
        <AnimatePresence>
          {countdownNum !== null && (
            <motion.div
              key={countdownNum}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1.1, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              className=" inset-0 z-30 absolute flex items-center justify-center bg-[#0A0D1C]/80 backdrop-blur-sm"
            >
              <div className="text-center">
                <span className="font-mono font-extrabold text-8xl sm:text-9xl text-[#FFD166] drop-shadow-[0_0_35px_rgba(255,209,102,0.85)]">
                  {countdownNum}
                </span>
                <p className="font-display text-sm uppercase tracking-widest text-[#38DDF8] mt-2">
                  Chuẩn bị khóa tần số may mắn...
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Electronic LED Digit Cells (Responsive for Mobile, Tablet & Desktop) */}
        <div className="relative z-10 my-3 sm:my-5 flex items-center justify-center gap-1.5 sm:gap-3.5 md:gap-4 flex-wrap">
          {displayedDigits.map((digit, index) => {
            const isLocked = lockedFlags[index];
            return (
              <motion.div
                key={index}
                animate={
                  isLocked
                    ? { scale: [1.14, 1], borderColor: '#55E6A5' }
                    : gameState === 'running'
                    ? { y: [0, -3, 2, 0] }
                    : {}
                }
                transition={{ duration: 0.25 }}
                className={`relative w-12 h-20 sm:w-20 sm:h-32 md:w-28 md:h-40 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center border-2 shadow-2xl transition-colors ${
                  isLocked
                    ? 'bg-gradient-to-b from-emerald-950/90 to-[#0A0D1C] border-[#55E6A5] shadow-[0_0_30px_rgba(85,230,165,0.45)]'
                    : gameState === 'running'
                    ? 'bg-[#0A0D1C] border-[#38DDF8] shadow-[0_0_25px_rgba(56,221,248,0.3)]'
                    : 'bg-[#0A0D1C]/90 border-white/15'
                }`}
              >
                {/* Top LED Indicator */}
                <div
                  className={`absolute top-1.5 sm:top-2.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                    isLocked
                      ? 'bg-[#55E6A5] shadow-[0_0_8px_#55E6A5]'
                      : gameState === 'running'
                      ? 'bg-[#FFD166] animate-ping'
                      : 'bg-slate-600'
                  }`}
                />

                <span
                  className={`font-mono font-extrabold text-3xl sm:text-5xl md:text-7xl tracking-tight select-none ${
                    isLocked
                      ? 'text-[#55E6A5] drop-shadow-[0_0_16px_rgba(85,230,165,0.8)]'
                      : gameState === 'running'
                      ? 'text-[#38DDF8]'
                      : 'text-slate-200'
                  }`}
                >
                  {digit}
                </span>

                <span className="absolute bottom-1 sm:bottom-2 text-[8px] sm:text-[9px] font-mono uppercase tracking-widest text-slate-500">
                  {isLocked ? 'LOCKED' : `CH-${index + 1}`}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Live Candidate / Mapped Participant Marquee */}
        <div className="relative z-10 mt-6 max-w-xl mx-auto rounded-2xl bg-[#0A0D1C]/90 border border-white/15 p-4 flex items-center justify-center min-h-[82px]">
          {scanningCandidate ? (
            <div className="flex items-center gap-3.5">
              <ParticipantAvatarSvg
                seed={scanningCandidate.avatarSeed}
                size={52}
                expression={gameState === 'revealing' ? 'celebrating' : 'normal'}
              />
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#38DDF8]/20 text-[#38DDF8] font-bold">
                    MÃ #{scanningCandidate.displayCode.padStart(digitCount, '0')}
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400">
                    {gameState === 'revealing' ? '★ ĐÃ XÁC ĐỊNH NGƯỜI THẮNG ★' : 'Đang dò mã hồ sơ...'}
                  </span>
                </div>
                <p
                  className={`font-display text-xl sm:text-2xl font-bold mt-0.5 ${
                    gameState === 'revealing' ? 'text-[#FFD166]' : 'text-white'
                  }`}
                >
                  {scanningCandidate.name}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400 text-xs sm:text-sm">
              Mỗi người tham gia được ánh xạ chính xác với một mã số định danh. Nhấn{' '}
              <strong className="text-[#38DDF8]">BẮT ĐẦU QUAY SỐ</strong> để kích hoạt bảng điện tử!
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="relative z-10 mt-6 flex justify-center">
          <motion.button
            whileHover={{ scale: busy ? 1 : 1.03 }}
            whileTap={{ scale: busy ? 1 : 0.97 }}
            onClick={handleStartLottery}
            disabled={busy}
            className="px-10 py-4 rounded-2xl bg-gradient-to-r from-[#38DDF8] via-[#55E6A5] to-[#FFD166] text-slate-950 font-display font-extrabold text-lg sm:text-xl tracking-wide shadow-[0_0_35px_-5px_rgba(56,221,248,0.65)] flex items-center gap-2.5 disabled:opacity-50"
          >
            <Sparkles className="w-6 h-6" />
            <span>{busy ? 'ĐANG QUAY SỐ...' : 'BẮT ĐẦU QUAY SỐ'}</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

