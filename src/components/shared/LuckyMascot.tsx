import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/app-store';
import { GAME_REGISTRY } from '../../games/game-registry';

export const LuckyMascot: React.FC = () => {
  const mascotMood = useAppStore((s) => s.mascotMood);
  const activeGameId = useAppStore((s) => s.activeGameId);
  const isFullscreen = useAppStore((s) => s.isFullscreen);
  const participantsCount = useAppStore((s) => s.participants.length);
  const [hovered, setHovered] = useState(false);

  if (isFullscreen) return null;

  const gameMeta = GAME_REGISTRY[activeGameId];

  const getMessage = () => {
    if (participantsCount === 0) return 'Hãy nạp danh sách để mình bắt đầu quay thưởng nhé!';
    if (mascotMood === 'suspense') return 'Hồi hộp quá! Ai sẽ là người may mắn đây?!';
    if (mascotMood === 'celebrating') return 'Chúc mừng người chiến thắng siêu may mắn!';
    if (hovered) return `Chế độ ${gameMeta.vietnameseName} đã sẵn sàng!`;
    return 'LuckyBot sẵn sàng!';
  };

  return (
    <div
      className="fixed bottom-4 left-4 z-30 hidden lg:flex items-end gap-2.5 select-none pointer-events-auto"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.div
        animate={
          mascotMood === 'celebrating'
            ? { y: [0, -14, 0], rotate: [0, -8, 8, 0] }
            : mascotMood === 'suspense'
            ? { scale: [1, 1.08, 1], rotate: [-3, 3, -3] }
            : { y: [0, -6, 0] }
        }
        transition={{
          duration: mascotMood === 'suspense' ? 0.6 : 2.8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative cursor-pointer group"
      >
        {/* Glow */}
        <div
          className="absolute -inset-2 rounded-full blur-md opacity-60 transition-opacity group-hover:opacity-95"
          style={{ backgroundColor: gameMeta.accentColor }}
        />

        {/* Custom SVG Arcade Mascot Bot */}
        <svg width="64" height="64" viewBox="0 0 80 80" fill="none" className="relative drop-shadow-lg">
          {/* Antenna */}
          <line x1="40" y1="8" x2="40" y2="20" stroke="#38DDF8" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="40" cy="7" r="5" fill="#FFD166" />
          {/* Ears */}
          <rect x="10" y="34" width="6" height="16" rx="3" fill="#FF6B8A" />
          <rect x="64" y="34" width="6" height="16" rx="3" fill="#FF6B8A" />
          {/* Head Helmet */}
          <rect
            x="15"
            y="20"
            width="50"
            height="44"
            rx="16"
            fill="#182042"
            stroke="#8B5CF6"
            strokeWidth="3"
          />
          {/* Screen Face */}
          <rect x="22" y="27" width="36" height="28" rx="10" fill="#0A0D1C" />

          {/* Eyes */}
          {mascotMood === 'celebrating' ? (
            <>
              <path d="M28 40L32 36L36 40" stroke="#55E6A5" strokeWidth="3" strokeLinecap="round" />
              <path d="M44 40L48 36L52 40" stroke="#55E6A5" strokeWidth="3" strokeLinecap="round" />
            </>
          ) : mascotMood === 'suspense' ? (
            <>
              <circle cx="32" cy="39" r="4.5" fill="#FFD166" />
              <circle cx="48" cy="39" r="4.5" fill="#FFD166" />
            </>
          ) : (
            <>
              <circle cx="32" cy="39" r="3.8" fill="#38DDF8" />
              <circle cx="48" cy="39" r="3.8" fill="#38DDF8" />
            </>
          )}

          {/* Mouth */}
          <path
            d={
              mascotMood === 'suspense'
                ? 'M36 49H44'
                : 'M34 47C36 50.5 44 50.5 46 47'
            }
            stroke="#38DDF8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Star badge on forehead */}
          <polygon
            points="40,18 42,22 46,22 43,24.5 44,28.5 40,26 36,28.5 37,24.5 34,22 38,22"
            fill="#FFD166"
          />
        </svg>
      </motion.div>

      <AnimatePresence>
        {(hovered || mascotMood !== 'idle' || participantsCount === 0) && (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.92 }}
            className="mb-3 px-3.5 py-2 rounded-2xl rounded-bl-none arcade-glass text-xs font-medium text-slate-200 max-w-[230px] border border-purple-500/30 shadow-lg"
          >
            {getMessage()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

