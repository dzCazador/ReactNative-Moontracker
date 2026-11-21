/**
 * State-machine barrel.
 */

export { LivePlaybackController, livePlaybackController } from './live-playback-controller';
export type { LivePlaybackControllerDeps } from './live-playback-controller';
export type {
  PlaybackPhase,
  PlaybackCommand,
  LivePlaybackStatus,
  PlaybackError,
  TransitionLogEntry,
  FadeConfig,
  ResolvedFade,
  LoopGapDiagnostic,
} from '@/features/audio/types';
export { CommandQueue } from './command-queue';
export { audioTracer, type AudioTracer } from './audio-tracer';
export {
  useLivePlaybackStore,
  usePlaybackStatus,
  usePlaybackLogs,
  useEngineReady,
  usePlaybackError,
  usePlaybackPhase,
} from './live-playback-store';
