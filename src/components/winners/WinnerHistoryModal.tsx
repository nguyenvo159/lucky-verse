import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Download, Trash2, Undo2, Calendar } from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import { exportWinnersToCsv } from '../../services/import-export-service';
import { ParticipantAvatarSvg } from '../shared/ParticipantAvatarSvg';
import { isGameBusy } from '../../engine/game-state-machine';

export const WinnerHistoryModal: React.FC = () => {
  const isOpen = useAppStore((s) => s.isHistoryModalOpen);
  const setOpen = useAppStore((s) => s.setHistoryModalOpen);
  const winnerHistory = useAppStore((s) => s.winnerHistory);
  const eventName = useAppStore((s) => s.eventName);
  const clearWinnerHistory = useAppStore((s) => s.clearWinnerHistory);
  const undoLastDraw = useAppStore((s) => s.undoLastDraw);
  const undoStack = useAppStore((s) => s.undoStack);
  const gameState = useAppStore((s) => s.gameState);

  if (!isOpen) return null;

  const busy = isGameBusy(gameState);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          className="w-full max-w-2xl max-h-[85vh] rounded-3xl arcade-glass border border-white/15 flex flex-col overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#10152B]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-400/15 border border-amber-400/30">
                <Trophy className="w-5 h-5 text-[#FFD166]" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Bảng Vàng Lịch Sử Trúng Thưởng
                </h2>
                <p className="text-xs text-slate-400">
                  Tổng cộng {winnerHistory.length} lượt quay đã được ghi nhận
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Toolbar */}
          <div className="px-6 py-3 bg-[#151C39] border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportWinnersToCsv(winnerHistory, eventName)}
                disabled={winnerHistory.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs font-semibold text-emerald-200 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất kết quả CSV</span>
              </button>

              {undoStack.length > 0 && (
                <button
                  onClick={() => undoLastDraw()}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-xs font-semibold text-amber-200 disabled:opacity-40"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Hoàn tác lượt mới nhất</span>
                </button>
              )}
            </div>

            {winnerHistory.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Bạn có chắc muốn xóa lịch sử trúng thưởng và khôi phục lượt quay?')) {
                    clearWinnerHistory();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-semibold text-rose-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa lịch sử</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
            {winnerHistory.length === 0 ? (
              <div className="text-center py-14 text-slate-400">
                <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">Chưa có lượt trúng thưởng nào</p>
                <p className="text-xs mt-1">Hãy bắt đầu quay thưởng để vinh danh những người may mắn đầu tiên!</p>
              </div>
            ) : (
              winnerHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-[#10152B]/90 border border-white/10 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center font-mono font-bold text-xs text-amber-300 shrink-0">
                      #{item.turnNumber}
                    </div>
                    <ParticipantAvatarSvg seed={item.avatarSeed} size={42} expression="celebrating" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm sm:text-base truncate">
                          {item.participantName}
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          #{item.displayCode}
                        </span>
                      </div>
                      {item.coWinners && item.coWinners.length > 0 && (
                        <p className="text-xs text-amber-300 mt-0.5">
                          Cùng thắng: {item.coWinners.map((c) => `${c.name} (#${c.displayCode})`).join(', ')}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="text-purple-300 font-medium">{item.gameName}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleString('vi-VN')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

