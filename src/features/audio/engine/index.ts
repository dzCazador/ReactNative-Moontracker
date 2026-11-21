/**
 * Audio engine barrel.
 */

export { createTrackPlayerAdapter, TrackPlayerAdapter } from './track-player-adapter';
export type { AudioEngine } from '@/features/audio/types';
export type {
  DeckId,
  DeckRole,
  DeckPlayerState,
  DeckStatus,
  AudioTrack,
  AudioEngineEvent,
  AudioEngineEventType,
  EngineError,
  AudioEngineState,
  AudioEngineOptions,
} from '@/features/audio/types';
