/**
 * Hooks for consuming the playback controller from UI.
 * Stages 04/05 will use these.
 */

import { useCallback } from 'react';
import type { DeckId } from '@/features/audio/types';
import {
  usePlaybackStatus,
  usePlaybackLogs,
  useEngineReady,
  usePlaybackError,
  usePlaybackPhase,
} from '@/features/audio/state-machine/live-playback-store';
import { livePlaybackController } from '@/features/audio/state-machine/live-playback-controller';

/**
 * Convenience hook exposing the playback controller's public API plus the
 * observable store status, logs, and diagnostics.
 */
export function useLivePlayback() {
  const status = usePlaybackStatus();
  const logs = usePlaybackLogs();
  const error = usePlaybackError();
  const isEngineReady = useEngineReady();
  const phase = usePlaybackPhase();

  const loadSetlist = useCallback(
    (
      setlist: Parameters<typeof livePlaybackController.loadSetlist>[0],
      items: Parameters<typeof livePlaybackController.loadSetlist>[1],
      globalDefaultAudioId?: Parameters<typeof livePlaybackController.loadSetlist>[2],
      globalDefaultAudio?: Parameters<typeof livePlaybackController.loadSetlist>[3]
    ) => livePlaybackController.loadSetlist(setlist, items, globalDefaultAudioId, globalDefaultAudio),
    []
  );

  const prepare = useCallback(() => livePlaybackController.prepare(), []);
  const triggerNext = useCallback(() => livePlaybackController.triggerNext(), []);
  const stop = useCallback(() => livePlaybackController.stop(), []);
  const recover = useCallback(() => livePlaybackController.recover(), []);
  const seek = useCallback((deck: DeckId, positionSec: number) => livePlaybackController.seek(deck, positionSec), []);

  return {
    status,
    phase,
    error,
    logs,
    isEngineReady,
    loadSetlist,
    prepare,
    triggerNext,
    stop,
    seek,
    recover,
    getStatus: livePlaybackController.getStatus.bind(livePlaybackController),
    getEngineState: livePlaybackController.getEngineState.bind(livePlaybackController),
    getLoopDiagnostics: livePlaybackController.getLoopDiagnostics.bind(livePlaybackController),
    subscribe: livePlaybackController.subscribe.bind(livePlaybackController),
  };
}

export type {
  LivePlaybackStatus,
  PlaybackError,
  PlaybackPhase,
  DeckId,
} from '@/features/audio/types';
export type { AudioEngine } from '@/features/audio/types';
