/**
 * Cryptographically unbiased random utilities for LuckyVerse DrawEngine.
 * Uses window.crypto.getRandomValues() with rejection sampling to eliminate modulo bias.
 */

export function getCryptoRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0 || !Number.isInteger(maxExclusive)) {
    throw new Error(`Invalid maxExclusive: ${maxExclusive}`);
  }
  if (maxExclusive === 1) {
    return 0;
  }

  const cryptoObj =
    typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function'
      ? globalThis.crypto
      : null;

  if (cryptoObj) {
    const uint32Max = 0xffffffff;
    const limit = uint32Max - ((uint32Max + 1) % maxExclusive);
    const buffer = new Uint32Array(1);

    while (true) {
      cryptoObj.getRandomValues(buffer);
      const value = buffer[0];
      if (value <= limit) {
        return value % maxExclusive;
      }
    }
  }

  // Fallback only if Web Crypto API is completely unavailable in environment
  return Math.floor(Math.random() * maxExclusive);
}

/**
 * Generates a unique internal ID using crypto.randomUUID or crypto random bytes.
 */
export function generateUniqueId(prefix = 'p'): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  const randA = getCryptoRandomInt(1_000_000_000).toString(36);
  const randB = getCryptoRandomInt(1_000_000_000).toString(36);
  return `${prefix}_${Date.now().toString(36)}_${randA}${randB}`;
}

/**
 * Unbiased Fisher-Yates shuffle using getCryptoRandomInt.
 */
export function cryptoShuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = getCryptoRandomInt(i + 1);
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Deterministic visual seed generator for participant avatars / ducks (NOT used for draw outcomes).
 */
export function computeVisualSeed(input: string, index: number): number {
  let hash = 2166136261 ^ index;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

