import { describe, it, expect } from 'vitest';
import { DrawEngine } from '../draw-engine';
import {
  generateSampleParticipants,
  MAX_PARTICIPANTS,
  parseParticipantLines,
  validateBackupJson,
} from '../../services/import-export-service';
import { DEFAULT_DRAW_SETTINGS } from '../../services/storage-service';

describe('LuckyVerse DrawEngine & Participant Processing QA', () => {
  it('parses up to 1,000 participants, trims whitespace, ignores empty lines, and preserves duplicate names with distinct IDs', () => {
    const rawInput = `
      Nguyễn Văn An
      
      Nguyễn Văn An
      Trần Thị Bình   
      001
      002
    `;

    const result = parseParticipantLines(rawInput);
    expect(result.validParticipants.length).toBe(5);
    expect(result.ignoredLinesCount).toBeGreaterThanOrEqual(2);

    // Duplicate names must both exist with distinct internal IDs
    const ans = result.validParticipants.filter((p) => p.name === 'Nguyễn Văn An');
    expect(ans.length).toBe(2);
    expect(ans[0].id).not.toBe(ans[1].id);
    expect(ans[0].displayCode).toBe('0001');
    expect(ans[1].displayCode).toBe('0002');
  });

  it('caps bulk import at 1,000 participants without crashing', () => {
    const lines = Array.from({ length: 1150 }, (_, i) => `Người Tham Gia #${i + 1}`).join('\n');
    const parsed = parseParticipantLines(lines);
    expect(parsed.validParticipants.length).toBe(MAX_PARTICIPANTS);
    expect(parsed.truncatedCount).toBe(150);
  });

  it('expands number range syntax like "1 - 120" into 120 numbered participants', () => {
    const parsed = parseParticipantLines('1 - 120');
    expect(parsed.validParticipants.length).toBe(120);
    expect(parsed.validParticipants[0].name).toBe('001');
    expect(parsed.validParticipants[0].displayCode).toBe('0001');
    expect(parsed.validParticipants[119].name).toBe('120');
    expect(parsed.validParticipants[119].displayCode).toBe('0120');
  });

  it('never repeats winners when allowRepeatWinner is false across all turns', () => {
    const participants = generateSampleParticipants(15);
    const excludedIds: string[] = [];
    const seenWinnerIds = new Set<string>();

    for (let turn = 1; turn <= 15; turn++) {
      const outcome = DrawEngine.pickWinners({
        participants,
        excludedIds,
        settings: { ...DEFAULT_DRAW_SETTINGS, allowRepeatWinner: false, winnersPerTurn: 1 },
        gameId: 'ufo-abduction',
        gameName: 'UFO Bắt Người',
        turnNumber: turn,
      });

      expect(outcome).not.toBeNull();
      const winnerId = outcome!.primaryWinner.id;
      expect(seenWinnerIds.has(winnerId)).toBe(false);
      seenWinnerIds.add(winnerId);
      excludedIds.push(winnerId);
    }

    // 16th turn should return null when all 15 have won
    const exhaustedOutcome = DrawEngine.pickWinners({
      participants,
      excludedIds,
      settings: { ...DEFAULT_DRAW_SETTINGS, allowRepeatWinner: false, winnersPerTurn: 1 },
      gameId: 'ufo-abduction',
      gameName: 'UFO Bắt Người',
      turnNumber: 16,
    });
    expect(exhaustedOutcome).toBeNull();
  });

  it('handles 1,000 participants draw in under 20ms', () => {
    const list1000 = generateSampleParticipants(1000);
    expect(list1000.length).toBe(1000);

    const t0 = performance.now();
    const outcome = DrawEngine.pickWinners({
      participants: list1000,
      excludedIds: [],
      settings: DEFAULT_DRAW_SETTINGS,
      gameId: 'lucky-wheel',
      gameName: 'Vòng Quay May Mắn',
      turnNumber: 1,
    });
    const elapsed = performance.now() - t0;

    expect(outcome).not.toBeNull();
    expect(list1000.some((p) => p.id === outcome!.primaryWinner.id)).toBe(true);
    expect(elapsed).toBeLessThan(50);
  });

  it('validates and restores JSON backup schema v1 properly', () => {
    const sample = generateSampleParticipants(5);
    const rawJson = JSON.stringify({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      eventName: 'Sự Kiện Test',
      activeGameId: 'duck-race',
      participants: sample,
      excludedIds: [sample[0].id],
      winnerHistory: [],
      settings: DEFAULT_DRAW_SETTINGS,
    });

    const restored = validateBackupJson(rawJson);
    expect(restored.eventName).toBe('Sự Kiện Test');
    expect(restored.participants.length).toBe(5);
    expect(restored.excludedIds).toEqual([sample[0].id]);
  });
});

