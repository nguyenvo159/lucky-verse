import React, { useState, useEffect, useRef } from 'react';
import { Minimize2, Volume2, VolumeX, History, Users } from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import { useFullscreen } from '../../hooks/useFullscreen';
import { GAME_REGISTRY } from '../../games/game-registry';

export const FullscreenFloatingBar: React.FC = () => {
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const eventName = useAppStore((s) => s.eventName);
  const activeGameId = useAppStore((s) => s.activeGameId);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setHistoryModalOpen = useAppStore((s) => s.setHistoryModalOpen);
  const setParticipantDrawerOpen = useAppStore((s) => s.setParticipantDrawerOpen);
  const getEligibleParticipants = useAppStore((s) => s.getEligibleParticipants);
  const participants = useAppStore((s) => s.participants);

  const [visible, setVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isFullscreen) return;

    const handleActivity = () => {
      setVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => {
        setVisible(false);
      }, 3200);
    };

    handleActivity();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isFullscreen]);

  if (!isFullscreen) return null;

  const gameMeta = GAME_REGISTRY[activeGameId];
  const eligibleCount = getEligibleParticipants().length;

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-2 rounded-2xl arcade-glass border border-white/20 shadow-2xl">
        <span className="font-display font-bold text-sm text-[#FFD166]">{eventName}</span>
        <span className="text-white/20">|</span>
        <span className="text-xs font-semibold text-sky-300">{gameMeta.vietnameseName}</span>
        <button
          onClick={() => setParticipantDrawerOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-mono text-white"
        >
          <Users className="w-3.5 h-3.5 text-[#38DDF8]" />
          {eligibleCount}/{participants.length}
        </button>

        <button
          onClick={() => setHistoryModalOpen(true)}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200"
          title="Lịch sử"
        >
          <History className="w-4 h-4 text-[#55E6A5]" />
        </button>

        <button
          onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200"
          title="Âm thanh"
        >
          {settings.soundEnabled ? (
            <Volume2 className="w-4 h-4 text-[#38DDF8]" />
          ) : (
            <VolumeX className="w-4 h-4 text-rose-400" />
          )}
        </button>

        <button
          onClick={toggleFullscreen}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/40 text-xs font-semibold text-rose-200"
          title="Thoát toàn màn hình (Esc)"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          <span>Thoát</span>
        </button>
      </div>
    </div>
  );
};

