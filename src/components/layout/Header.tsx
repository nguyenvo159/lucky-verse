import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings,
  History,
  Undo2,
  Edit3,
  Check,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import { useFullscreen } from '../../hooks/useFullscreen';
import { isGameBusy } from '../../engine/game-state-machine';
import { audioService } from '../../services/audio-service';

export const Header: React.FC = () => {
  const eventName = useAppStore((s) => s.eventName);
  const setEventName = useAppStore((s) => s.setEventName);
  const participants = useAppStore((s) => s.participants);
  const getEligibleParticipants = useAppStore((s) => s.getEligibleParticipants);
  const excludedIds = useAppStore((s) => s.excludedIds);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const winnerHistory = useAppStore((s) => s.winnerHistory);
  const undoStack = useAppStore((s) => s.undoStack);
  const undoLastDraw = useAppStore((s) => s.undoLastDraw);
  const gameState = useAppStore((s) => s.gameState);

  const setParticipantDrawerOpen = useAppStore((s) => s.setParticipantDrawerOpen);
  const setHistoryModalOpen = useAppStore((s) => s.setHistoryModalOpen);
  const setSettingsModalOpen = useAppStore((s) => s.setSettingsModalOpen);

  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(eventName);
  const [showAudioPopover, setShowAudioPopover] = useState(false);
  const audioPopoverRef = useRef<HTMLDivElement>(null);

  const eligibleCount = getEligibleParticipants().length;
  const busy = isGameBusy(gameState);

  useEffect(() => {
    setDraftTitle(eventName);
  }, [eventName]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (audioPopoverRef.current && !audioPopoverRef.current.contains(e.target as Node)) {
        setShowAudioPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isFullscreen) {
    return null;
  }

  const handleSaveTitle = () => {
    const trimmed = draftTitle.trim();
    if (trimmed) {
      setEventName(trimmed);
    } else {
      setDraftTitle(eventName);
    }
    setIsEditingTitle(false);
  };

  return (
    <header className="relative z-30 border-b border-white/10 bg-[#10152B]/90 backdrop-blur-xl px-2.5 sm:px-6 py-2">
      <div className="max-w-[1650px] mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Left: Logo & Editable Event Name */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#8B5CF6] via-[#EC4899] to-[#38DDF8] p-[2px] shadow-lg shadow-purple-500/25">
              <div className="w-full h-full bg-[#10152B] rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFD166]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-purple-200 to-[#38DDF8] bg-clip-text text-transparent">
                  LuckyVerse
                </span>
                <span className="hidden md:inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden lg:block leading-none">
                Ultimate Lucky Draw Experience
              </p>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-white/10 hidden sm:block mx-0.5" />

          {/* Event Title Inline Editor */}
          <div className="min-w-0 flex items-center flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5 bg-[#182042] border border-purple-400/50 rounded-lg px-2 py-1 w-full max-w-xs">
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') {
                      setDraftTitle(eventName);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  maxLength={80}
                  className="bg-transparent text-xs sm:text-sm font-semibold text-white focus:outline-none w-full"
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 shrink-0"
                  title="Lưu tên sự kiện"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingTitle(true)}
                className="group flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors text-left min-w-0 max-w-[155px] sm:max-w-xs md:max-w-md"
                title="Nhấn để đổi tên sự kiện / vòng quay"
              >
                <span className="font-semibold text-xs sm:text-sm text-slate-100 truncate">{eventName}</span>
                <Edit3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 opacity-60 group-hover:opacity-100 group-hover:text-[#38DDF8] shrink-0 transition-opacity" />
              </button>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Participant Counter & Drawer Trigger */}
          <button
            onClick={() => {
              audioService.playClick();
              setParticipantDrawerOpen(true);
            }}
            disabled={busy}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#8B5CF6]/25 to-[#38DDF8]/20 hover:from-[#8B5CF6]/40 hover:to-[#38DDF8]/30 border border-purple-400/35 text-xs sm:text-sm font-semibold text-white transition-all shadow-sm disabled:opacity-50"
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#38DDF8]" />
            <span className="hidden sm:inline">Danh sách</span>
            <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-[#10152B]/90 text-[#FFD166] font-mono text-[11px] sm:text-xs border border-white/10">
              {eligibleCount}/{participants.length}
            </span>
          </button>

          {/* Undo Button */}
          {undoStack.length > 0 && (
            <button
              onClick={() => {
                audioService.playClick();
                undoLastDraw();
              }}
              disabled={busy}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-amber-300 transition-colors disabled:opacity-40"
              title="Hoàn tác lượt quay gần nhất"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Hoàn tác</span>
            </button>
          )}

          {/* Winner History Button */}
          <button
            onClick={() => {
              audioService.playClick();
              setHistoryModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-medium text-slate-200 transition-colors"
            title="Lịch sử trúng thưởng"
          >
            <History className="w-4 h-4 text-[#55E6A5]" />
            <span className="hidden md:inline">Lịch sử</span>
            {winnerHistory.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs">
                {winnerHistory.length}
              </span>
            )}
          </button>

          {/* Sound Toggle & Volume Popover */}
          <div className="relative" ref={audioPopoverRef}>
            <div className="flex items-center rounded-xl bg-white/5 border border-white/10 overflow-hidden">
              <button
                onClick={() => {
                  const next = !settings.soundEnabled;
                  updateSettings({ soundEnabled: next });
                  if (next) audioService.playClick();
                }}
                className="p-2 hover:bg-white/10 transition-colors text-slate-200"
                title={settings.soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
              >
                {settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-[#38DDF8]" />
                ) : (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                )}
              </button>
              <button
                onClick={() => setShowAudioPopover((v) => !v)}
                className="px-1.5 py-2 text-[10px] text-slate-400 hover:text-white hover:bg-white/10 border-l border-white/10"
                title="Chỉnh âm lượng nhạc nền & hiệu ứng"
              >
                ▾
              </button>
            </div>

            {showAudioPopover && (
              <div className="absolute right-0 mt-2 w-64 p-4 rounded-2xl arcade-glass border border-white/15 shadow-2xl z-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Bộ chỉnh âm thanh</span>
                  <button
                    onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                    className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      settings.soundEnabled
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {settings.soundEnabled ? 'Đang Bật' : 'Đang Tắt'}
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Nhạc nền (BGM)</span>
                    <span className="font-mono">{Math.round(settings.bgmVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.bgmVolume}
                    onChange={(e) => updateSettings({ bgmVolume: parseFloat(e.target.value) })}
                    className="w-full accent-[#8B5CF6] cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Hiệu ứng (SFX)</span>
                    <span className="font-mono">{Math.round(settings.sfxVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.sfxVolume}
                    onChange={(e) => {
                      updateSettings({ sfxVolume: parseFloat(e.target.value) });
                      audioService.playClick();
                    }}
                    className="w-full accent-[#38DDF8] cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={() => {
              audioService.playClick();
              toggleFullscreen();
            }}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors"
            title="Chế độ toàn màn hình trình chiếu (Fullscreen)"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-[#FFD166]" />
            ) : (
              <Maximize2 className="w-4 h-4 text-[#FFD166]" />
            )}
            <span className="hidden xl:inline text-xs font-medium">Trình chiếu</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => {
              audioService.playClick();
              setSettingsModalOpen(true);
            }}
            disabled={busy}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors disabled:opacity-50"
            title="Cài đặt quay thưởng"
          >
            <Settings className="w-4 h-4 text-purple-300" />
          </button>
        </div>
      </div>

      {/* Subtle status bar if some winners are excluded */}
      {!settings.allowRepeatWinner && excludedIds.length > 0 && eligibleCount > 0 && (
        <div className="hidden" />
      )}
    </header>
  );
};

