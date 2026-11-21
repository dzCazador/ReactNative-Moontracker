/**
 * expo-audio adapter for the AudioEngine domain interface.
 *
 * expo-audio is a per-instance player, so each logical deck (A = main one-shot,
 * B = intermediate loop) gets its own AudioPlayer instance. This adapter maps
 * native calls and events to domain types and normalizes errors.
 *
 * Lifecycle:
 *  - setup() configures the audio session and creates both deck players.
 *  - teardown() releases all players and removes listeners.
 */

import type { AudioSource } from 'expo-audio';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import type {
  AudioEngine,
  AudioEngineEvent,
  AudioEngineEventType,
  AudioEngineOptions,
  AudioEngineState,
  AudioTrack,
  DeckId,
  DeckPlayerState,
  DeckStatus,
  EngineError,
} from '@/features/audio/types';
import { logger } from '@/lib/logger';

const ANDROID_BACKGROUND_ERROR_CODE = 'android_cannot_setup_player_in_background';

/**
 * Maps a native playback error to a domain error category.
 */
function normalizeEngineError(error: unknown): EngineError {
  const raw = error as { message?: string } | undefined;
  const message = String(raw?.message ?? error ?? 'Unknown audio engine error');
  const lower = message.toLowerCase();

  if (lower.includes(ANDROID_BACKGROUND_ERROR_CODE) || lower.includes('background')) {
    return {
      code: 'INIT_FAILED',
      message: 'Audio engine could not initialize in the background',
      fatal: false,
      context: { original: message },
    };
  }
  if (lower.includes('not found') || lower.includes('no such file') || lower.includes('missing')) {
    return {
      code: 'MISSING_FILE',
      message: 'Audio file not found',
      fatal: false,
      context: { original: message },
    };
  }
  if (lower.includes('decode') || lower.includes('format') || lower.includes('codec')) {
    return {
      code: 'DECODE_FAILED',
      message: 'Audio decoding failed',
      fatal: false,
      context: { original: message },
    };
  }
  if (lower.includes('focus')) {
    return {
      code: 'FOCUS_LOST',
      message: 'Audio focus lost',
      fatal: false,
      context: { original: message },
    };
  }
  if (lower.includes('setup') || lower.includes('initializ')) {
    return {
      code: 'INIT_FAILED',
      message: 'Audio engine initialization failed',
      fatal: false,
      context: { original: message },
    };
  }
  return { code: 'UNKNOWN', message, fatal: false, context: { original: message } };
}

function mapExpoState(status: AudioStatus): DeckPlayerState {
  if (!status.isLoaded) return 'idle';
  if (status.isBuffering) return 'loading';
  if (status.playing) return 'playing';
  if (!status.playing && status.isLoaded) return 'paused';
  return 'stopped';
}

function emptyDeckStatus(): DeckStatus {
  return { track: null, state: 'idle', positionSec: 0, durationSec: null };
}

function audioSourceFromTrack(track: AudioTrack): AudioSource {
  return { uri: track.uri };
}

export class ExpoAudioAdapter implements AudioEngine {
  private _isSetup = false;
  private setupError: EngineError | null = null;
  private activeDeck: DeckId | null = null;
  private volume = 1;
  private deckA: DeckStatus = emptyDeckStatus();
  private deckB: DeckStatus = emptyDeckStatus();
  private error: EngineError | null = null;
  private players = new Map<DeckId, AudioPlayer>();
  private listeners = new Set<(event: AudioEngineEvent) => void>();
  private options: AudioEngineOptions = {};
  private positionIntervals = new Map<DeckId, ReturnType<typeof setInterval>>();

  private emit(
    type: AudioEngineEventType,
    payload?: Record<string, unknown>,
    deck?: DeckId | null,
    trackId?: string
  ): void {
    const event: AudioEngineEvent = {
      type,
      deck,
      trackId,
      timestampMs: Date.now(),
      payload,
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        logger.warn('[ExpoAudioAdapter] event listener threw', { error, type });
      }
    }
  }

  private setDeckState(deck: DeckId, partial: Partial<DeckStatus>): void {
    const current = deck === 'A' ? this.deckA : this.deckB;
    const updated = { ...current, ...partial };
    if (deck === 'A') this.deckA = updated;
    else this.deckB = updated;
  }

  private setError(err: EngineError | null): void {
    this.error = err;
    if (err) {
      const deck = this.activeDeck ?? 'A';
      this.setDeckState(deck, { state: 'error' });
    }
  }

  private getPlayer(deck: DeckId): AudioPlayer | undefined {
    return this.players.get(deck);
  }

  private startPositionPolling(deck: DeckId): void {
    this.stopPositionPolling(deck);
    this.positionIntervals.set(
      deck,
      setInterval(() => {
        const player = this.getPlayer(deck);
        if (!player) return;

        try {
          // Read currentTime and duration directly from player properties
          const positionSec = Math.max(0, player.currentTime ?? 0);
          const durationSec = player.duration > 0 ? player.duration : null;

          this.setDeckState(deck, { positionSec, durationSec });
          this.emit('progress', { position: positionSec, duration: durationSec }, deck);

          // Detect track end for deck A (one-shot) -> emit track-ended
          if (
            deck === 'A' &&
            durationSec != null &&
            durationSec > 0 &&
            player.isLoaded &&
            !player.playing &&
            positionSec >= durationSec - 1
          ) {
            this.stopPositionPolling(deck);
            this.setDeckState(deck, { state: 'stopped' });
            this.emit('track-ended', undefined, deck);
          }
        } catch (error) {
          logger.warn('[ExpoAudioAdapter] poll error', { error: String(error) });
        }
      }, 250) // Poll every 250ms for more accurate detection
    );
  }

  private stopPositionPolling(deck: DeckId): void {
    const interval = this.positionIntervals.get(deck);
    if (interval) {
      clearInterval(interval);
      this.positionIntervals.delete(deck);
    }
  }

  async setup(options: AudioEngineOptions = {}): Promise<void> {
    if (this._isSetup) {
      this.options = { ...this.options, ...options };
      return;
    }

    this.options = options;

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });

      for (const deck of ['A', 'B'] as DeckId[]) {
        const player = createAudioPlayer(null);
        player.loop = deck === 'B';
        this.players.set(deck, player);
      }

      this._isSetup = true;
      this.setupError = null;

      logger.audio('[ExpoAudioAdapter] setup completed');
      this.emit('setup-completed');
    } catch (error) {
      this._isSetup = false;
      const engineError = normalizeEngineError(error);
      this.setupError = engineError;

      if (
        engineError.code === 'INIT_FAILED' &&
        String(error).includes(ANDROID_BACKGROUND_ERROR_CODE)
      ) {
        // No AppState retry in this adapter; recover() handles re-initialization.
      }

      logger.error('[ExpoAudioAdapter] setup failed', { error: engineError });
      this.emit('setup-failed', { error: engineError });
    }
  }

  async teardown(): Promise<void> {
    for (const deck of ['A', 'B'] as DeckId[]) {
      this.stopPositionPolling(deck);
      const player = this.getPlayer(deck);
      if (player) {
        try {
          player.remove();
        } catch {
          // Ignore removal errors.
        }
      }
    }
    this.players.clear();
    this.listeners.clear();

    this._isSetup = false;
    this.setupError = null;
    this.activeDeck = null;
    this.deckA = emptyDeckStatus();
    this.deckB = emptyDeckStatus();
    this.error = null;
  }

  isSetup(): boolean {
    return this._isSetup;
  }

  async load(track: AudioTrack, deck: DeckId): Promise<void> {
    if (!this._isSetup) {
      throw new Error(`ExpoAudioAdapter: not initialized (deck ${deck}, track ${track.id})`);
    }

    const player = this.getPlayer(deck);
    if (!player) {
      throw new Error(`ExpoAudioAdapter: no player for deck ${deck}`);
    }

    try {
      logger.audio('[ExpoAudioAdapter] load start', { deck, trackId: track.id, uri: track.uri });
      player.replace(track.uri as any);
      player.loop = deck === 'B' && track.loop;
      this.activeDeck = deck;
      this.setDeckState(deck, {
        track,
        state: 'loading',
        positionSec: 0,
        durationSec: track.durationMs != null ? track.durationMs / 1000 : null,
      });
      const otherDeck = deck === 'A' ? 'B' : 'A';
      this.setDeckState(otherDeck, { state: 'idle' });

      logger.audio('[ExpoAudioAdapter] load completed', { deck, trackId: track.id });
      this.emit('track-changed', { trackId: track.id, deck, uri: track.uri }, deck, track.id);

      this.startPositionPolling(deck);
    } catch (error) {
      logger.audio('[ExpoAudioAdapter] load error', { deck, trackId: track.id, error: String(error) });
      const engineError = normalizeEngineError(error);
      this.setDeckState(deck, { state: 'error' });
      this.setError(engineError);
      this.emit('playback-error', { error: engineError, trackId: track.id }, deck, track.id);
      throw engineError;
    }
  }

  async play(deck: DeckId): Promise<void> {
    if (!this._isSetup) {
      const err: EngineError = {
        code: 'NOT_READY',
        message: 'Audio engine not initialized',
        fatal: false,
      };
      this.emit('playback-error', { error: err }, deck);
      throw err;
    }
    this.activeDeck = deck;
    const player = this.getPlayer(deck);
    if (!player) {
      const err: EngineError = {
        code: 'NOT_READY',
        message: `No player for deck ${deck}`,
        fatal: false,
      };
      this.emit('playback-error', { error: err }, deck);
      throw err;
    }
    try {
      player.play();
      this.setDeckState(deck, { state: 'playing' });
      logger.audio('[ExpoAudioAdapter] play', { deck });
    } catch (error) {
      const engineError = normalizeEngineError(error);
      this.setDeckState(deck, { state: 'error' });
      this.setError(engineError);
      this.emit('playback-error', { error: engineError }, deck);
      throw engineError;
    }
  }

  async pause(deck: DeckId): Promise<void> {
    if (!this._isSetup) {
      const err: EngineError = {
        code: 'NOT_READY',
        message: 'Audio engine not initialized',
        fatal: false,
      };
      throw err;
    }
    this.activeDeck = deck;
    const player = this.getPlayer(deck);
    if (!player) return;
    try {
      player.pause();
      this.setDeckState(deck, { state: 'paused' });
      logger.audio('[ExpoAudioAdapter] pause', { deck });
    } catch (error) {
      const engineError = normalizeEngineError(error);
      this.setDeckState(deck, { state: 'error' });
      this.setError(engineError);
      throw engineError;
    }
  }

  async stop(deck: DeckId): Promise<void> {
    if (!this._isSetup) return;
    this.stopPositionPolling(deck);
    const player = this.getPlayer(deck);
    if (player) {
      try {
        player.pause();
        player.seekTo(0);
      } catch (error) {
        logger.warn('[ExpoAudioAdapter] stop failed', { error });
      }
    }
    this.setDeckState(deck, { state: 'stopped', positionSec: 0 });
    this.activeDeck = null;
    this.emit('remote-stop', undefined, deck);
  }

  async seek(deck: DeckId, positionSec: number): Promise<void> {
    if (!this._isSetup) {
      const err: EngineError = {
        code: 'NOT_READY',
        message: 'Audio engine not initialized',
        fatal: false,
      };
      throw err;
    }
    this.activeDeck = deck;
    const player = this.getPlayer(deck);
    if (!player) return;
    try {
      player.seekTo(Math.max(0, positionSec));
      this.setDeckState(deck, { positionSec: Math.max(0, positionSec) });
    } catch (error) {
      const engineError = normalizeEngineError(error);
      this.setDeckState(deck, { state: 'error' });
      this.setError(engineError);
      throw engineError;
    }
  }

  async setVolume(level: number): Promise<void> {
    const clamped = Math.min(Math.max(level, 0), 1);
    this.volume = clamped;
    for (const player of this.players.values()) {
      try {
        player.volume = clamped;
      } catch {
        // Ignore per-player volume errors.
      }
    }
    logger.audio('[ExpoAudioAdapter] setVolume', { level: clamped });
  }

  async getVolume(): Promise<number> {
    return this.volume;
  }

  async setLoop(deck: DeckId, enabled: boolean): Promise<void> {
    if (!this._isSetup) {
      const err: EngineError = {
        code: 'NOT_READY',
        message: 'Audio engine not initialized',
        fatal: false,
      };
      throw err;
    }
    this.activeDeck = deck;
    const player = this.getPlayer(deck);
    if (!player) return;
    try {
      player.loop = enabled;
      this.setDeckState(deck, { state: this.deckStateFor(deck) });
      logger.audio('[ExpoAudioAdapter] setLoop', { deck, enabled });
    } catch (error) {
      const engineError = normalizeEngineError(error);
      this.setDeckState(deck, { state: 'error' });
      this.setError(engineError);
      throw engineError;
    }
  }

  async getPosition(deck: DeckId): Promise<number> {
    if (!this._isSetup) return 0;
    const player = this.getPlayer(deck);
    if (!player) return this.deckPosition(deck);
    return Math.max(0, player.currentTime ?? 0);
  }

  async getDuration(deck: DeckId): Promise<number | null> {
    if (!this._isSetup) return null;
    const player = this.getPlayer(deck);
    if (!player) return this.deckDuration(deck);
    return player.duration > 0 ? player.duration : null;
  }

  onEvent(listener: (event: AudioEngineEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): AudioEngineState {
    return {
      isSetup: this._isSetup,
      setupError: this.setupError,
      deckA: this.deckA,
      deckB: this.deckB,
      volume: this.volume,
      activeDeck: this.activeDeck,
      error: this.error,
    };
  }

  private deckStateFor(deck: DeckId): DeckPlayerState {
    return deck === 'A' ? this.deckA.state : this.deckB.state;
  }

  private deckPosition(deck: DeckId): number {
    return deck === 'A' ? this.deckA.positionSec : this.deckB.positionSec;
  }

  private deckDuration(deck: DeckId): number | null {
    return deck === 'A' ? this.deckA.durationSec : this.deckB.durationSec;
  }
}

export function createExpoAudioAdapter(): AudioEngine {
  return new ExpoAudioAdapter();
}
