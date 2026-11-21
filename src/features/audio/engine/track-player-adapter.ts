/**
 * react-native-track-player adapter for the AudioEngine domain interface.
 *
 * react-native-track-player is a single-output player, so the two logical
 * decks (A = main one-shot, B = intermediate loop) are time-multiplexed on one
 * physical player. The controller owns the queue strategy; this adapter maps
 * native calls and events to domain types and normalizes errors.
 *
 * Lifecycle:
 *  - setup() is idempotent and retry-safe. On Android it must run in the
 *    foreground; if invoked in the background it schedules a retry when the app
 *    returns to the foreground (AppState).
 *  - teardown() removes all listeners and resets the native player.
 */

import { AppState, AppStateStatus, type NativeEventSubscription } from 'react-native';
import TrackPlayer, {
  AndroidAudioContentType,
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  RepeatMode,
  State,
  type Progress,
  type Track,
  type PlaybackState,
  type PlaybackErrorEvent,
  type PlaybackActiveTrackChangedEvent,
} from 'react-native-track-player';
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

function mapRnTPState(state: State): DeckPlayerState {
  switch (state) {
    case State.None:
      return 'idle';
    case State.Ready:
      return 'paused';
    case State.Playing:
      return 'playing';
    case State.Paused:
      return 'paused';
    case State.Stopped:
      return 'stopped';
    case State.Loading:
      return 'loading';
    case State.Buffering:
      return 'loading';
    case State.Error:
      return 'error';
    case State.Ended:
      return 'stopped';
    default:
      return 'idle';
  }
}

function trackToRnTP(track: AudioTrack): Track {
  return {
    url: track.uri,
    type: 'file' as unknown as Track['type'],
    contentType: track.mimeType ?? undefined,
    title: track.displayName,
    artist: undefined,
    album: undefined,
    duration: track.durationMs ?? undefined,
    artwork: undefined,
  } as unknown as Track;
}

function emptyDeckStatus(): DeckStatus {
  return { track: null, state: 'idle', positionSec: 0, durationSec: null };
}

export class TrackPlayerAdapter implements AudioEngine {
  private _isSetup = false;
  private setupError: EngineError | null = null;
  private activeDeck: DeckId | null = null;
  private volume = 1;
  private deckA: DeckStatus = emptyDeckStatus();
  private deckB: DeckStatus = emptyDeckStatus();
  private error: EngineError | null = null;
  private listeners = new Set<(event: AudioEngineEvent) => void>();
  private subscriptions: NativeEventSubscription[] = [];
  private appStateSubscription: NativeEventSubscription | null = null;
  private pendingBackgroundRetry = false;
  private options: AudioEngineOptions = {};

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
        logger.warn('[TrackPlayerAdapter] event listener threw', { error, type });
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

  private recordPosition(progress: Progress): void {
    const deck = this.activeDeck;
    if (!deck) return;
    const positionSec = Math.max(0, progress.position);
    const durationSec = progress.duration > 0 ? progress.duration : null;
    this.setDeckState(deck, { positionSec, durationSec });
  }

  async setup(options: AudioEngineOptions = {}): Promise<void> {
    if (this._isSetup) {
      this.options = { ...this.options, ...options };
      return;
    }

    this.options = options;

    try {
      await TrackPlayer.setupPlayer({
        minBuffer: 2,
        maxBuffer: 10,
        playBuffer: 1,
        androidAudioContentType: this.mapContentType(options.androidAudioContentType),
        autoHandleInterruptions: true,
        autoUpdateMetadata: true,
      });

      // Notification capabilities + Android options go through updateOptions
      // (they are not part of PlayerOptions).
      await TrackPlayer.updateOptions({
        notificationCapabilities: (options.notificationCapabilities ?? [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
        ]) as unknown as Capability[],
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
          stopForegroundGracePeriod: 5,
        },
      });

      this._isSetup = true;
      this.setupError = null;
      this.pendingBackgroundRetry = false;

      this.subscribeNativeEvents();
      this.observeAppState();

      logger.audio('[TrackPlayerAdapter] setup completed');
      this.emit('setup-completed');
    } catch (error) {
      this._isSetup = false;
      const engineError = normalizeEngineError(error);
      this.setupError = engineError;

      if (
        engineError.code === 'INIT_FAILED' &&
        String(error).includes(ANDROID_BACKGROUND_ERROR_CODE)
      ) {
        this.pendingBackgroundRetry = true;
        this.observeAppState();
      }

      logger.error('[TrackPlayerAdapter] setup failed', { error: engineError });
      this.emit('setup-failed', { error: engineError });
      // Do not throw: the app must keep running and offer recovery via recover().
    }
  }

  async teardown(): Promise<void> {
    this.unsubscribeNativeEvents();
    this.unobserveAppState();
    this.pendingBackgroundRetry = false;

    try {
      await TrackPlayer.stop();
      await TrackPlayer.reset();
    } catch (error) {
      logger.warn('[TrackPlayerAdapter] teardown stop/reset failed', { error });
    }

    this._isSetup = false;
    this.setupError = null;
    this.activeDeck = null;
    this.deckA = emptyDeckStatus();
    this.deckB = emptyDeckStatus();
    this.error = null;
    this.listeners.clear();
  }

  isSetup(): boolean {
    return this._isSetup;
  }

  async load(track: AudioTrack, deck: DeckId): Promise<void> {
    if (!this._isSetup) {
      throw new Error(`TrackPlayerAdapter: not initialized (deck ${deck}, track ${track.id})`);
    }

    try {
      await TrackPlayer.load(trackToRnTP(track));
      this.activeDeck = deck;
      this.setDeckState(deck, {
        track,
        state: 'loading',
        positionSec: 0,
        durationSec: track.durationMs != null ? track.durationMs / 1000 : null,
      });
      const otherDeck = deck === 'A' ? 'B' : 'A';
      this.setDeckState(otherDeck, { state: 'idle' });

      logger.audio('[TrackPlayerAdapter] load', { deck, trackId: track.id, uri: track.uri });
      this.emit('track-changed', { trackId: track.id, deck, uri: track.uri }, deck, track.id);
    } catch (error) {
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
    try {
      await TrackPlayer.play();
      this.setDeckState(deck, { state: 'playing' });
      logger.audio('[TrackPlayerAdapter] play', { deck });
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
    try {
      await TrackPlayer.pause();
      this.setDeckState(deck, { state: 'paused' });
      logger.audio('[TrackPlayerAdapter] pause', { deck });
    } catch (error) {
      const engineError = normalizeEngineError(error);
      this.setDeckState(deck, { state: 'error' });
      this.setError(engineError);
      throw engineError;
    }
  }

  async stop(deck: DeckId): Promise<void> {
    if (!this._isSetup) return;
    try {
      await TrackPlayer.stop();
    } catch (error) {
      logger.warn('[TrackPlayerAdapter] stop failed', { error });
    }
    this.setDeckState(deck, { state: 'stopped' });
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
    try {
      await TrackPlayer.seekTo(Math.max(0, positionSec));
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
    if (!this._isSetup) return;
    try {
      await TrackPlayer.setVolume(clamped);
      logger.audio('[TrackPlayerAdapter] setVolume', { level: clamped });
    } catch (error) {
      logger.warn('[TrackPlayerAdapter] setVolume failed', { error });
    }
  }

  async getVolume(): Promise<number> {
    if (!this._isSetup) return this.volume;
    try {
      const v = await TrackPlayer.getVolume();
      this.volume = v;
      return v;
    } catch (error) {
      logger.warn('[TrackPlayerAdapter] getVolume failed', { error });
      return this.volume;
    }
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
    try {
      await TrackPlayer.setRepeatMode(enabled ? RepeatMode.Track : RepeatMode.Off);
      this.setDeckState(deck, { state: this.deckStateFor(deck) });
      logger.audio('[TrackPlayerAdapter] setLoop', { deck, enabled });
    } catch (error) {
      const engineError = normalizeEngineError(error);
      this.setDeckState(deck, { state: 'error' });
      this.setError(engineError);
      throw engineError;
    }
  }

  async getPosition(deck: DeckId): Promise<number> {
    if (!this._isSetup) return 0;
    try {
      const progress = await TrackPlayer.getProgress();
      this.recordPosition(progress);
      return this.activeDeck === deck ? Math.max(0, progress.position) : this.deckPosition(deck);
    } catch (error) {
      logger.warn('[TrackPlayerAdapter] getPosition failed', { error });
      return this.deckPosition(deck);
    }
  }

  async getDuration(deck: DeckId): Promise<number | null> {
    if (!this._isSetup) return null;
    try {
      const progress = await TrackPlayer.getProgress();
      this.recordPosition(progress);
      const duration = progress.duration > 0 ? progress.duration : null;
      return this.activeDeck === deck ? duration : this.deckDuration(deck);
    } catch (error) {
      logger.warn('[TrackPlayerAdapter] getDuration failed', { error });
      return this.deckDuration(deck);
    }
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

  /* ------------------------------------------------------------------ */
  /* Native event subscriptions                                         */
  /* ------------------------------------------------------------------ */

  private subscribeNativeEvents(): void {
    this.subscriptions.push(
      TrackPlayer.addEventListener(Event.PlaybackState, (event: PlaybackState) => {
        if (event.state === State.Error) {
          const deck = this.activeDeck ?? 'A';
          const engineError = normalizeEngineError(event.error);
          this.setDeckState(deck, { state: 'error' });
          this.setError(engineError);
          this.emit('playback-error', { error: engineError, ...event.error }, deck);
          return;
        }
        const deck = this.activeDeck ?? 'A';
        const state = mapRnTPState(event.state);
        this.setDeckState(deck, { state });
        this.emit('playback-state-changed', { state }, deck);
      })
    );

    this.subscriptions.push(
      TrackPlayer.addEventListener(Event.PlaybackError, (event: PlaybackErrorEvent) => {
        const engineError = normalizeEngineError(event);
        const deck = this.activeDeck ?? 'A';
        this.setDeckState(deck, { state: 'error' });
        this.setError(engineError);
        logger.error('[TrackPlayerAdapter] playback error', { error: engineError, deck });
        this.emit(
          'playback-error',
          { error: engineError, code: event.code, message: event.message },
          deck
        );
      })
    );

    this.subscriptions.push(
      TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
        const deck = this.activeDeck ?? 'A';
        this.setDeckState(deck, { state: 'stopped' });
        this.emit('track-ended', undefined, deck);
      })
    );

    this.subscriptions.push(
      TrackPlayer.addEventListener(
        Event.PlaybackActiveTrackChanged,
        (event: PlaybackActiveTrackChangedEvent) => {
          const track = event.track;
          const trackId = track
            ? String((track as { id?: string }).id ?? event.index)
            : String(event.index);
          this.emit(
            'track-changed',
            {
              trackId,
              index: event.index,
            },
            this.activeDeck,
            trackId
          );
        }
      )
    );

    this.subscriptions.push(
      TrackPlayer.addEventListener(Event.RemoteStop, () => {
        this.emit('remote-stop', undefined, this.activeDeck);
      })
    );

    this.subscriptions.push(
      TrackPlayer.addEventListener(
        Event.RemoteDuck,
        (event: { paused: boolean; permanent: boolean }) => {
          const deck = this.activeDeck ?? 'A';
          logger.audio('[TrackPlayerAdapter] remote duck (audio focus)', {
            deck,
            paused: event.paused,
            permanent: event.permanent,
          });
          this.emit('audio-focus-duck', { paused: event.paused, permanent: event.permanent }, deck);
        }
      )
    );

    this.subscriptions.push(
      TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event: Progress) => {
        this.recordPosition(event);
        const deck = this.activeDeck ?? 'A';
        this.emit('progress', { position: event.position, duration: event.duration }, deck);
      })
    );
  }

  private unsubscribeNativeEvents(): void {
    for (const subscription of this.subscriptions) {
      try {
        subscription.remove();
      } catch {
        // Ignore removal errors.
      }
    }
    this.subscriptions = [];
  }

  private observeAppState(): void {
    if (this.appStateSubscription) return;
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextStatus: AppStateStatus) => {
        if (nextStatus === 'active' && this.pendingBackgroundRetry) {
          this.pendingBackgroundRetry = false;
          void this.setup(this.options).catch((error) => {
            logger.error('[TrackPlayerAdapter] background retry setup failed', { error });
          });
        }
        logger.audio('[TrackPlayerAdapter] app state change', { status: nextStatus });
      }
    );
  }

  private unobserveAppState(): void {
    if (this.appStateSubscription) {
      try {
        this.appStateSubscription.remove();
      } catch {
        // Ignore.
      }
      this.appStateSubscription = null;
    }
  }

  private mapContentType(value?: string): AndroidAudioContentType {
    switch (value) {
      case 'Speech':
        return AndroidAudioContentType.Speech;
      case 'Ambient':
        return AndroidAudioContentType.Sonification;
      case 'Notification':
        return AndroidAudioContentType.Unknown;
      default:
        return AndroidAudioContentType.Music;
    }
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

export function createTrackPlayerAdapter(): AudioEngine {
  return new TrackPlayerAdapter();
}
