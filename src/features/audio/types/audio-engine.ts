/**
 * Audio engine domain types.
 *
 * This layer isolates the application from react-native-track-player details.
 * The engine exposes a single physical player shared by two logical decks
 * (A = main one-shot track, B = intermediate loop) because
 * react-native-track-player is a single-output player. True simultaneous
 * crossfade between decks would require a second audio output, which is out of
 * scope for this stage; transitions are therefore sequenced (fade out deck B,
 * then start deck A) with an instant perceived response for the main track.
 */

export type DeckId = 'A' | 'B';

export type DeckRole = 'main' | 'intermediate';

export type DeckPlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

export interface DeckStatus {
  track: AudioTrack | null;
  state: DeckPlayerState;
  positionSec: number;
  durationSec: number | null;
}

export interface AudioTrack {
  id: string; // domain track id (setlist item id or generated id)
  assetId: string; // audio_assets.id
  uri: string; // internal_uri: app-managed file, offline only (never a download URL)
  displayName: string;
  durationMs: number | null;
  mimeType: string | null;
  loop: boolean;
}

export type AudioEngineEventType =
  | 'setup-completed'
  | 'setup-failed'
  | 'playback-state-changed'
  | 'track-changed'
  | 'track-ended' // domain MAIN_ENDED
  | 'playback-error' // domain PLAYBACK_ERROR
  | 'audio-focus-lost' // domain AUDIO_FOCUS_LOST
  | 'audio-focus-duck'
  | 'remote-stop'
  | 'progress';

export interface AudioEngineEvent {
  type: AudioEngineEventType;
  deck?: DeckId | null;
  trackId?: string;
  timestampMs: number;
  payload?: Record<string, unknown>;
}

export interface EngineError {
  code: 'MISSING_FILE' | 'DECODE_FAILED' | 'INIT_FAILED' | 'FOCUS_LOST' | 'UNKNOWN' | 'NOT_READY';
  message: string;
  fatal: boolean;
  context?: Record<string, unknown>;
}

export interface AudioEngineState {
  isSetup: boolean;
  setupError: EngineError | null;
  deckA: DeckStatus;
  deckB: DeckStatus;
  volume: number;
  activeDeck: DeckId | null;
  error: EngineError | null;
}

export interface AudioEngineOptions {
  /** Android audio content type. Defaults to Music. */
  androidAudioContentType?: 'Music' | 'Speech' | 'Ambient' | 'Notification';
  /** Capabilities shown in the playback notification (background playback). */
  notificationCapabilities?: string[];
  /** Interval in seconds for progress update events. Defaults to 1. */
  progressUpdateIntervalSec?: number;
  /** Whether playback starts automatically when ready. Defaults to true. */
  playWhenReady?: boolean;
}

export interface AudioEngine {
  /** Idempotent initialization. Safe to call multiple times; survives lifecycle changes. */
  setup(options?: AudioEngineOptions): Promise<void>;
  /** Releases the native player and all listeners. */
  teardown(): Promise<void>;
  isSetup(): boolean;
  /** Loads a track onto a deck. Replaces whatever was on that deck. */
  load(track: AudioTrack, deck: DeckId): Promise<void>;
  play(deck: DeckId): Promise<void>;
  pause(deck: DeckId): Promise<void>;
  stop(deck: DeckId): Promise<void>;
  seek(deck: DeckId, positionSec: number): Promise<void>;
  setVolume(level: number): Promise<void>; // global volume, clamped to [0, 1]
  getVolume(): Promise<number>;
  setLoop(deck: DeckId, enabled: boolean): Promise<void>;
  getPosition(deck: DeckId): Promise<number>;
  getDuration(deck: DeckId): Promise<number | null>;
  onEvent(listener: (event: AudioEngineEvent) => void): () => void;
  getState(): AudioEngineState;
}
