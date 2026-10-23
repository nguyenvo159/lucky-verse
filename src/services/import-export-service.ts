import { Participant, ParseParticipantsResult } from '../types/participant';
import { WinnerRecord } from '../types/winner';
import { DrawSettings, GameId } from '../types/game';
import { computeVisualSeed, generateUniqueId } from '../engine/random';

export const MAX_PARTICIPANTS = 1000;

export const SAMPLE_VIETNAMESE_PARTICIPANTS = [
  'Nguyễn Văn An',
  'Trần Thị Bình',
  'Lê Minh Cường',
  'Phạm Ngọc Dung',
  'Hoàng Gia Bảo',
  'Vũ Thị Mai Anh',
  'Đặng Quốc Khánh',
  'Bùi Thanh Hà',
  'Đỗ Hoàng Nam',
  'Hồ Thảo Nguyên',
  'Ngô Tuấn Kiệt',
  'Dương Minh Châu',
  'Lý Khánh Linh',
  'Trương Quốc Anh',
  'Phan Bảo Ngọc',
  'Đinh Thiên Ân',
  'Lương Nhật Minh',
  'Mai Phương Thảo',
  'Tạ Quang Huy',
  'Châu Ngọc Hân',
  'Võ Hoàng Quân',
  'Hà Minh Thư',
  'Kiều Anh Tuấn',
  'Đoàn Yến Nhi',
];

/**
 * Formats an integer index (1-based) into a zero-padded display code (e.g. "001" or "0001").
 */
export function formatDisplayCode(oneBasedIndex: number, minDigits = 4): string {
  return String(oneBasedIndex).padStart(minDigits, '0');
}

/**
 * Detects if a line is a number range expression like:
 * "1 - 120", "001 - 120", "1-120", "1..120", "1 đến 120", "Số 1 - 120", "Vé 1 - 120"
 */
export function expandNumberRangeLine(line: string): string[] | null {
  const trimmed = line.trim();
  const rangeRegex = /^(?:(số|vé|stt|mã|#)\s*)?(\d{1,6})\s*(?:-|–|—|~|\.\.|đến|to)\s*(?:(?:số|vé|stt|mã|#)\s*)?(\d{1,6})$/i;
  const match = trimmed.match(rangeRegex);
  if (!match) return null;

  const prefixRaw = match[1] ? `${match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()} ` : '';
  const startStr = match[2];
  const endStr = match[3];
  const startNum = parseInt(startStr, 10);
  const endNum = parseInt(endStr, 10);

  if (isNaN(startNum) || isNaN(endNum)) return null;

  const count = Math.abs(endNum - startNum) + 1;
  if (count <= 1 || count > 5000) return null;

  const step = startNum <= endNum ? 1 : -1;
  // Determine zero-padding: if user typed "001 - 120" or if range is pure numbers, pad nicely (e.g. 001..120)
  const hasLeadingZero = startStr.length > 1 && startStr.startsWith('0');
  const padDigits = hasLeadingZero
    ? Math.max(startStr.length, endStr.length)
    : Math.max(String(Math.max(startNum, endNum)).length, 3);

  const expanded: string[] = [];
  for (let i = 0; i < count && expanded.length < MAX_PARTICIPANTS + 200; i++) {
    const num = startNum + i * step;
    const formattedNum = String(num).padStart(padDigits, '0');
    expanded.push(prefixRaw ? `${prefixRaw}${formattedNum}` : formattedNum);
  }
  return expanded;
}

/**
 * Generates multiline string for a numeric range (e.g. 1 to 120).
 */
export function generateNumberRangeLines(
  fromNum: number,
  toNum: number,
  prefix = '',
  padDigits = 3
): string {
  const start = Math.max(0, Math.floor(fromNum));
  const end = Math.max(0, Math.floor(toNum));
  const step = start <= end ? 1 : -1;
  const total = Math.min(MAX_PARTICIPANTS, Math.abs(end - start) + 1);
  const effectivePad = Math.max(padDigits, String(Math.max(start, end)).length);

  const lines: string[] = [];
  for (let i = 0; i < total; i++) {
    const n = start + i * step;
    const code = effectivePad > 1 ? String(n).padStart(effectivePad, '0') : String(n);
    lines.push(prefix.trim() ? `${prefix.trim()} ${code}` : code);
  }
  return lines.join('\n');
}

/**
 * Extracts a numeric code from a participant's name if the name is a number (e.g. "045" or "Số 045" -> 45).
 */
function extractNumericCodeFromName(name: string, fallbackSeq: number): string {
  const pureMatch = name.trim().match(/^(?:số|vé|stt|mã|#)?\s*(\d{1,6})$/i);
  if (pureMatch) {
    const num = parseInt(pureMatch[1], 10);
    if (!isNaN(num) && num >= 0) {
      return formatDisplayCode(num, 4);
    }
  }
  return formatDisplayCode(fallbackSeq, 4);
}

/**
 * Parses multiline text, number ranges (e.g., "1 - 120"), or CSV rows into Participant objects.
 * Rules:
 * - Expands number range lines like "1 - 120" into 120 individual numbered participants
 * - Ignores empty lines
 * - Trims leading/trailing whitespace
 * - Does NOT deduplicate identical names (each row gets its own unique internal ID)
 * - Caps total list at MAX_PARTICIPANTS (1000)
 */
export function parseParticipantLines(
  rawText: string,
  startingIndexOffset = 0,
  maxAllowed = MAX_PARTICIPANTS
): ParseParticipantsResult {
  const rawLines = rawText.split(/\r?\n/);
  let ignoredLinesCount = 0;
  let truncatedCount = 0;
  const validParticipants: Participant[] = [];
  const now = Date.now();

  // First pass: expand any range lines like "1 - 120"
  const expandedLines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    if (!trimmed) {
      ignoredLinesCount++;
      continue;
    }
    const rangeItems = expandNumberRangeLine(trimmed);
    if (rangeItems) {
      expandedLines.push(...rangeItems);
    } else {
      expandedLines.push(trimmed);
    }
  }

  for (let i = 0; i < expandedLines.length; i++) {
    let line = expandedLines[i].trim();
    if (!line) {
      ignoredLinesCount++;
      continue;
    }

    // If CSV line has commas, extract meaningful name or combine columns cleanly
    if (line.includes(',')) {
      const cols = line
        .split(',')
        .map((c) => c.trim().replace(/^["']|["']$/g, '').trim())
        .filter(Boolean);
      if (cols.length === 0) {
        ignoredLinesCount++;
        continue;
      }
      const lowerFirst = cols[0].toLowerCase();
      if (
        i === 0 &&
        (lowerFirst === 'name' ||
          lowerFirst === 'tên' ||
          lowerFirst === 'họ và tên' ||
          lowerFirst === 'stt' ||
          lowerFirst === 'id')
      ) {
        if (cols.length > 1 && (cols[1].toLowerCase().includes('tên') || cols[1].toLowerCase() === 'name')) {
          ignoredLinesCount++;
          continue;
        }
        if (cols.length === 1) {
          ignoredLinesCount++;
          continue;
        }
      }
      line = cols.length >= 2 ? `${cols[0]} - ${cols.slice(1).join(' ')}` : cols[0];
    }

    if (validParticipants.length >= maxAllowed) {
      truncatedCount++;
      continue;
    }

    const seqNum = startingIndexOffset + validParticipants.length + 1;
    const id = generateUniqueId('p');
    const displayCode = extractNumericCodeFromName(line, seqNum);

    validParticipants.push({
      id,
      name: line,
      displayCode,
      avatarSeed: computeVisualSeed(`${id}_${line}`, seqNum),
      createdAt: now + i,
    });
  }

  return {
    validParticipants,
    ignoredLinesCount,
    truncatedCount,
    totalProcessed: expandedLines.length + ignoredLinesCount,
  };
}

/**
 * Re-indexes displayCode sequentially while preserving explicit numeric names (e.g. "045" stays "#0045").
 */
export function reindexParticipants(participants: Participant[], digits = 4): Participant[] {
  return participants.map((p, idx) => ({
    ...p,
    displayCode: extractNumericCodeFromName(p.name, idx + 1).padStart(Math.max(digits, 3), '0'),
  }));
}

/**
 * Generates a large stress-test participant list (e.g., 24, 120, or 1000 people).
 */
export function generateSampleParticipants(count = 24): Participant[] {
  const familyNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ'];
  const middleNames = ['Văn', 'Thị', 'Minh', 'Ngọc', 'Quốc', 'Gia', 'Thanh', 'Hoàng', 'Thảo', 'Tuấn', 'Bảo', 'Nhật'];
  const givenNames = [
    'An', 'Bình', 'Cường', 'Dung', 'Bảo', 'Anh', 'Khánh', 'Hà', 'Nam', 'Nguyên',
    'Kiệt', 'Châu', 'Linh', 'Huy', 'Hân', 'Quân', 'Thư', 'Nhi', 'Phúc', 'Tâm',
  ];

  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    if (i < SAMPLE_VIETNAMESE_PARTICIPANTS.length && count <= 30) {
      lines.push(SAMPLE_VIETNAMESE_PARTICIPANTS[i]);
    } else {
      const f = familyNames[i % familyNames.length];
      const m = middleNames[Math.floor(i / familyNames.length) % middleNames.length];
      const g = givenNames[Math.floor(i / 5) % givenNames.length];
      lines.push(`${f} ${m} ${g} #${String(i + 1).padStart(3, '0')}`);
    }
  }
  return parseParticipantLines(lines.join('\n')).validParticipants;
}

/**
 * Exports participant list to CSV file download.
 */
export function exportParticipantsToCsv(participants: Participant[], eventName: string): void {
  const header = 'STT,Mã Số,Họ và Tên\n';
  const rows = participants
    .map((p, i) => `${i + 1},"${p.displayCode}","${p.name.replace(/"/g, '""')}"`)
    .join('\n');

  const csvContent = '\uFEFF' + header + rows;
  triggerFileDownload(csvContent, `luckyverse-danh-sach-${slugify(eventName)}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Exports winner history to CSV file download.
 */
export function exportWinnersToCsv(winners: WinnerRecord[], eventName: string): void {
  const header = 'Lượt Quay,Mã Số,Người Chiến Thắng,Trò Chơi,Thời Gian,Người Cùng Thắng\n';
  const rows = winners
    .map((w) => {
      const timeStr = new Date(w.timestamp).toLocaleString('vi-VN');
      const coNames = w.coWinners?.map((c) => c.name).join('; ') ?? '';
      return `${w.turnNumber},"${w.displayCode}","${w.participantName.replace(/"/g, '""')}","${w.gameName}","${timeStr}","${coNames.replace(/"/g, '""')}"`;
    })
    .join('\n');

  const csvContent = '\uFEFF' + header + rows;
  triggerFileDownload(csvContent, `luckyverse-ket-qua-${slugify(eventName)}.csv`, 'text/csv;charset=utf-8;');
}

export interface BackupPayloadV1 {
  schemaVersion: 1;
  exportedAt: string;
  eventName: string;
  activeGameId: GameId;
  participants: Participant[];
  excludedIds: string[];
  winnerHistory: WinnerRecord[];
  settings: DrawSettings;
}

export function exportFullBackupJson(payload: Omit<BackupPayloadV1, 'schemaVersion' | 'exportedAt'>): void {
  const fullData: BackupPayloadV1 = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    ...payload,
  };
  const jsonString = JSON.stringify(fullData, null, 2);
  triggerFileDownload(
    jsonString,
    `luckyverse-backup-${slugify(payload.eventName)}.json`,
    'application/json;charset=utf-8;'
  );
}

export function validateBackupJson(rawText: string): BackupPayloadV1 {
  const parsed = JSON.parse(rawText);
  if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== 1) {
    throw new Error('File sao lưu không đúng định dạng LuckyVerse Schema v1.');
  }
  if (!Array.isArray(parsed.participants)) {
    throw new Error('Dữ liệu danh sách người tham gia không hợp lệ.');
  }
  const safeParticipants: Participant[] = parsed.participants
    .slice(0, MAX_PARTICIPANTS)
    .filter((p: unknown): p is Participant => {
      if (!p || typeof p !== 'object') return false;
      const obj = p as Record<string, unknown>;
      return typeof obj.id === 'string' && typeof obj.name === 'string' && obj.name.trim().length > 0;
    })
    .map((p: Participant, idx: number) => ({
      id: p.id,
      name: p.name.trim(),
      displayCode: p.displayCode || formatDisplayCode(idx + 1, 4),
      avatarSeed: typeof p.avatarSeed === 'number' ? p.avatarSeed : computeVisualSeed(p.id, idx + 1),
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    }));

  return {
    schemaVersion: 1,
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    eventName: typeof parsed.eventName === 'string' ? parsed.eventName : 'Sự kiện LuckyVerse',
    activeGameId: parsed.activeGameId || 'lucky-wheel',
    participants: safeParticipants,
    excludedIds: Array.isArray(parsed.excludedIds) ? parsed.excludedIds : [],
    winnerHistory: Array.isArray(parsed.winnerHistory) ? parsed.winnerHistory : [],
    settings: parsed.settings,
  };
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'event'
  );
}

function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
