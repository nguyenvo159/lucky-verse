import { Participant } from '../types/participant';
import { DrawSettings, GameId } from '../types/game';
import { WinnerRecord } from '../types/winner';
import { getCryptoRandomInt, generateUniqueId } from './random';

export interface DrawOutcome {
  primaryWinner: Participant;
  allWinners: Participant[];
  winnerRecord: WinnerRecord;
}

export class DrawEngine {
  /**
   * Filters participants down to those currently eligible to win.
   * When allowRepeatWinner is false, anyone in excludedIds is filtered out.
   */
  static getEligibleParticipants(
    participants: Participant[],
    excludedIds: Set<string> | string[],
    allowRepeatWinner: boolean
  ): Participant[] {
    if (allowRepeatWinner) {
      return participants;
    }
    const excludedSet = excludedIds instanceof Set ? excludedIds : new Set(excludedIds);
    return participants.filter((p) => !excludedSet.has(p.id));
  }

  /**
   * Picks winner(s) purely via cryptographic RNG BEFORE any game animation begins.
   * Guarantees zero bias from visual positions, frame rates, or button timing.
   */
  static pickWinners(params: {
    participants: Participant[];
    excludedIds: string[];
    settings: DrawSettings;
    gameId: GameId;
    gameName: string;
    turnNumber: number;
  }): DrawOutcome | null {
    const { participants, excludedIds, settings, gameId, gameName, turnNumber } = params;

    const eligible = DrawEngine.getEligibleParticipants(
      participants,
      excludedIds,
      settings.allowRepeatWinner
    );

    if (eligible.length === 0) {
      return null;
    }

    const countToPick = Math.max(1, Math.min(settings.winnersPerTurn || 1, eligible.length));
    const pool = [...eligible];
    const picked: Participant[] = [];

    for (let i = 0; i < countToPick; i++) {
      const randomIndex = getCryptoRandomInt(pool.length);
      const [chosen] = pool.splice(randomIndex, 1);
      picked.push(chosen);
    }

    const primaryWinner = picked[0];
    const coWinners = picked.length > 1 ? picked.slice(1) : undefined;

    const winnerRecord: WinnerRecord = {
      id: generateUniqueId('win'),
      turnNumber,
      participantId: primaryWinner.id,
      participantName: primaryWinner.name,
      displayCode: primaryWinner.displayCode,
      avatarSeed: primaryWinner.avatarSeed,
      coWinners,
      gameId,
      gameName,
      timestamp: Date.now(),
      removedFromOriginalList: settings.winnerRemovalMode === 'auto-remove',
    };

    return {
      primaryWinner,
      allWinners: picked,
      winnerRecord,
    };
  }
}

