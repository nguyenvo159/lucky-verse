import { GameState } from '../types/game';

const VALID_TRANSITIONS: Record<GameState, GameState[]> = {
  idle: ['ready', 'countdown', 'running', 'resetting'],
  ready: ['idle', 'countdown', 'running', 'resetting'],
  countdown: ['running', 'resetting', 'idle', 'ready'],
  running: ['revealing', 'winner', 'resetting', 'idle', 'ready'],
  revealing: ['winner', 'resetting', 'idle', 'ready'],
  winner: ['ready', 'idle', 'resetting', 'countdown', 'running'],
  resetting: ['idle', 'ready'],
};

export function canTransitionState(from: GameState, to: GameState): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isGameBusy(state: GameState): boolean {
  return state === 'countdown' || state === 'running' || state === 'revealing';
}

