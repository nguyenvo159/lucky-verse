import { GameId } from './game';
import { Participant } from './participant';

export interface WinnerRecord {
  id: string;
  turnNumber: number;
  participantId: string;
  participantName: string;
  displayCode: string;
  avatarSeed: number;
  /** Additional winners if winnersPerTurn > 1 */
  coWinners?: Participant[];
  gameId: GameId;
  gameName: string;
  timestamp: number;
  removedFromOriginalList: boolean;
}

export interface UndoSnapshot {
  participants: Participant[];
  excludedIds: string[];
  winnerRecord: WinnerRecord;
}

