import { Howler } from 'howler';
import { GameId } from '../types/game';

/**
 * Procedural Arcade & Sci-Fi Audio Engine built on Web Audio API + Howler global management.
 * Generates 100% reliable, zero-latency sound effects and game-specific background music loops
 * without relying on fragile external audio URLs.
 */
class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private soundEnabled = true;
  private bgmVolume = 0.35;
  private sfxVolume = 0.75;
  private unlocked = false;

  private currentBgmGame: GameId | null = null;
  private bgmInterval: number | null = null;
  private bgmStep = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.bgmGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.syncGainValues();
    }
    if (this.ctx.state === 'suspended' && this.unlocked) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlockAudio(): void {
    this.unlocked = true;
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  public configure(params: { soundEnabled: boolean; bgmVolume: number; sfxVolume: number }): void {
    this.soundEnabled = params.soundEnabled;
    this.bgmVolume = Math.max(0, Math.min(1, params.bgmVolume));
    this.sfxVolume = Math.max(0, Math.min(1, params.sfxVolume));
    Howler.mute(!this.soundEnabled);
    this.syncGainValues();
    if (!this.soundEnabled) {
      this.stopBgm();
    }
  }

  private syncGainValues(): void {
    if (!this.ctx || !this.masterGain || !this.bgmGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.soundEnabled ? 1 : 0, now, 0.02);
    this.bgmGain.gain.setTargetAtTime(this.soundEnabled ? this.bgmVolume * 0.32 : 0, now, 0.03);
    this.sfxGain.gain.setTargetAtTime(this.soundEnabled ? this.sfxVolume : 0, now, 0.02);
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainLevel = 0.25,
    delay = 0,
    slideToFreq?: number,
    isBgm = false
  ): void {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.bgmGain) return;

    const startTime = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideToFreq), startTime + duration);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(gainLevel, startTime + Math.min(0.015, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(isBgm ? this.bgmGain : this.sfxGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  // ==================== BGM ENGINE ====================
  public startGameBgm(gameId: GameId): void {
    if (!this.soundEnabled || !this.unlocked) return;
    if (this.currentBgmGame === gameId && this.bgmInterval !== null) return;

    this.stopBgm();
    this.currentBgmGame = gameId;
    this.bgmStep = 0;

    // Distinct melodic motif for each game mode
    const melodies: Record<GameId, { notes: number[]; tempoMs: number; wave: OscillatorType }> = {
      'lucky-wheel': {
        notes: [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 349.23],
        tempoMs: 240,
        wave: 'triangle',
      },
      lottery: {
        notes: [220, 440, 330, 440, 246.94, 493.88, 369.99, 493.88],
        tempoMs: 180,
        wave: 'sine',
      },
      'mystery-box': {
        notes: [329.63, 392.0, 493.88, 659.25, 587.33, 493.88, 392.0, 440.0],
        tempoMs: 280,
        wave: 'sine',
      },
      'duck-race': {
        notes: [349.23, 440.0, 523.25, 440.0, 392.0, 493.88, 587.33, 493.88],
        tempoMs: 170,
        wave: 'square',
      },
      jackpot: {
        notes: [293.66, 369.99, 440.0, 587.33, 440.0, 587.33, 659.25, 587.33],
        tempoMs: 165,
        wave: 'sawtooth',
      },
      'ufo-abduction': {
        notes: [196.0, 293.66, 311.13, 392.0, 293.66, 466.16, 392.0, 311.13],
        tempoMs: 260,
        wave: 'sine',
      },
    };

    const config = melodies[gameId];
    this.bgmInterval = window.setInterval(() => {
      if (!this.soundEnabled) return;
      const note = config.notes[this.bgmStep % config.notes.length];
      this.playTone(note, config.tempoMs / 1000 * 0.85, config.wave, 0.16, 0, undefined, true);
      this.bgmStep++;
    }, config.tempoMs);
  }

  public stopBgm(): void {
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.currentBgmGame = null;
  }

  // ==================== GAME SOUND EFFECTS ====================

  /** Wheel peg tick sound */
  public playWheelTick(pitchFactor = 1): void {
    this.unlockAudio();
    this.playTone(620 * pitchFactor, 0.035, 'triangle', 0.25, 0, 280);
  }

  /** Countdown 3 - 2 - 1 - GO */
  public playCountdownBeep(isFinal = false): void {
    this.unlockAudio();
    if (isFinal) {
      this.playTone(880, 0.28, 'triangle', 0.35, 0, 1174.66);
      this.playTone(1318.5, 0.3, 'sine', 0.25, 0.04);
    } else {
      this.playTone(440, 0.14, 'sine', 0.28);
    }
  }

  /** Lottery digital scan tick */
  public playLotteryDigitTick(index = 0): void {
    this.unlockAudio();
    this.playTone(720 + index * 90, 0.045, 'sine', 0.18);
  }

  /** Lottery single digit lock-in */
  public playLotteryDigitLock(digitOrder: number): void {
    this.unlockAudio();
    const base = 440 + digitOrder * 110;
    this.playTone(base, 0.16, 'triangle', 0.32, 0, base * 1.25);
  }

  /** Mystery box shake & magic shimmer */
  public playBoxShake(): void {
    this.unlockAudio();
    this.playTone(300, 0.08, 'triangle', 0.22, 0, 420);
    this.playTone(460, 0.08, 'sine', 0.18, 0.07, 600);
  }

  public playBoxOpenMagic(): void {
    this.unlockAudio();
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.25, 'sine', 0.25, idx * 0.055);
    });
  }

  /** Duck race whistle & quack */
  public playRaceWhistle(): void {
    this.unlockAudio();
    this.playTone(1450, 0.12, 'triangle', 0.32, 0, 1650);
    this.playTone(1580, 0.28, 'triangle', 0.35, 0.14, 1820);
  }

  public playDuckQuack(pitchOffset = 1): void {
    this.unlockAudio();
    const start = 380 * pitchOffset;
    this.playTone(start, 0.09, 'sawtooth', 0.16, 0, start * 0.68);
    this.playTone(start * 1.15, 0.08, 'triangle', 0.12, 0.02, start * 0.72);
  }

  /** Jackpot reel spin & stop */
  public playReelSpinTick(): void {
    this.unlockAudio();
    this.playTone(350, 0.03, 'square', 0.12, 0, 450);
  }

  public playReelStop(reelIndex: number): void {
    this.unlockAudio();
    const freq = 260 + reelIndex * 95;
    this.playTone(freq, 0.14, 'triangle', 0.34, 0, freq * 0.8);
    this.playTone(freq * 2, 0.1, 'sine', 0.2, 0.02);
  }

  /** UFO sci-fi sounds */
  public playUfoArrival(): void {
    this.unlockAudio();
    this.playTone(180, 0.65, 'sine', 0.28, 0, 520);
    this.playTone(520, 0.55, 'triangle', 0.2, 0.35, 260);
  }

  public playUfoScanSweep(): void {
    this.unlockAudio();
    this.playTone(660, 0.22, 'sine', 0.18, 0, 380);
    this.playTone(380, 0.22, 'sine', 0.18, 0.22, 740);
  }

  public playTractorBeam(): void {
    this.unlockAudio();
    const chords = [220, 277.18, 329.63, 440, 554.37, 659.25];
    chords.forEach((f, idx) => {
      this.playTone(f, 0.55, 'sine', 0.16, idx * 0.09, f * 1.35);
    });
  }

  public playUfoAbductWhoosh(): void {
    this.unlockAudio();
    this.playTone(260, 0.48, 'sine', 0.3, 0, 1280);
    this.playTone(390, 0.45, 'triangle', 0.22, 0.06, 1560);
  }

  /** Slapstick cartoon vehicle bonk & ricochet sound */
  public playCartoonBonk(): void {
    this.unlockAudio();
    this.playTone(190, 0.14, 'sawtooth', 0.24, 0, 680);
    this.playTone(520, 0.18, 'triangle', 0.22, 0.05, 980);
  }

  public playWallBounce(): void {
    this.unlockAudio();
    this.playTone(420, 0.11, 'sine', 0.18, 0, 220);
  }

  /** Water fountain splash sound */
  public playWaterSplash(): void {
    this.unlockAudio();
    this.playTone(320, 0.14, 'sine', 0.2, 0, 140);
    this.playTone(580, 0.16, 'triangle', 0.15, 0.04, 860);
    this.playTone(740, 0.12, 'sine', 0.12, 0.09, 420);
  }

  /** Grand Winner Fanfare */
  public playWinnerFanfare(gameId?: GameId): void {
    this.unlockAudio();
    if (gameId === 'ufo-abduction') {
      const notes = [392.0, 523.25, 659.25, 783.99, 1046.5, 1174.66, 1567.98];
      notes.forEach((n, i) => {
        this.playTone(n, 0.32, 'triangle', 0.26, i * 0.075);
      });
      return;
    }

    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, idx) => {
      this.playTone(freq, 0.18, 'triangle', 0.28, idx * 0.09);
    });
    this.playTone(1046.5, 0.55, 'triangle', 0.34, 0.38);
    this.playTone(1318.5, 0.55, 'sine', 0.25, 0.42);
  }

  /** UI Button click */
  public playClick(): void {
    this.unlockAudio();
    this.playTone(540, 0.04, 'sine', 0.15, 0, 720);
  }
}

export const audioService = new AudioService();

