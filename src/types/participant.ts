export interface Participant {
  /** Internal unique ID for each row (allows identical names to coexist as separate entries) */
  id: string;
  /** Trimmed display name */
  name: string;
  /** Unique numeric/alphanumeric code for Lottery & Duck Race identification (e.g., "0001") */
  displayCode: string;
  /** Deterministic visual seed for avatar/duck customization */
  avatarSeed: number;
  /** Timestamp when added */
  createdAt: number;
}

export interface ParseParticipantsResult {
  validParticipants: Participant[];
  ignoredLinesCount: number;
  truncatedCount: number;
  totalProcessed: number;
}

