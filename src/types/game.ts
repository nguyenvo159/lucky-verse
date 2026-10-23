export type GameId =
  | 'lucky-wheel'
  | 'lottery'
  | 'mystery-box'
  | 'duck-race'
  | 'jackpot'
  | 'ufo-abduction';

export type GameState =
  | 'idle'
  | 'ready'
  | 'countdown'
  | 'running'
  | 'revealing'
  | 'winner'
  | 'resetting';

export type WinnerRemovalMode = 'keep-ineligible' | 'auto-remove' | 'manual-prompt';

export type JackpotTheme = 'cyber-neon' | 'royal-gold' | 'cosmic-arcade';

export interface DrawSettings {
  /** Whether a previous winner can win again in subsequent draws */
  allowRepeatWinner: boolean;
  /** How winners are handled after a draw */
  winnerRemovalMode: WinnerRemovalMode;
  /** Number of winners drawn per turn (default 1) */
  winnersPerTurn: number;
  /** Duration of the game animation in seconds (3 to 12) */
  animationDuration: number;
  /** Global sound master toggle */
  soundEnabled: boolean;
  /** Background music volume (0 - 1) */
  bgmVolume: number;
  /** Sound effects volume (0 - 1) */
  sfxVolume: number;
  /** Confetti burst on winner reveal */
  confettiEnabled: boolean;
  /** Presentation fullscreen focus mode */
  presentationMode: boolean;
  /** Low spec / reduced motion mode */
  reducedMotion: boolean;
  /** Number of digits shown in Lucky Lottery (3 - 6) */
  lotteryDigits: number;
  /** Number of mystery boxes displayed on stage (6, 9, 12, 16) */
  mysteryBoxCount: number;
  /** Color theme for Jackpot machine */
  jackpotTheme: JackpotTheme;
}

export interface GameMetadata {
  id: GameId;
  name: string;
  vietnameseName: string;
  shortDesc: string;
  badge: string;
  accentColor: string;
  secondaryColor: string;
  gradient: string;
  actionButtonLabel: string;
}

