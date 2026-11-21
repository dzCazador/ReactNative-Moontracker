/**
 * Audio feature barrel.
 *
 * Exposes the engine abstraction, the track-player adapter, fades, the
 * state-machine orchestrator, and UI hooks. Stage 04/05 consume the hooks
 * and the controller; nothing else touches react-native-track-player directly.
 */

export { createExpoAudioAdapter, ExpoAudioAdapter } from './engine';
export type { AudioEngine } from './engine';

export {
  LivePlaybackController,
  livePlaybackController,
  CommandQueue,
  audioTracer,
} from './state-machine';
export type { LivePlaybackControllerDeps } from './state-machine';

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
  PlaybackPhase,
  PlaybackCommand,
  LivePlaybackStatus,
  PlaybackError,
  TransitionLogEntry,
  FadeConfig,
  ResolvedFade,
  LoopGapDiagnostic,
} from './types';

export { useLivePlayback } from './hooks/use-audio-engine';

export { resolveFadeDurations, clampVolume, FadeController } from './fades/fade-controller';
