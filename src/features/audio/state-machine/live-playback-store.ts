/**
 * Zustand store exposing observable playback state to the UI.
 *
 * The UI (stages 04/05) subscribes through selectors; it never touches the
 * engine or the controller directly.
 */

import { create } from 'zustand';
import type {
  LivePlaybackStatus,
  PlaybackPhase,
  PlaybackError,
  TransitionLogEntry,
  DeckId,
} from '@/features/audio/types';
import { audioTracer } from './audio-tracer';

export interface LivePlaybackStoreState {
  status: LivePlaybackStatus;
  logs: TransitionLogEntry[];
  isEngineReady: boolean;
  setStatus: (status: LivePlaybackStatus) => void;
  setEngineReady: (ready: boolean) => void;
  setError: (error: PlaybackError | null) => void;
  addLog: (entry: Omit<TransitionLogEntry, 'timestampMs'>) => void;
  clearLogs: () => void;
}

const initialStatus: LivePlaybackStatus = {
  phase: 'idle',
  currentItemId: null,
  currentSongTitle: null,
  nextItemId: null,
  nextSongTitle: null,
  currentTrack: null,
  positionSec: 0,
  durationSec: null,
  volume: 1,
  isLastSong: false,
  error: null,
};

export const useLivePlaybackStore = create<LivePlaybackStoreState>((set) => ({
  status: initialStatus,
  logs: [],
  isEngineReady: false,

  setStatus: (status) =>
    set((state) => {
      const next = { ...state, status };
      if (status.error) {
        audioTracer.logTransition({
          event: 'ERROR',
          fromState: state.status.phase,
          toState: status.phase,
          songId: status.currentItemId ?? null,
          deck: null,
          volume: status.volume,
          result: 'error',
        });
      }
      return next;
    }),

  setEngineReady: (ready) => set({ isEngineReady: ready }),

  setError: (error) =>
    set((state) => ({
      status: { ...state.status, error },
    })),

  addLog: (entry) => {
    audioTracer.logTransition(entry);
    const loggedEntry: TransitionLogEntry = { ...entry, timestampMs: Date.now() };
    set((state) => {
      const logs = [loggedEntry, ...state.logs].slice(0, 200);
      return { logs };
    });
  },

  clearLogs: () => {
    audioTracer.reset();
    set({ logs: [] });
  },
}));

/**
 * Selector hooks so components only re-render on the slices they use.
 */
export const usePlaybackStatus = (): LivePlaybackStatus => useLivePlaybackStore((s) => s.status);
export const usePlaybackLogs = (): TransitionLogEntry[] => useLivePlaybackStore((s) => s.logs);
export const useEngineReady = (): boolean => useLivePlaybackStore((s) => s.isEngineReady);
export const usePlaybackError = (): PlaybackError | null =>
  useLivePlaybackStore((s) => s.status.error);
export const usePlaybackPhase = (): PlaybackPhase => useLivePlaybackStore((s) => s.status.phase);
export const usePlaybackDeckId = (): DeckId | null => null;
