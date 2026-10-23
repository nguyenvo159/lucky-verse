import { DrawSettings, GameId } from '../types/game';
import { Participant } from '../types/participant';
import { WinnerRecord } from '../types/winner';
import { generateSampleParticipants } from './import-export-service';

const STORAGE_KEY = 'luckyverse_state_v1';
export const CURRENT_SCHEMA_VERSION = 1;

export interface PersistedAppState {
  schemaVersion: number;
  eventName: string;
  activeGameId: GameId;
  participants: Participant[];
  excludedIds: string[];
  winnerHistory: WinnerRecord[];
  settings: DrawSettings;
}

export const DEFAULT_DRAW_SETTINGS: DrawSettings = {
  allowRepeatWinner: false,
  winnerRemovalMode: 'keep-ineligible',
  winnersPerTurn: 1,
  animationDuration: 6,
  soundEnabled: true,
  bgmVolume: 0.35,
  sfxVolume: 0.8,
  confettiEnabled: true,
  presentationMode: false,
  reducedMotion: false,
  lotteryDigits: 4,
  mysteryBoxCount: 9,
  jackpotTheme: 'cyber-neon',
};

export function getDefaultAppState(): PersistedAppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    eventName: 'Đêm Hội Quay Thưởng LuckyVerse 2026',
    activeGameId: 'lucky-wheel',
    participants: generateSampleParticipants(24),
    excludedIds: [],
    winnerHistory: [],
    settings: { ...DEFAULT_DRAW_SETTINGS },
  };
}

export function loadPersistedState(): { state: PersistedAppState; storageWarning: string | null } {
  if (typeof window === 'undefined') {
    return { state: getDefaultAppState(), storageWarning: null };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getDefaultAppState();
      savePersistedState(initial);
      return { state: initial, storageWarning: null };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
    if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      const fallback = getDefaultAppState();
      return {
        state: fallback,
        storageWarning: 'Dữ liệu cũ đã được nâng cấp lên phiên bản mới nhất.',
      };
    }

    const safeSettings: DrawSettings = {
      ...DEFAULT_DRAW_SETTINGS,
      ...(parsed.settings || {}),
    };

    const safeParticipants = Array.isArray(parsed.participants) ? parsed.participants : [];
    const safeExcluded = Array.isArray(parsed.excludedIds) ? parsed.excludedIds : [];
    const safeHistory = Array.isArray(parsed.winnerHistory) ? parsed.winnerHistory : [];

    return {
      state: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        eventName: typeof parsed.eventName === 'string' && parsed.eventName.trim() ? parsed.eventName : 'Sự kiện LuckyVerse',
        activeGameId: parsed.activeGameId || 'lucky-wheel',
        participants: safeParticipants,
        excludedIds: safeExcluded,
        winnerHistory: safeHistory,
        settings: safeSettings,
      },
      storageWarning: null,
    };
  } catch (err) {
    console.warn('Failed to parse localStorage state, falling back to default:', err);
    return {
      state: getDefaultAppState(),
      storageWarning: 'Phát hiện dữ liệu trình duyệt bị lỗi. Hệ thống đã khôi phục cấu hình mặc định an toàn.',
    };
  }
}

export function savePersistedState(state: PersistedAppState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const serialized = JSON.stringify({
      ...state,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    });
    window.localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (err) {
    console.warn('localStorage write failed (quota or privacy mode):', err);
    return false;
  }
}

export function clearPersistedState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

