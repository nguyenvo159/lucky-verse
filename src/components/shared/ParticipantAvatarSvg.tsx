import React from 'react';
import { motion } from 'framer-motion';

interface ParticipantAvatarProps {
  seed: number;
  size?: number;
  expression?: 'normal' | 'surprised' | 'celebrating';
  className?: string;
}

const SKIN_TONES = ['#FFDFC4', '#F0C8A0', '#DEB38A', '#C68B59', '#8D5524', '#FFE4E1'];
const HAIR_COLORS = ['#1E1B2E', '#3B2314', '#8B5CF6', '#FF6B8A', '#38DDF8', '#D97706', '#10B981', '#F43F5E'];
const OUTFIT_COLORS = ['#8B5CF6', '#38DDF8', '#FF6B8A', '#FFD166', '#55E6A5', '#6366F1', '#EC4899', '#14B8A6'];

/**
 * Custom-designed animated vector character generator with diverse gender-inclusive styles,
 * hairstyles, outfits, and accessories. Purely seeded by avatarSeed for visual playfulness.
 */
export const ParticipantAvatarSvg: React.FC<ParticipantAvatarProps> = ({
  seed,
  size = 64,
  expression = 'normal',
  className = '',
}) => {
  const skin = SKIN_TONES[seed % SKIN_TONES.length];
  const hairColor = HAIR_COLORS[(seed >> 3) % HAIR_COLORS.length];
  const outfitColor = OUTFIT_COLORS[(seed >> 6) % OUTFIT_COLORS.length];
  const hairStyle = (seed >> 9) % 6;
  const hasGlasses = (seed >> 12) % 4 === 0;
  const hasPrideBadge = (seed >> 14) % 3 === 0;
  const hasVisor = (seed >> 16) % 7 === 0;
  const gradId = `avatarBg-${seed % 997}`;

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      animate={
        expression === 'celebrating'
          ? { y: [0, -3.5, 0], rotate: [-2, 2, -2] }
          : expression === 'surprised'
          ? { scale: [1, 1.05, 1] }
          : undefined
      }
      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Background Aura */}
      <circle cx="40" cy="40" r="37" fill={`url(#${gradId})`} stroke={outfitColor} strokeWidth="2.5" />

      {/* Back Hair for long/afro styles */}
      {hairStyle === 1 && <path d="M20 34C20 18 60 18 60 34V62H20V34Z" fill={hairColor} />}
      {hairStyle === 2 && <circle cx="40" cy="32" r="22" fill={hairColor} />}
      {hairStyle === 4 && (
        <>
          <circle cx="22" cy="22" r="8.5" fill={hairColor} />
          <circle cx="58" cy="22" r="8.5" fill={hairColor} />
        </>
      )}

      {/* Body / Outfit */}
      <path d="M18 74C18 59 27 53 40 53C53 53 62 59 62 74" fill={outfitColor} />
      {/* Soft Outfit Shading */}
      <path
        d="M24 74C24 63 31 58 40 58C49 58 56 63 56 74"
        fill="#FFFFFF"
        fillOpacity="0.14"
      />
      {/* Collar / Hoodie detail */}
      <path
        d="M32 53L40 62L48 53"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Rainbow Pride Inclusive Pin / Scarf Accent */}
      {hasPrideBadge && (
        <g transform="translate(46, 60)">
          <rect x="0" y="0" width="10" height="2" rx="1" fill="#FF595E" />
          <rect x="0" y="2" width="10" height="2" rx="1" fill="#FFCA3A" />
          <rect x="0" y="4" width="10" height="2" rx="1" fill="#8AC926" />
          <rect x="0" y="6" width="10" height="2" rx="1" fill="#1982C4" />
          <rect x="0" y="8" width="10" height="2" rx="1" fill="#6A4C93" />
        </g>
      )}

      {/* Neck */}
      <rect x="35" y="46" width="10" height="10" rx="4" fill={skin} />

      {/* Ears */}
      <circle cx="23.5" cy="35" r="3.5" fill={skin} />
      <circle cx="56.5" cy="35" r="3.5" fill={skin} />

      {/* Head */}
      <rect x="24" y="20" width="32" height="30" rx="14" fill={skin} />

      {/* Rosy Cheeks */}
      <circle cx="29" cy="39" r="3.2" fill="#FF6B8A" fillOpacity="0.48" />
      <circle cx="51" cy="39" r="3.2" fill="#FF6B8A" fillOpacity="0.48" />

      {/* Eyes */}
      {expression === 'surprised' ? (
        <>
          <circle cx="33" cy="34" r="3.4" fill="#10152B" />
          <circle cx="47" cy="34" r="3.4" fill="#10152B" />
          <circle cx="34" cy="33" r="1.2" fill="#FFFFFF" />
          <circle cx="48" cy="33" r="1.2" fill="#FFFFFF" />
        </>
      ) : expression === 'celebrating' ? (
        <>
          <path
            d="M30 34C31.5 31.2 34.5 31.2 36 34"
            stroke="#10152B"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M44 34C45.5 31.2 48.5 31.2 50 34"
            stroke="#10152B"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx="33" cy="34" r="2.6" fill="#10152B" />
          <circle cx="47" cy="34" r="2.6" fill="#10152B" />
          <circle cx="33.8" cy="33.2" r="0.95" fill="#FFFFFF" />
          <circle cx="47.8" cy="33.2" r="0.95" fill="#FFFFFF" />
        </>
      )}

      {/* Mouth */}
      {expression === 'surprised' ? (
        <circle cx="40" cy="43" r="3.8" fill="#10152B" />
      ) : expression === 'celebrating' ? (
        <path
          d="M34 41.5C35.5 46.5 44.5 46.5 46 41.5Z"
          fill="#FF6B8A"
          stroke="#10152B"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M35 42C36.8 45 43.2 45 45 42"
          stroke="#10152B"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      )}

      {/* Glasses or Cyber Visor */}
      {hasVisor ? (
        <rect
          x="26"
          y="30"
          width="28"
          height="7"
          rx="3.5"
          fill="#38DDF8"
          fillOpacity="0.82"
          stroke="#FFFFFF"
          strokeWidth="1.2"
        />
      ) : hasGlasses ? (
        <g stroke="#10152B" strokeWidth="1.8">
          <circle cx="33" cy="34" r="5" fill="#FFFFFF" fillOpacity="0.2" />
          <circle cx="47" cy="34" r="5" fill="#FFFFFF" fillOpacity="0.2" />
          <line x1="38" y1="34" x2="42" y2="34" />
        </g>
      ) : null}

      {/* Top Hair */}
      {hairStyle === 0 && (
        <path d="M23 29C23 18 57 18 57 29C51 24 29 24 23 29Z" fill={hairColor} />
      )}
      {hairStyle === 1 && (
        <path d="M22 30C24 17 56 17 58 30C48 23 32 23 22 30Z" fill={hairColor} />
      )}
      {hairStyle === 3 && (
        <path d="M26 24C30 14 52 15 55 26C45 22 34 22 26 24Z" fill={hairColor} />
      )}
      {hairStyle === 4 && (
        <path d="M24 28C26 19 54 19 56 28C46 23 34 23 24 28Z" fill={hairColor} />
      )}
      {hairStyle === 5 && (
        <>
          <circle cx="40" cy="14" r="7" fill={hairColor} />
          <path d="M24 28C26 19 54 19 56 28" fill={hairColor} />
        </>
      )}

      {/* Celebrating Crown Sparkle */}
      {expression === 'celebrating' && (
        <polygon
          points="32,16 34,10 40,14 46,10 48,16"
          fill="#FFD166"
          stroke="#10152B"
          strokeWidth="1.2"
        />
      )}

      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1F2956" />
          <stop offset="100%" stopColor="#0E1329" />
        </linearGradient>
      </defs>
    </motion.svg>
  );
};
