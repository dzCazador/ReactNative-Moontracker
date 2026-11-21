/**
 * Live playback machine types.
 *
 * Models the double-deck orchestration:
 *  - Deck A: main track (one-shot, played during the song).
 *  - Deck B: intermediate loop (loops between songs).
 *
 * Phases describe the visible lifecycle. Commands flow through a single
 * mutex-protected queue so transitions are always serial.
 */

import type { DeckId } from './audio-engine';

export type PlaybackPhase =
  | 'idle' // nothing loaded yet
  | 'prepared' // setlist loaded, first song ready to play
  | 'playing-main' // deck A main track playing
  | 'playing-loop' // deck B loop playing (between songs)
  | 'fading-out' // loop fading out before the next main starts
  | 'fading-in' // next loop fading in after a main track ended
  | 'silent-waiting' // no intermediate configured for the upcoming slot
  | 'stopped' // user-initiated stop
  | 'error'; // recoverable error state

export interface PlaybackCommand {
  type: 'LOAD_SETLIST' | 'PREPARE' | 'TRIGGER_NEXT' | 'STOP' | 'RECOVER';
  payload?: unknown;
  timestampMs: number;
}

export interface LivePlaybackStatus {
  phase: PlaybackPhase;
  currentItemId: string | null;
  currentSongTitle: string | null;
  nextItemId: string | null;
  nextSongTitle: string | null;
  currentTrack: import('./audio-engine').AudioTrack | null;
  positionSec: number;
  durationSec: number | null;
  volume: number;
  isLastSong: boolean;
  error: PlaybackError | null;
}

export interface PlaybackError {
  code: 'MISSING_FILE' | 'DECODE_FAILED' | 'INIT_FAILED' | 'FOCUS_LOST' | 'UNKNOWN' | 'NOT_READY';
  message: string;
  recoverable: boolean;
  actions: ('retry' | 'skip' | 'reload')[];
  context?: Record<string, unknown>;
}

export interface TransitionLogEntry {
  timestampMs: number;
  event: string;
  fromState: PlaybackPhase;
  toState: PlaybackPhase;
  songId: string | null;
  deck: DeckId | null;
  volume: number;
  result: 'ok' | 'error' | 'blocked';
  latencyMs?: number;
  durationMs?: number;
}

export interface FadeConfig {
  /** Global default fade-out duration in milliseconds. */
  fadeOutMs: number;
  /** Global default fade-in duration in milliseconds. */
  fadeInMs: number;
  /** Volume ramp step interval in milliseconds, clamped to [16, 60]. */
  stepMs: number;
}

export interface ResolvedFade {
  fadeOutMs: number;
  fadeInMs: number;
}

export interface LoopGapDiagnostic {
  assetId: string;
  durationSec: number;
  repeatMode: 'track' | 'off';
  measuredStartSec: number | null;
  measuredEndSec: number | null;
  note: string;
}
