import React from 'react';
import { Users, RotateCcw, Sparkles, History, Settings } from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import { audioService } from '../../services/audio-service';

interface StageStatusGuardProps {
  children: React.ReactNode;
}

export const StageStatusGuard: React.FC<StageStatusGuardProps> = ({ children }) => {
  const participants = useAppStore((s) => s.participants);
  const getEligibleParticipants = useAppStore((s) => s.getEligibleParticipants);
  const gameState = useAppStore((s) => s.gameState);
  const setParticipantDrawerOpen = useAppStore((s) => s.setParticipantDrawerOpen);
  const loadSampleList = useAppStore((s) => s.loadSampleList);
  const resetEligibilityPool = useAppStore((s) => s.resetEligibilityPool);
  const setHistoryModalOpen = useAppStore((s) => s.setHistoryModalOpen);
  const setSettingsModalOpen = useAppStore((s) => s.setSettingsModalOpen);

  const eligible = getEligibleParticipants();

  // Keep game mounted if currently animating or showing winner overlay
  if (gameState !== 'idle' && gameState !== 'ready') {
    return <>{children}</>;
  }

  if (participants.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-3xl arcade-glass border border-white/15 p-8 text-center space-y-5 shadow-2xl">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#8B5CF6]/30 to-[#38DDF8]/30 border border-purple-400/40 mx-auto flex items-center justify-center">
            <Users className="w-10 h-10 text-[#38DDF8]" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Chưa Có Người Tham Gia
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Hãy thêm danh sách người tham gia từ ô nhập văn bản, file TXT/CSV hoặc nạp danh sách mẫu để
              bắt đầu vòng quay may mắn!
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                audioService.playClick();
                setParticipantDrawerOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#38DDF8] text-white font-display font-bold text-sm shadow-lg"
            >
              <Users className="w-4 h-4" />
              <span>Nhập Danh Sách Ngay</span>
            </button>
            <button
              onClick={() => {
                audioService.playClick();
                loadSampleList(24);
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-amber-300 font-display font-bold text-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Nạp 24 Người Mẫu</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (eligible.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-3xl arcade-glass border border-amber-400/40 p-8 text-center space-y-5 shadow-2xl">
          <div className="w-20 h-20 rounded-2xl bg-amber-400/20 border border-amber-400/40 mx-auto flex items-center justify-center">
            <RotateCcw className="w-10 h-10 text-[#FFD166]" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Đã Quay Hết Người Đủ Điều Kiện!
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Tất cả <strong>{participants.length}</strong> người trong danh sách đều đã trúng thưởng ở
              chế độ <em>Không Trúng Lại</em>. Bạn có muốn đặt lại vòng chơi mới không?
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                audioService.playClick();
                resetEligibilityPool();
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-display font-bold text-sm shadow-lg"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Khôi Phục Để Quay Tiếp</span>
            </button>
            <button
              onClick={() => {
                audioService.playClick();
                setHistoryModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm"
            >
              <History className="w-4 h-4 text-[#55E6A5]" />
              <span>Xem Bảng Vàng</span>
            </button>
            <button
              onClick={() => {
                audioService.playClick();
                setSettingsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 font-semibold text-sm"
            >
              <Settings className="w-4 h-4 text-purple-300" />
              <span>Đổi Cài Đặt</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

