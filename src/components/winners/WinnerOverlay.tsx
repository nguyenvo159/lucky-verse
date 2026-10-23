import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Play,
  ArrowLeft,
  UserMinus,
  UserCheck,
  History,
  Undo2,
  Sparkles,
  Clock,
} from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import { useConfetti } from '../../hooks/useConfetti';
import { ParticipantAvatarSvg } from '../shared/ParticipantAvatarSvg';
import { GAME_REGISTRY } from '../../games/game-registry';
import { audioService } from '../../services/audio-service';

export const WinnerOverlay: React.FC = () => {
  const gameState = useAppStore((s) => s.gameState);
  const currentOutcome = useAppStore((s) => s.currentOutcome);
  const activeGameId = useAppStore((s) => s.activeGameId);
  const settings = useAppStore((s) => s.settings);

  const playNextTurn = useAppStore((s) => s.playNextTurn);
  const returnToStage = useAppStore((s) => s.returnToStage);
  const removeCurrentWinnerFromList = useAppStore((s) => s.removeCurrentWinnerFromList);
  const keepCurrentWinnerInList = useAppStore((s) => s.keepCurrentWinnerInList);
  const setHistoryModalOpen = useAppStore((s) => s.setHistoryModalOpen);
  const undoLastDraw = useAppStore((s) => s.undoLastDraw);

  const { fireWinnerConfetti } = useConfetti();

  useEffect(() => {
    if (gameState === 'winner' && currentOutcome) {
      fireWinnerConfetti();
    }
  }, [gameState, currentOutcome, fireWinnerConfetti]);

  if (gameState !== 'winner' || !currentOutcome) {
    return null;
  }

  const { primaryWinner, allWinners, winnerRecord } = currentOutcome;
  const gameMeta = GAME_REGISTRY[activeGameId];
  const timeFormatted = new Date(winnerRecord.timestamp).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.82, y: 24, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          className="relative w-full max-w-2xl rounded-3xl arcade-glass border-2 border-amber-400/50 p-6 sm:p-8 text-center shadow-[0_0_80px_-10px_rgba(255,209,102,0.45)] overflow-hidden"
        >
          {/* Ambient Top Rays */}
          <div
            className="absolute -top-28 left-1/2 -translate-x-1/2 w-96 h-56 rounded-full blur-3xl opacity-35 pointer-events-none"
            style={{ backgroundColor: gameMeta.accentColor }}
          />

          {/* Top Badge */}
          <div className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs sm:text-sm font-bold uppercase tracking-widest mb-4">
            <Trophy className="w-4 h-4 text-[#FFD166]" />
            <span>CHÚC MỪNG NGƯỜI CHIẾN THẮNG!</span>
            <Sparkles className="w-4 h-4 text-[#FFD166]" />
          </div>

          {/* Character Avatar & Halo */}
          <div className="relative mx-auto w-28 h-28 sm:w-32 sm:h-32 mb-4 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400/50"
            />
            <ParticipantAvatarSvg
              seed={primaryWinner.avatarSeed}
              size={112}
              expression="celebrating"
              className="relative drop-shadow-[0_0_20px_rgba(255,209,102,0.5)]"
            />
          </div>

          {/* Winner Code & Turn Info */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-2 text-xs font-mono">
            <span className="px-3 py-1 rounded-full bg-[#38DDF8]/20 border border-[#38DDF8]/40 text-[#38DDF8] font-bold">
              MÃ SỐ: #{primaryWinner.displayCode}
            </span>
            <span className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200">
              Lượt #{winnerRecord.turnNumber} • {winnerRecord.gameName}
            </span>
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {timeFormatted}
            </span>
          </div>

          {/* Winner Full Name (Large for Presentation / Projector) */}
          <motion.h2
            initial={{ scale: 0.9 }}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="font-display text-3xl sm:text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#FFD166] via-white to-[#38DDF8] py-2 break-words leading-tight drop-shadow"
          >
            {primaryWinner.name}
          </motion.h2>

          {/* Co-winners if winnersPerTurn > 1 */}
          {allWinners.length > 1 && (
            <div className="mt-4 p-3.5 rounded-2xl bg-[#10152B]/80 border border-white/10">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">
                Cùng trúng thưởng trong lượt này ({allWinners.length} người):
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {allWinners.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs sm:text-sm font-semibold text-white"
                  >
                    <ParticipantAvatarSvg seed={w.avatarSeed} size={24} expression="celebrating" />
                    <span className="text-sky-300 font-mono">#{w.displayCode}</span>
                    <span>{w.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Eligibility Status Hint */}
          <p className="text-xs text-slate-400 mt-3">
            {settings.winnerRemovalMode === 'auto-remove'
              ? 'Người thắng đã được tự động loại khỏi danh sách theo cài đặt.'
              : !settings.allowRepeatWinner
              ? 'Chế độ Không Trúng Lại đang bật: Người này sẽ không lặp lại ở các lượt tiếp theo.'
              : 'Chế độ Có Thể Trúng Lại đang bật: Người này vẫn có thể tham gia lượt sau.'}
          </p>

          {/* Primary Action Buttons */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => {
                audioService.playClick();
                playNextTurn();
              }}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#38DDF8] hover:opacity-95 text-white font-display font-bold text-base shadow-lg shadow-purple-500/30 transition-all"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>CHƠI TIẾP</span>
            </button>

            <button
              onClick={() => {
                audioService.playClick();
                returnToStage();
              }}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#1C254A] hover:bg-[#253162] border border-white/15 text-white font-display font-bold text-base transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>QUAY LẠI MÀN HÌNH</span>
            </button>
          </div>

          {/* Secondary Winner Management Buttons */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => {
                audioService.playClick();
                removeCurrentWinnerFromList();
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-200 text-xs font-semibold transition-colors"
              title="Loại bỏ ID người vừa thắng khỏi danh sách gốc"
            >
              <UserMinus className="w-4 h-4 shrink-0" />
              <span>Xóa người thắng</span>
            </button>

            <button
              onClick={() => {
                audioService.playClick();
                keepCurrentWinnerInList();
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 text-xs font-semibold transition-colors"
              title="Giữ người thắng trong danh sách gốc và tiếp tục"
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>Giữ trong danh sách</span>
            </button>

            <button
              onClick={() => {
                audioService.playClick();
                setHistoryModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold transition-colors"
            >
              <History className="w-4 h-4 shrink-0 text-[#38DDF8]" />
              <span>Xem lịch sử</span>
            </button>

            <button
              onClick={() => {
                audioService.playClick();
                undoLastDraw();
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 text-xs font-semibold transition-colors"
              title="Hoàn tác lượt quay này như chưa diễn ra"
            >
              <Undo2 className="w-4 h-4 shrink-0" />
              <span>Hoàn tác lượt</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

