import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Download, Upload, RotateCcw, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import {
  exportFullBackupJson,
  validateBackupJson,
} from '../../services/import-export-service';
import { JackpotTheme, WinnerRemovalMode } from '../../types/game';

export const SettingsModal: React.FC = () => {
  const isOpen = useAppStore((s) => s.isSettingsModalOpen);
  const setOpen = useAppStore((s) => s.setSettingsModalOpen);

  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const eventName = useAppStore((s) => s.eventName);
  const activeGameId = useAppStore((s) => s.activeGameId);
  const participants = useAppStore((s) => s.participants);
  const excludedIds = useAppStore((s) => s.excludedIds);
  const winnerHistory = useAppStore((s) => s.winnerHistory);
  const restoreBackup = useAppStore((s) => s.restoreBackup);
  const factoryResetAll = useAppStore((s) => s.factoryResetAll);

  const backupInputRef = useRef<HTMLInputElement>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!isOpen) return null;

  const handleExportBackup = () => {
    exportFullBackupJson({
      eventName,
      activeGameId,
      participants,
      excludedIds,
      winnerHistory,
      settings,
    });
    setBackupMessage('Đã xuất file sao lưu JSON thành công.');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = ev.target?.result;
        if (typeof raw === 'string') {
          const validated = validateBackupJson(raw);
          restoreBackup(validated);
          setBackupMessage('Đã khôi phục bản sao lưu thành công!');
        }
      } catch (err) {
        setBackupMessage(err instanceof Error ? err.message : 'File sao lưu JSON không hợp lệ.');
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          className="w-full max-w-2xl max-h-[88vh] rounded-3xl arcade-glass border border-white/15 flex flex-col overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#10152B]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30">
                <Settings className="w-5 h-5 text-purple-300" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Cài Đặt Quay Thưởng & Hệ Thống
                </h2>
                <p className="text-xs text-slate-400">
                  Tùy chỉnh luật chọn người thắng, thời lượng animation, âm thanh và sao lưu
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

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Section 1: Draw Rules */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#38DDF8]">
                1. Quy tắc quay thưởng (DrawEngine)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="p-3.5 rounded-2xl bg-[#10152B]/80 border border-white/10 flex items-start justify-between gap-3 cursor-pointer">
                  <div>
                    <div className="text-sm font-semibold text-white">Không cho trúng lại</div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Người đã thắng sẽ được loại khỏi tập đủ điều kiện ở các lượt sau.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!settings.allowRepeatWinner}
                    onChange={(e) => updateSettings({ allowRepeatWinner: !e.target.checked })}
                    className="mt-1 w-4 h-4 accent-[#8B5CF6]"
                  />
                </label>

                <label className="p-3.5 rounded-2xl bg-[#10152B]/80 border border-white/10 flex items-start justify-between gap-3 cursor-pointer">
                  <div>
                    <div className="text-sm font-semibold text-white">Hiệu ứng Pháo Giấy (Confetti)</div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Bắn pháo giấy chúc mừng khi công bố người chiến thắng.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.confettiEnabled}
                    onChange={(e) => updateSettings({ confettiEnabled: e.target.checked })}
                    className="mt-1 w-4 h-4 accent-[#8B5CF6]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#10152B]/80 border border-white/10 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Xử lý danh sách sau khi thắng
                  </label>
                  <select
                    value={settings.winnerRemovalMode}
                    onChange={(e) =>
                      updateSettings({ winnerRemovalMode: e.target.value as WinnerRemovalMode })
                    }
                    className="w-full rounded-xl bg-[#182042] border border-white/15 px-2.5 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="keep-ineligible">Giữ tên trong danh sách gốc</option>
                    <option value="auto-remove">Tự động xóa khỏi danh sách gốc</option>
                    <option value="manual-prompt">Chọn thủ công sau mỗi lượt</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#10152B]/80 border border-white/10 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Số người thắng mỗi lượt: <strong className="text-[#FFD166]">{settings.winnersPerTurn}</strong>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={settings.winnersPerTurn}
                    onChange={(e) => updateSettings({ winnersPerTurn: parseInt(e.target.value, 10) })}
                    className="w-full accent-[#FFD166]"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>1 người</span>
                    <span>3 người</span>
                    <span>5 người</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#10152B]/80 border border-white/10 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Thời gian Animation: <strong className="text-[#38DDF8]">{settings.animationDuration} giây</strong>
                  </label>
                  <input
                    type="range"
                    min={3}
                    max={12}
                    step={1}
                    value={settings.animationDuration}
                    onChange={(e) => updateSettings({ animationDuration: parseInt(e.target.value, 10) })}
                    className="w-full accent-[#38DDF8]"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Nhanh (3s)</span>
                    <span>Chuẩn (6s)</span>
                    <span>Kịch tính (12s)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Game Specific Options */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#FF6B8A]">
                2. Tùy chỉnh theo từng trò chơi
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#10152B]/80 border border-white/10 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Số chữ số Lucky Lottery
                  </label>
                  <select
                    value={settings.lotteryDigits}
                    onChange={(e) => updateSettings({ lotteryDigits: parseInt(e.target.value, 10) })}
                    className="w-full rounded-xl bg-[#182042] border border-white/15 px-2.5 py-2 text-xs text-white"
                  >
                    <option value={3}>3 chữ số (001 - 999)</option>
                    <option value={4}>4 chữ số (0001 - 1000)</option>
                    <option value={5}>5 chữ số (00001)</option>
                    <option value={6}>6 chữ số (000001)</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#10152B]/80 border border-white/10 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Số hộp quà Mystery Box
                  </label>
                  <select
                    value={settings.mysteryBoxCount}
                    onChange={(e) => updateSettings({ mysteryBoxCount: parseInt(e.target.value, 10) })}
                    className="w-full rounded-xl bg-[#182042] border border-white/15 px-2.5 py-2 text-xs text-white"
                  >
                    <option value={6}>6 hộp quà</option>
                    <option value={9}>9 hộp quà</option>
                    <option value={12}>12 hộp quà</option>
                    <option value={16}>16 hộp quà</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#10152B]/80 border border-white/10 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Chủ đề màu Máy Jackpot
                  </label>
                  <select
                    value={settings.jackpotTheme}
                    onChange={(e) => updateSettings({ jackpotTheme: e.target.value as JackpotTheme })}
                    className="w-full rounded-xl bg-[#182042] border border-white/15 px-2.5 py-2 text-xs text-white"
                  >
                    <option value="cyber-neon">Cyber Neon (Tím & Xanh)</option>
                    <option value="royal-gold">Royal Gold (Vàng Hoàng Gia)</option>
                    <option value="cosmic-arcade">Cosmic Arcade (Hồng & Ngọc Bích)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Performance & Accessibility */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#55E6A5]">
                3. Hiệu năng & Tối ưu máy cấu hình thấp
              </h3>

              <label className="p-3.5 rounded-2xl bg-[#10152B]/80 border border-white/10 flex items-start justify-between gap-3 cursor-pointer">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Chế độ Giảm Hiệu Ứng Nặng (Low-Spec / Reduced Motion)
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Giảm số lượng hạt sáng, đám đông nền và hiệu ứng phụ để chạy siêu mượt trên máy văn phòng yếu.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.reducedMotion}
                  onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
                  className="mt-1 w-4 h-4 accent-[#55E6A5]"
                />
              </label>
            </div>

            {/* Section 4: Backup & Restore */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                4. Sao lưu & Khôi phục dữ liệu (JSON Schema v1)
              </h3>

              {backupMessage && (
                <div className="p-3 rounded-xl bg-sky-500/15 border border-sky-400/30 text-xs text-sky-200">
                  {backupMessage}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleExportBackup}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white"
                >
                  <Download className="w-4 h-4 text-[#38DDF8]" />
                  <span>Xuất bản sao lưu (.JSON)</span>
                </button>

                <input
                  ref={backupInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
                <button
                  onClick={() => backupInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white"
                >
                  <Upload className="w-4 h-4 text-[#55E6A5]" />
                  <span>Nhập bản sao lưu (.JSON)</span>
                </button>

                {confirmReset ? (
                  <div className="flex items-center gap-2 bg-rose-500/20 border border-rose-500/40 px-3 py-1.5 rounded-xl">
                    <span className="text-xs text-rose-200 font-semibold">Xác nhận đặt lại toàn bộ?</span>
                    <button
                      onClick={() => {
                        factoryResetAll();
                        setConfirmReset(false);
                        setBackupMessage('Đã khôi phục toàn bộ ứng dụng về mặc định.');
                      }}
                      className="px-2.5 py-1 rounded bg-rose-500 text-white text-xs font-bold"
                    >
                      Xác nhận
                    </button>
                    <button
                      onClick={() => setConfirmReset(false)}
                      className="px-2.5 py-1 rounded bg-white/10 text-slate-300 text-xs"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-semibold text-rose-300 ml-auto"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Khôi phục gốc</span>
                  </button>
                )}
              </div>

              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Kết quả quay thưởng sử dụng nguồn ngẫu nhiên mật mã học{' '}
                  <code className="text-sky-300">crypto.getRandomValues()</code> hoàn toàn công bằng,
                  không gửi bất kỳ dữ liệu nào ra ngoài trình duyệt.
                </span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

