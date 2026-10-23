import React from 'react';
import { useAppStore } from '../../stores/app-store';
import { GAME_REGISTRY } from '../../games/game-registry';

export const AmbientBackground: React.FC = () => {
  const activeGameId = useAppStore((s) => s.activeGameId);
  const reducedMotion = useAppStore((s) => s.settings.reducedMotion);
  const gameMeta = GAME_REGISTRY[activeGameId];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Dynamic Soft Ambient Glows */}
      <div
        className="absolute -top-36 -left-36 w-[520px] h-[520px] rounded-full blur-[135px] opacity-25 transition-colors duration-700"
        style={{ backgroundColor: gameMeta.accentColor }}
      />
      <div
        className="absolute top-1/3 -right-36 w-[460px] h-[460px] rounded-full blur-[140px] opacity-20 transition-colors duration-700"
        style={{ backgroundColor: gameMeta.secondaryColor }}
      />
      <div
        className="absolute -bottom-44 left-1/3 w-[600px] h-[420px] rounded-full blur-[150px] opacity-15 transition-colors duration-700"
        style={{ backgroundColor: '#8B5CF6' }}
      />

      {/* Subtle Arcade Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Twinkling decorative stars */}
      {!reducedMotion && (
        <svg className="absolute inset-0 w-full h-full opacity-35" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12%" cy="18%" r="1.5" fill="#FFD166" className="animate-pulse" />
          <circle cx="85%" cy="14%" r="2" fill="#38DDF8" className="animate-pulse" />
          <circle cx="72%" cy="78%" r="1.5" fill="#FF6B8A" className="animate-pulse" />
          <circle cx="24%" cy="82%" r="2" fill="#55E6A5" className="animate-pulse" />
          <circle cx="48%" cy="12%" r="1.2" fill="#FFFFFF" />
          <circle cx="92%" cy="52%" r="1.6" fill="#FFD166" />
        </svg>
      )}
    </div>
  );
};

