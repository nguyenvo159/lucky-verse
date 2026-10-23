import React from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../stores/app-store';
import { GAME_LIST } from '../../games/game-registry';
import { GameId } from '../../types/game';
import { isGameBusy } from '../../engine/game-state-machine';

const GameCardIllustration: React.FC<{ gameId: GameId; active: boolean }> = ({ gameId, active }) => {
  switch (gameId) {
    case 'lucky-wheel':
      return (
        <svg className="w-8 h-8 sm:w-10 sm:h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" fill="#182042" stroke="#FFD166" strokeWidth="3" />
          <path d="M24 24L24 4A20 20 0 0 1 41.3 14L24 24Z" fill="#8B5CF6" />
          <path d="M24 24L41.3 14A20 20 0 0 1 41.3 34L24 24Z" fill="#38DDF8" />
          <path d="M24 24L41.3 34A20 20 0 0 1 24 44L24 24Z" fill="#FF6B8A" />
          <path d="M24 24L24 44A20 20 0 0 1 6.7 34L24 24Z" fill="#FFD166" />
          <path d="M24 24L6.7 34A20 20 0 0 1 6.7 14L24 24Z" fill="#55E6A5" />
          <circle cx="24" cy="24" r="5" fill="#FFFFFF" stroke="#10152B" strokeWidth="2" />
          <polygon points="24,1 20,8 28,8" fill="#FF6B8A" />
        </svg>
      );
    case 'lottery':
      return (
        <svg className="w-8 h-8 sm:w-10 sm:h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="4" y="10" width="40" height="28" rx="6" fill="#0A0D1C" stroke="#38DDF8" strokeWidth="2.5" />
          <rect x="9" y="15" width="8" height="18" rx="2" fill="#182042" />
          <rect x="20" y="15" width="8" height="18" rx="2" fill="#182042" />
          <rect x="31" y="15" width="8" height="18" rx="2" fill="#182042" />
          <text x="11" y="28" fill="#55E6A5" fontSize="12" fontWeight="bold" fontFamily="monospace">7</text>
          <text x="22" y="28" fill="#38DDF8" fontSize="12" fontWeight="bold" fontFamily="monospace">8</text>
          <text x="33" y="28" fill="#FFD166" fontSize="12" fontWeight="bold" fontFamily="monospace">9</text>
          {active && <circle cx="40" cy="14" r="2.5" fill="#55E6A5" />}
        </svg>
      );
    case 'mystery-box':
      return (
        <svg className="w-8 h-8 sm:w-10 sm:h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="10" y="20" width="28" height="22" rx="4" fill="#FF6B8A" stroke="#FFD166" strokeWidth="2" />
          <rect x="8" y="13" width="32" height="8" rx="3" fill="#EC4899" stroke="#FFD166" strokeWidth="2" />
          <rect x="21" y="13" width="6" height="29" fill="#FFD166" />
          <path d="M24 13C19 6 13 9 18 13C21 13 24 13 24 13Z" fill="#FFD166" />
          <path d="M24 13C29 6 35 9 30 13C27 13 24 13 24 13Z" fill="#FFD166" />
        </svg>
      );
    case 'duck-race':
      return (
        <svg className="w-8 h-8 sm:w-10 sm:h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <path d="M6 38C12 35 18 41 24 38C30 35 36 41 42 38" stroke="#38DDF8" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="23" cy="29" rx="12" ry="8" fill="#FFD166" />
          <circle cx="30" cy="18" r="7" fill="#FFD166" />
          <polygon points="36,17 43,19 36,21" fill="#FF6B8A" />
          <circle cx="31.5" cy="16.5" r="1.6" fill="#10152B" />
          <path d="M17 27C20 24 25 24 27 28" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'jackpot':
      return (
        <svg className="w-8 h-8 sm:w-10 sm:h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="6" y="10" width="32" height="30" rx="6" fill="#182042" stroke="#55E6A5" strokeWidth="2.5" />
          <rect x="11" y="16" width="6" height="14" rx="2" fill="#0A0D1C" />
          <rect x="19" y="16" width="6" height="14" rx="2" fill="#0A0D1C" />
          <rect x="27" y="16" width="6" height="14" rx="2" fill="#0A0D1C" />
          <circle cx="14" cy="23" r="2.2" fill="#FFD166" />
          <circle cx="22" cy="23" r="2.2" fill="#FF6B8A" />
          <circle cx="30" cy="23" r="2.2" fill="#55E6A5" />
          <line x1="41" y1="28" x2="41" y2="14" stroke="#FFD166" strokeWidth="3" strokeLinecap="round" />
          <circle cx="41" cy="12" r="3.5" fill="#FF6B8A" />
        </svg>
      );
    case 'ufo-abduction':
      return (
        <svg className="w-8 h-8 sm:w-10 sm:h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <polygon points="18,22 30,22 38,44 10,44" fill="url(#ufoBeamMini)" opacity="0.75" />
          <path d="M16 20C16 13 32 13 32 20" fill="#38DDF8" fillOpacity="0.8" stroke="#FFFFFF" strokeWidth="1.5" />
          <ellipse cx="24" cy="21" rx="16" ry="5.5" fill="#8B5CF6" stroke="#38DDF8" strokeWidth="2" />
          <circle cx="15" cy="21" r="1.5" fill="#FFD166" />
          <circle cx="24" cy="22" r="1.5" fill="#55E6A5" />
          <circle cx="33" cy="21" r="1.5" fill="#FF6B8A" />
          <defs>
            <linearGradient id="ufoBeamMini" x1="24" y1="22" x2="24" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38DDF8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      );
  }
};

export const GameSelectorBar: React.FC = () => {
  const activeGameId = useAppStore((s) => s.activeGameId);
  const setActiveGame = useAppStore((s) => s.setActiveGame);
  const isFullscreen = useAppStore((s) => s.isFullscreen);
  const gameState = useAppStore((s) => s.gameState);

  if (isFullscreen) return null;

  const busy = isGameBusy(gameState);

  return (
    <section aria-label="Chọn chế độ chơi" className="relative z-20 px-2.5 sm:px-6 pt-2 sm:pt-3 pb-1.5">
      <div className="max-w-[1650px] mx-auto">
        {/* Horizontal swipeable bar on mobile, 3-col grid on tablet, 6-col grid on desktop */}
        <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 snap-x snap-mandatory">
          {GAME_LIST.map((game) => {
            const isSelected = activeGameId === game.id;
            return (
              <motion.button
                key={game.id}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveGame(game.id)}
                disabled={busy && !isSelected}
                className={`snap-start shrink-0 w-[162px] sm:w-auto group relative flex items-center gap-2.5 p-2 sm:p-2.5 rounded-2xl text-left transition-all overflow-hidden border ${
                  isSelected
                    ? 'bg-gradient-to-br from-[#212B55] to-[#161D3B] border-white/35 shadow-lg'
                    : 'bg-[#151C38]/80 hover:bg-[#1C254A]/90 border-white/10 opacity-85 hover:opacity-100'
                } ${busy && !isSelected ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
                style={{
                  boxShadow: isSelected ? `0 0 22px -4px ${game.accentColor}66` : undefined,
                }}
              >
                {isSelected && (
                  <motion.div
                    layoutId="activeGameIndicator"
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{
                      background: `linear-gradient(90deg, ${game.accentColor}, ${game.secondaryColor})`,
                    }}
                  />
                )}

                <GameCardIllustration gameId={game.id} active={isSelected} />

                <div className="min-w-0 flex-1">
                  <span className="block font-display font-bold text-xs sm:text-sm text-white truncate">
                    {game.vietnameseName}
                  </span>
                  <p className="hidden md:block text-[11px] text-slate-300/80 line-clamp-1 mt-0.5">
                    {game.shortDesc}
                  </p>
                  <span
                    className="inline-block mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded border truncate max-w-full"
                    style={{
                      color: game.accentColor,
                      borderColor: `${game.accentColor}40`,
                      backgroundColor: `${game.accentColor}15`,
                    }}
                  >
                    {game.badge}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
