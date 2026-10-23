import { create } from 'zustand';
import { DrawSettings, GameId, GameState } from '../types/game';
import { Participant, ParseParticipantsResult } from '../types/participant';
import { UndoSnapshot, WinnerRecord } from '../types/winner';
import { DrawEngine, DrawOutcome } from '../engine/draw-engine';
import { canTransitionState, isGameBusy } from '../engine/game-state-machine';
import { computeVisualSeed, generateUniqueId } from '../engine/random';
import {
  formatDisplayCode,
  generateSampleParticipants,
  MAX_PARTICIPANTS,
  parseParticipantLines,
  reindexParticipants,
  BackupPayloadV1,
} from '../services/import-export-service';
import {
  clearPersistedState,
  DEFAULT_DRAW_SETTINGS,
  getDefaultAppState,
  loadPersistedState,
  savePersistedState,
} from '../services/storage-service';
import { GAME_REGISTRY } from '../games/game-registry';
import { audioService } from '../services/audio-service';

interface AppStoreState {
  eventName: string;
  activeGameId: GameId;
  gameState: GameState;
  participants: Participant[];
  excludedIds: string[];
  winnerHistory: WinnerRecord[];
  undoStack: UndoSnapshot[];
  settings: DrawSettings;
  currentOutcome: DrawOutcome | null;
  storageWarning: string | null;

  // UI Panels
  isParticipantDrawerOpen: boolean;
  isHistoryModalOpen: boolean;
  isSettingsModalOpen: boolean;
  isFullscreen: boolean;
  mascotMood: 'idle' | 'excited' | 'suspense' | 'celebrating';

  // Computed / Helpers
  getEligibleParticipants: () => Participant[];

  // Actions — General & UI
  setEventName: (name: string) => void;
  setActiveGame: (gameId: GameId) => void;
  setGameState: (nextState: GameState) => void;
  setParticipantDrawerOpen: (open: boolean) => void;
  setHistoryModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setIsFullscreen: (fs: boolean) => void;
  setMascotMood: (mood: 'idle' | 'excited' | 'suspense' | 'celebrating') => void;
  dismissStorageWarning: () => void;

  // Actions — Settings
  updateSettings: (partial: Partial<DrawSettings>) => void;

  // Actions — Participants CRUD
  addSingleParticipant: (name: string) => { ok: boolean; reason?: string };
  updateParticipantName: (id: string, newName: string) => void;
  removeParticipant: (id: string) => void;
  importParticipantsFromText: (rawText: string, mode: 'replace' | 'append') => ParseParticipantsResult;
  loadSampleList: (count?: number) => void;
  clearAllParticipants: () => void;

  // Actions — Draw & Winner Lifecycle
  startDraw: () => DrawOutcome | null;
  revealWinnerOverlay: () => void;
  playNextTurn: () => void;
  returnToStage: () => void;
  removeCurrentWinnerFromList: () => void;
  keepCurrentWinnerInList: () => void;
  undoLastDraw: () => boolean;
  resetEligibilityPool: () => void;
  clearWinnerHistory: () => void;
  restoreBackup: (backup: BackupPayloadV1) => void;
  factoryResetAll: () => void;
}

const initialLoaded = loadPersistedState();

// Sync audio configuration immediately
audioService.configure({
  soundEnabled: initialLoaded.state.settings.soundEnabled,
  bgmVolume: initialLoaded.state.settings.bgmVolume,
  sfxVolume: initialLoaded.state.settings.sfxVolume,
});

function persistSnapshot(state: AppStoreState): void {
  savePersistedState({
    schemaVersion: 1,
    eventName: state.eventName,
    activeGameId: state.activeGameId,
    participants: state.participants,
    excludedIds: state.excludedIds,
    winnerHistory: state.winnerHistory,
    settings: state.settings,
  });
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  eventName: initialLoaded.state.eventName,
  activeGameId: initialLoaded.state.activeGameId,
  gameState: initialLoaded.state.participants.length > 0 ? 'ready' : 'idle',
  participants: initialLoaded.state.participants,
  excludedIds: initialLoaded.state.excludedIds,
  winnerHistory: initialLoaded.state.winnerHistory,
  undoStack: [],
  settings: initialLoaded.state.settings,
  currentOutcome: null,
  storageWarning: initialLoaded.storageWarning,

  isParticipantDrawerOpen: false,
  isHistoryModalOpen: false,
  isSettingsModalOpen: false,
  isFullscreen: false,
  mascotMood: 'idle',

  getEligibleParticipants: () => {
    const { participants, excludedIds, settings } = get();
    return DrawEngine.getEligibleParticipants(participants, excludedIds, settings.allowRepeatWinner);
  },

  setEventName: (name) => {
    set({ eventName: name });
    persistSnapshot(get());
  },

  setActiveGame: (gameId) => {
    const current = get();
    if (isGameBusy(current.gameState)) {
      // Cleanly cancel ongoing animation and switch
    }
    audioService.playClick();
    audioService.stopBgm();
    set({
      activeGameId: gameId,
      gameState: current.participants.length > 0 ? 'ready' : 'idle',
      currentOutcome: null,
      mascotMood: 'idle',
    });
    persistSnapshot(get());
  },

  setGameState: (nextState) => {
    const current = get().gameState;
    if (canTransitionState(current, nextState)) {
      set({ gameState: nextState });
    } else {
      set({ gameState: nextState });
    }
  },

  setParticipantDrawerOpen: (open) => set({ isParticipantDrawerOpen: open }),
  setHistoryModalOpen: (open) => set({ isHistoryModalOpen: open }),
  setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),
  setIsFullscreen: (fs) => set({ isFullscreen: fs }),
  setMascotMood: (mood) => set({ mascotMood: mood }),
  dismissStorageWarning: () => set({ storageWarning: null }),

  updateSettings: (partial) => {
    const nextSettings = { ...get().settings, ...partial };
    audioService.configure({
      soundEnabled: nextSettings.soundEnabled,
      bgmVolume: nextSettings.bgmVolume,
      sfxVolume: nextSettings.sfxVolume,
    });
    set({ settings: nextSettings });
    persistSnapshot(get());
  },

  addSingleParticipant: (name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { ok: false, reason: 'Tên người tham gia không được để trống.' };
    }
    const { participants } = get();
    if (participants.length >= MAX_PARTICIPANTS) {
      return { ok: false, reason: `Danh sách đã đạt tối đa ${MAX_PARTICIPANTS} người.` };
    }
    const seq = participants.length + 1;
    const id = generateUniqueId('p');
    const newItem: Participant = {
      id,
      name: trimmed,
      displayCode: formatDisplayCode(seq, 4),
      avatarSeed: computeVisualSeed(`${id}_${trimmed}`, seq),
      createdAt: Date.now(),
    };
    const nextList = [...participants, newItem];
    set({
      participants: nextList,
      gameState: isGameBusy(get().gameState) ? get().gameState : 'ready',
    });
    persistSnapshot(get());
    return { ok: true };
  },

  updateParticipantName: (id, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const nextList = get().participants.map((p) => (p.id === id ? { ...p, name: trimmed } : p));
    set({ participants: nextList });
    persistSnapshot(get());
  },

  removeParticipant: (id) => {
    const nextList = reindexParticipants(get().participants.filter((p) => p.id !== id));
    const nextExcluded = get().excludedIds.filter((eid) => eid !== id);
    set({
      participants: nextList,
      excludedIds: nextExcluded,
      gameState: nextList.length === 0 ? 'idle' : get().gameState,
    });
    persistSnapshot(get());
  },

  importParticipantsFromText: (rawText, mode) => {
    const currentList = get().participants;
    const baseList = mode === 'replace' ? [] : currentList;
    const remainingSlots = Math.max(0, MAX_PARTICIPANTS - baseList.length);
    const parsed = parseParticipantLines(rawText, baseList.length, remainingSlots);

    if (parsed.validParticipants.length === 0) {
      // Do not overwrite existing list if import produced 0 valid rows
      return parsed;
    }

    const combined = reindexParticipants([...baseList, ...parsed.validParticipants]);
    const nextExcluded = mode === 'replace' ? [] : get().excludedIds;

    set({
      participants: combined,
      excludedIds: nextExcluded,
      currentOutcome: null,
      gameState: combined.length > 0 ? 'ready' : 'idle',
    });
    persistSnapshot(get());
    return parsed;
  },

  loadSampleList: (count = 24) => {
    const sample = generateSampleParticipants(Math.min(MAX_PARTICIPANTS, count));
    set({
      participants: sample,
      excludedIds: [],
      currentOutcome: null,
      gameState: 'ready',
    });
    persistSnapshot(get());
  },

  clearAllParticipants: () => {
    set({
      participants: [],
      excludedIds: [],
      currentOutcome: null,
      gameState: 'idle',
    });
    persistSnapshot(get());
  },

  startDraw: () => {
    const state = get();
    if (isGameBusy(state.gameState)) {
      return null;
    }

    const gameMeta = GAME_REGISTRY[state.activeGameId];
    const turnNumber = state.winnerHistory.length + 1;

    const outcome = DrawEngine.pickWinners({
      participants: state.participants,
      excludedIds: state.excludedIds,
      settings: state.settings,
      gameId: state.activeGameId,
      gameName: gameMeta.vietnameseName,
      turnNumber,
    });

    if (!outcome) {
      return null;
    }

    // Save snapshot for Undo before modifying lists
    const undoSnap: UndoSnapshot = {
      participants: [...state.participants],
      excludedIds: [...state.excludedIds],
      winnerRecord: outcome.winnerRecord,
    };

    audioService.unlockAudio();
    audioService.startGameBgm(state.activeGameId);

    set({
      currentOutcome: outcome,
      undoStack: [...state.undoStack.slice(-19), undoSnap],
      gameState: 'countdown',
      mascotMood: 'suspense',
    });

    return outcome;
  },

  revealWinnerOverlay: () => {
    const state = get();
    const outcome = state.currentOutcome;
    if (!outcome) return;

    audioService.stopBgm();
    audioService.playWinnerFanfare(state.activeGameId);

    const wonIds = outcome.allWinners.map((w) => w.id);
    let nextParticipants = state.participants;
    let nextExcluded = [...state.excludedIds];

    if (!state.settings.allowRepeatWinner) {
      for (const wid of wonIds) {
        if (!nextExcluded.includes(wid)) {
          nextExcluded.push(wid);
        }
      }
    }

    if (state.settings.winnerRemovalMode === 'auto-remove') {
      const wonSet = new Set(wonIds);
      nextParticipants = reindexParticipants(state.participants.filter((p) => !wonSet.has(p.id)));
    }

    const nextHistory = [outcome.winnerRecord, ...state.winnerHistory];

    set({
      gameState: 'winner',
      participants: nextParticipants,
      excludedIds: nextExcluded,
      winnerHistory: nextHistory,
      mascotMood: 'celebrating',
    });
    persistSnapshot(get());
  },

  playNextTurn: () => {
    const state = get();
    set({
      currentOutcome: null,
      gameState: state.participants.length > 0 ? 'ready' : 'idle',
      mascotMood: 'idle',
    });
  },

  returnToStage: () => {
    const state = get();
    set({
      gameState: state.participants.length > 0 ? 'ready' : 'idle',
      mascotMood: 'idle',
    });
  },

  removeCurrentWinnerFromList: () => {
    const state = get();
    if (!state.currentOutcome) return;
    const wonSet = new Set(state.currentOutcome.allWinners.map((w) => w.id));
    const nextParticipants = reindexParticipants(state.participants.filter((p) => !wonSet.has(p.id)));
    const nextExcluded = state.excludedIds.filter((id) => !wonSet.has(id));
    const updatedHistory = state.winnerHistory.map((h) =>
      h.id === state.currentOutcome?.winnerRecord.id ? { ...h, removedFromOriginalList: true } : h
    );

    set({
      participants: nextParticipants,
      excludedIds: nextExcluded,
      winnerHistory: updatedHistory,
      currentOutcome: null,
      gameState: nextParticipants.length > 0 ? 'ready' : 'idle',
      mascotMood: 'idle',
    });
    persistSnapshot(get());
  },

  keepCurrentWinnerInList: () => {
    const state = get();
    if (!state.currentOutcome) return;
    // If allowRepeatWinner is true, ensure they aren't in excludedIds
    const wonSet = new Set(state.currentOutcome.allWinners.map((w) => w.id));
    const nextExcluded = state.settings.allowRepeatWinner
      ? state.excludedIds.filter((id) => !wonSet.has(id))
      : state.excludedIds;

    set({
      excludedIds: nextExcluded,
      currentOutcome: null,
      gameState: state.participants.length > 0 ? 'ready' : 'idle',
      mascotMood: 'idle',
    });
    persistSnapshot(get());
  },

  undoLastDraw: () => {
    const state = get();
    if (state.undoStack.length === 0 || isGameBusy(state.gameState)) {
      return false;
    }
    const lastSnap = state.undoStack[state.undoStack.length - 1];
    const remainingUndo = state.undoStack.slice(0, -1);
    const nextHistory = state.winnerHistory.filter((w) => w.id !== lastSnap.winnerRecord.id);

    set({
      participants: lastSnap.participants,
      excludedIds: lastSnap.excludedIds,
      winnerHistory: nextHistory,
      undoStack: remainingUndo,
      currentOutcome: null,
      gameState: lastSnap.participants.length > 0 ? 'ready' : 'idle',
      mascotMood: 'idle',
    });
    persistSnapshot(get());
    return true;
  },

  resetEligibilityPool: () => {
    set({
      excludedIds: [],
      currentOutcome: null,
      gameState: get().participants.length > 0 ? 'ready' : 'idle',
      mascotMood: 'idle',
    });
    persistSnapshot(get());
  },

  clearWinnerHistory: () => {
    set({
      winnerHistory: [],
      excludedIds: [],
      undoStack: [],
    });
    persistSnapshot(get());
  },

  restoreBackup: (backup) => {
    const nextSettings = { ...DEFAULT_DRAW_SETTINGS, ...(backup.settings || {}) };
    audioService.configure({
      soundEnabled: nextSettings.soundEnabled,
      bgmVolume: nextSettings.bgmVolume,
      sfxVolume: nextSettings.sfxVolume,
    });
    set({
      eventName: backup.eventName,
      activeGameId: backup.activeGameId,
      participants: backup.participants,
      excludedIds: backup.excludedIds,
      winnerHistory: backup.winnerHistory,
      settings: nextSettings,
      currentOutcome: null,
      gameState: backup.participants.length > 0 ? 'ready' : 'idle',
    });
    persistSnapshot(get());
  },

  factoryResetAll: () => {
    clearPersistedState();
    const defaults = getDefaultAppState();
    set({
      eventName: defaults.eventName,
      activeGameId: defaults.activeGameId,
      participants: defaults.participants,
      excludedIds: defaults.excludedIds,
      winnerHistory: defaults.winnerHistory,
      settings: defaults.settings,
      undoStack: [],
      currentOutcome: null,
      gameState: 'ready',
      mascotMood: 'idle',
    });
    persistSnapshot(get());
  },
}));

