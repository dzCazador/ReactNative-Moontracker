/**
 * LivePlaybackController — double-deck playback orchestrator.
 *
 * State machine phases:
 *  idle -> prepared -> playing-main -> playing-loop -> fading-out ->
 *  playing-main (next song) | playing-loop | silent-waiting | stopped | error
 *
 * Deck A = main track (one-shot). Deck B = intermediate loop (loops).
 * react-native-track-player is a single-output player, so decks are
 * time-multiplexed. Transitions are sequenced through a single command queue.
 *
 * All file URIs come from the app-managed internal store (offline). No
 * download URLs are ever used for playback.
 */

import { AppState, AppStateStatus } from 'react-native';
import type {
  AudioTrack,
  AudioEngine,
  DeckId,
  FadeConfig,
  LivePlaybackStatus,
  LoopGapDiagnostic,
  PlaybackError,
  PlaybackPhase,
} from '@/features/audio/types';
import { createTrackPlayerAdapter } from '@/features/audio/engine';
import {
  resolveEffectiveIntermediateAudio,
  type IntermediateResolutionContext,
} from '@/lib/intermediate-resolution';
import type { AudioAsset, SetlistItemWithAudio, Setlist } from '@/data/models';
import { resolveFadeDurations, FadeController } from '@/features/audio/fades/fade-controller';
import { CommandQueue } from '@/features/audio/state-machine/command-queue';
import { audioTracer } from '@/features/audio/state-machine/audio-tracer';
import { useLivePlaybackStore } from '@/features/audio/state-machine/live-playback-store';
import { logger } from '@/lib/logger';

const DEFAULT_FADE_CONFIG: FadeConfig = {
  fadeOutMs: 1200,
  fadeInMs: 1200,
  stepMs: 30,
};

const DEBOUNCE_MS = 800;
const MONOTONIC_NOW = (): number => performance.now();

interface LoopResolution {
  audio: AudioAsset | null;
  reason: 'CUSTOM' | 'SETLIST_DEFAULT' | 'GLOBAL_DEFAULT' | 'SILENCE' | 'NONE';
}

interface PreparedSetlist {
  setlist: Setlist;
  items: SetlistItemWithAudio[];
  currentIndex: number;
}

export interface LivePlaybackControllerDeps {
  audioEngine?: AudioEngine;
  fadeConfig?: FadeConfig;
  debounceMs?: number;
}

export class LivePlaybackController {
  private readonly engine: AudioEngine;
  private readonly fade: FadeController;
  private readonly queue: CommandQueue;
  private readonly fadeConfig: FadeConfig;

  private prepared: PreparedSetlist | null = null;
  private globalDefaultAudioId: string | null = null;

  private phase: PlaybackPhase = 'idle';
  private currentItemId: string | null = null;
  private nextItemId: string | null = null;

  private triggerStartMs = 0;
  private mainEndedHandled = false; // duplicate-end guard
  private isStopping = false;
  private appStateSubscription: { remove: () => void } | null = null;

  // Persist UI-relevant volume across transitions.
  private targetVolume = 1;

  constructor(deps: LivePlaybackControllerDeps = {}) {
    this.engine = deps.audioEngine ?? createTrackPlayerAdapter();
    this.fadeConfig = deps.fadeConfig ?? DEFAULT_FADE_CONFIG;
    this.queue = new CommandQueue({ debounceMs: deps.debounceMs ?? DEBOUNCE_MS });
    this.fade = new FadeController({
      setVolume: (level) => this.engine.setVolume(level),
      getVolume: () => this.engine.getVolume?.() ?? Promise.resolve(this.targetVolume),
      stepMs: this.fadeConfig.stepMs,
    });

    this.engine.onEvent((event) => this.onEngineEvent(event));
  }

  /* ================================================================ */
  /* Public API                                                       */
  /* ================================================================ */

  async loadSetlist(
    setlist: Setlist,
    items: SetlistItemWithAudio[],
    globalDefaultAudioId: string | null = null
  ): Promise<void> {
    const start = MONOTONIC_NOW();
    await this.queue.enqueue('LOAD_SETLIST', async () => {
      this.isStopping = false;
      this.mainEndedHandled = false;
      this.globalDefaultAudioId = globalDefaultAudioId;

      if (items.length === 0) {
        this.setPhase('idle');
        this.prepared = null;
        this.currentItemId = null;
        this.nextItemId = null;
        this.publishStatus();
        return;
      }

      this.prepared = { setlist, items, currentIndex: 0 };
      this.currentItemId = items[0].id;
      this.nextItemId = items.length > 1 ? items[1].id : null;
      this.mainEndedHandled = false;

      try {
        await this.prepareCurrentMain();
      } catch (error) {
        this.handleLoadError(items[0], error as Error);
      }

      this.setPhase('prepared');
      this.publishStatus();
      this.audioTracerLog('LOAD_SETLIST', 'idle', 'prepared', items[0].id, null, 'ok');
      const latency = MONOTONIC_NOW() - start;
      this.engine.getState(); // touch state
      logger.audio('[LivePlaybackController] loadSetlist', {
        setlistId: setlist.id,
        itemCount: items.length,
        latencyMs: latency,
      });
    });
  }

  async prepare(): Promise<void> {
    if (!this.prepared) return;
    const start = MONOTONIC_NOW();
    await this.queue.enqueue('PREPARE', async () => {
      await this.prepareCurrentMain();
      this.setPhase('prepared');
      this.publishStatus();
      const latency = MONOTONIC_NOW() - start;
      this.audioTracerLog(
        'PREPARE',
        this.phase,
        'prepared',
        this.currentItemId,
        null,
        'ok',
        latency
      );
    });
  }

  async triggerNext(): Promise<void> {
    if (!this.prepared || this.prepared.items.length === 0) {
      logger.warn('[LivePlaybackController] triggerNext: no setlist prepared');
      return;
    }
    const start = MONOTONIC_NOW();
    await this.queue.enqueue('TRIGGER_NEXT', async () => {
      const prepared = this.prepared;
      if (!prepared) return;
      const currentIndex = prepared.currentIndex;
      const nextIndex = currentIndex + 1;
      const items = prepared.items;
      const isLast = nextIndex >= items.length;

      if (isLast) {
        // Last song: stop after fading out the loop (if any) or stop now.
        await this.fadeOutCurrentLoop();
        await this.engine.stop('A');
        this.setPhase('stopped');
        this.currentItemId = null;
        this.nextItemId = null;
        this.publishStatus();
        this.audioTracerLog(
          'TRIGGER_NEXT_LAST',
          this.phase,
          'stopped',
          this.currentItemId,
          'A',
          'ok'
        );
        return;
      }

      const currentItem = items[currentIndex];
      const nextItem = items[nextIndex];

      // Resolve the intermediate loop for the NEXT song (fade-in target after
      // the current main ends). Resolve now so the asset can be preloaded.
      const nextLoop = this.resolveLoopForItem(nextItem);

      // Fade out the current loop (deck B) immediately for perceived instant response.
      await this.fadeOutCurrentLoop();

      // Start the next main track on deck A immediately (prioritize perceived
      // instant response over a perfect crossfade).
      try {
        await this.loadAndPlayMain(nextItem);
      } catch (error) {
        this.handleLoadError(nextItem, error as Error);
        return;
      }

      // Advance indexes.
      prepared.currentIndex = nextIndex;
      this.currentItemId = nextItem.id;
      this.nextItemId = nextIndex + 1 < items.length ? items[nextIndex + 1].id : null;
      this.mainEndedHandled = false;

      // If the next song has a loop, load it on deck B (paused, looped) so it
      // is ready to fade in when this main ends.
      if (nextLoop.audio) {
        try {
          await this.loadLoopOnDeckB(nextLoop.audio);
        } catch (error) {
          logger.warn('[LivePlaybackController] preloading next loop failed', { error });
        }
      }

      this.setPhase('playing-main');
      this.publishStatus();
      const latency = MONOTONIC_NOW() - start;
      this.audioTracerLog(
        'TRIGGER_NEXT',
        'playing-main',
        'playing-main',
        nextItem.id,
        'A',
        'ok',
        latency
      );
      logger.audio('[LivePlaybackController] triggerNext', {
        fromItem: currentItem.id,
        toItem: nextItem.id,
        loopReason: nextLoop.reason,
        latencyMs: latency,
      });
    });
  }

  async stop(): Promise<void> {
    const start = MONOTONIC_NOW();
    await this.queue.enqueue('STOP', async () => {
      this.isStopping = true;
      this.mainEndedHandled = true;
      this.fade.cancel();
      try {
        await this.engine.stop('A');
        await this.engine.stop('B');
      } catch {
        // Ignore stop errors during shutdown.
      }
      this.setPhase('stopped');
      this.currentItemId = null;
      this.nextItemId = null;
      this.publishStatus();
      const latency = MONOTONIC_NOW() - start;
      this.audioTracerLog('STOP', this.phase, 'stopped', null, null, 'ok', latency);
    });
  }

  async recover(): Promise<void> {
    const start = MONOTONIC_NOW();
    await this.queue.enqueue('RECOVER', async () => {
      this.queue.clearDebounce('TRIGGER_NEXT');
      this.queue.clearDebounce('STOP');
      this.mainEndedHandled = false;
      this.isStopping = false;

      const state = this.engine.getState();
      if (!state.isSetup && !state.setupError) {
        try {
          await this.engine.setup();
        } catch (error) {
          this.setErrorState('INIT_FAILED', `Engine recovery failed: ${String(error)}`, false, [], {
            original: String(error),
          });
          return;
        }
      }

      if (this.prepared && this.prepared.items.length > 0) {
        const item = this.prepared.items[this.prepared.currentIndex];
        try {
          await this.prepareCurrentMain();
          this.setPhase('playing-main');
        } catch (error) {
          this.handleLoadError(item, error as Error);
          return;
        }
      } else {
        this.setPhase('prepared');
      }

      this.publishStatus();
      const latency = MONOTONIC_NOW() - start;
      this.audioTracerLog(
        'RECOVER',
        this.phase,
        this.phase,
        this.currentItemId,
        null,
        'ok',
        latency
      );
    });
  }

  /* ================================================================ */
  /* Observers                                                        */
  /* ================================================================ */

  getStatus(): LivePlaybackStatus {
    return this.buildStatus();
  }

  private buildStatus(): LivePlaybackStatus {
    const engineState = this.engine.getState();
    const prepared = this.prepared;
    const items = prepared?.items ?? [];
    const currentIndex = prepared?.currentIndex ?? 0;
    const currentItem = items[currentIndex];
    const nextIndex = currentIndex + 1;
    const nextItem = items[nextIndex];

    return {
      phase: this.phase,
      currentItemId: this.currentItemId ?? currentItem?.id ?? null,
      currentSongTitle: currentItem?.song_title ?? null,
      nextItemId: this.nextItemId ?? nextItem?.id ?? null,
      nextSongTitle: nextItem?.song_title ?? null,
      currentTrack: currentItem?.main_audio
        ? {
            id: currentItem.id,
            assetId: currentItem.main_audio.id,
            uri: currentItem.main_audio.internal_uri,
            displayName: currentItem.main_audio.display_name,
            durationMs: currentItem.main_audio.duration_ms,
            mimeType: currentItem.main_audio.mime_type,
            loop: false,
          }
        : null,
      positionSec: engineState.deckA.positionSec,
      durationSec: engineState.deckA.durationSec,
      volume: engineState.volume,
      isLastSong: nextIndex >= items.length,
      error: engineState.error
        ? {
            code: engineState.error.code,
            message: engineState.error.message,
            recoverable: !engineState.error.fatal,
            actions: ['retry', 'skip', 'reload'],
            context: engineState.error.context,
          }
        : null,
    };
  }

  subscribe(listener: (status: LivePlaybackStatus) => void): () => void {
    return useLivePlaybackStore.subscribe((state) => listener(state.status));
  }

  getEngineState(): ReturnType<AudioEngine['getState']> {
    return this.engine.getState();
  }

  getLoopDiagnostics(): LoopGapDiagnostic[] {
    if (!this.prepared) return [];
    return this.prepared.items
      .filter((item) => item.intermediate_audio)
      .map((item) => {
        const audio = item.intermediate_audio!;
        return {
          assetId: audio.id,
          durationSec: (audio.duration_ms ?? 0) / 1000,
          repeatMode: 'track',
          measuredStartSec: null,
          measuredEndSec: null,
          note: 'Loop configured on deck B with RepeatMode.Track; verify gapless on device.',
        };
      });
  }

  /* ================================================================ */
  /* Internal: engine event handling                                  */
  /* ================================================================ */

  private onEngineEvent(event: {
    type: string;
    deck?: DeckId | null | undefined;
    trackId?: string;
    payload?: Record<string, unknown>;
  }): void {
    switch (event.type) {
      case 'playback-state-changed': {
        const deck = event.deck ?? 'A';
        const state = this.engine.getState();
        const deckStatus = deck === 'A' ? state.deckA : state.deckB;
        if (deckStatus.state === 'error') {
          this.handleEngineError(deck, event.trackId ?? null);
        }
        break;
      }
      case 'track-ended': {
        // Domain MAIN_ENDED: the main track on deck A finished one-shot.
        if (event.deck === 'A') {
          this.handleMainEnded();
        }
        break;
      }
      case 'playback-error': {
        this.handleEngineError(event.deck ?? 'A', event.trackId ?? null);
        break;
      }
      case 'audio-focus-duck': {
        this.handleAudioFocusDuck();
        break;
      }
      case 'remote-stop': {
        void this.stop();
        break;
      }
      default:
        break;
    }
  }

  /* ================================================================ */
  /* Internal: transitions                                            */
  /* ================================================================ */

  private async prepareCurrentMain(): Promise<void> {
    if (!this.prepared) return;
    const item = this.prepared.items[this.prepared.currentIndex];
    const main = item.main_audio;
    if (!main || main.is_missing) {
      throw new Error(`Main audio missing for item ${item.id}`);
    }
    const track: AudioTrack = {
      id: item.id,
      assetId: main.id,
      uri: main.internal_uri,
      displayName: main.display_name,
      durationMs: main.duration_ms,
      mimeType: main.mime_type,
      loop: false,
    };
    await this.engine.load(track, 'A');
    await this.engine.setLoop('A', false);
    await this.engine.setVolume(this.targetVolume);
    this.engine.getState();
  }

  private async loadAndPlayMain(item: SetlistItemWithAudio): Promise<void> {
    const main = item.main_audio;
    if (!main || main.is_missing) {
      throw new Error(`Main audio missing for item ${item.id}`);
    }
    const track: AudioTrack = {
      id: item.id,
      assetId: main.id,
      uri: main.internal_uri,
      displayName: main.display_name,
      durationMs: main.duration_ms,
      mimeType: main.mime_type,
      loop: false,
    };
    await this.engine.load(track, 'A');
    await this.engine.setLoop('A', false);
    await this.engine.setVolume(this.targetVolume);
    await this.engine.play('A');
  }

  private async loadLoopOnDeckB(asset: AudioAsset): Promise<void> {
    const track: AudioTrack = {
      id: `loop-${asset.id}`,
      assetId: asset.id,
      uri: asset.internal_uri,
      displayName: asset.display_name,
      durationMs: asset.duration_ms,
      mimeType: asset.mime_type,
      loop: true,
    };
    await this.engine.load(track, 'B');
    await this.engine.setLoop('B', true);
    // Deck B is loaded paused; the controller fades it in/out via volume.
    await this.engine.setVolume(this.targetVolume);
  }

  private async fadeOutCurrentLoop(): Promise<void> {
    const item = this.prepared?.items[this.prepared.currentIndex];
    const loop = item?.intermediate_audio;
    if (!loop) {
      // Nothing looping; ensure deck B volume is 0.
      await this.engine.setVolume(0);
      return;
    }
    const fade = resolveFadeDurations(
      { fadeOutLoopMs: item.fade_out_loop_ms ?? null, fadeInLoopMs: null },
      this.fadeConfig
    );
    await this.fade.fadeTo(0, fade.fadeOutMs);
    this.targetVolume = 0;
    await this.engine.stop('B');
  }

  private async fadeInNextLoop(asset: AudioAsset): Promise<void> {
    const track: AudioTrack = {
      id: `loop-${asset.id}`,
      assetId: asset.id,
      uri: asset.internal_uri,
      displayName: asset.display_name,
      durationMs: asset.duration_ms,
      mimeType: asset.mime_type,
      loop: true,
    };
    await this.engine.load(track, 'B');
    await this.engine.setLoop('B', true);
    await this.engine.play('B');
    const item = this.prepared?.items[this.prepared.currentIndex];
    const fade = resolveFadeDurations(
      { fadeOutLoopMs: null, fadeInLoopMs: item?.fade_in_loop_ms ?? null },
      this.fadeConfig
    );
    this.targetVolume = 0;
    await this.engine.setVolume(0);
    await this.fade.fadeTo(1, fade.fadeInMs);
    this.targetVolume = 1;
  }

  private async handleMainEnded(): Promise<void> {
    if (this.mainEndedHandled || this.isStopping || !this.prepared) return;
    this.mainEndedHandled = true;
    const start = MONOTONIC_NOW();

    const currentIndex = this.prepared.currentIndex;
    const currentItem = this.prepared.items[currentIndex];
    const nextIndex = currentIndex + 1;
    const items = this.prepared.items;
    const isLast = nextIndex >= items.length;

    // Stop deck A (main) cleanly.
    try {
      await this.engine.stop('A');
    } catch {
      // Ignore.
    }

    if (isLast) {
      this.setPhase('stopped');
      this.currentItemId = null;
      this.nextItemId = null;
      this.publishStatus();
      this.audioTracerLog('MAIN_ENDED_LAST', 'playing-main', 'stopped', currentItem.id, 'A', 'ok');
      return;
    }

    const nextItem = items[nextIndex];
    const nextLoop = this.resolveLoopForItem(nextItem);

    if (nextLoop.audio) {
      // Load next loop on deck B and fade it in.
      try {
        await this.loadLoopOnDeckB(nextLoop.audio);
        await this.fadeInNextLoop(nextLoop.audio);
      } catch (error) {
        logger.warn('[LivePlaybackController] fade-in next loop failed, silent waiting', { error });
        this.setPhase('silent-waiting');
      }
      this.prepared.currentIndex = nextIndex;
      this.currentItemId = nextItem.id;
      this.nextItemId = nextIndex + 1 < items.length ? items[nextIndex + 1].id : null;
      this.mainEndedHandled = false;
      this.setPhase('playing-loop');
      this.publishStatus();
    } else {
      // No intermediate configured: silent waiting with explicit state.
      this.prepared.currentIndex = nextIndex;
      this.currentItemId = nextItem.id;
      this.nextItemId = nextIndex + 1 < items.length ? items[nextIndex + 1].id : null;
      this.mainEndedHandled = false;
      this.setPhase('silent-waiting');
      this.publishStatus();
    }

    const latency = MONOTONIC_NOW() - start;
    this.audioTracerLog(
      'MAIN_ENDED',
      'playing-main',
      this.phase,
      currentItem.id,
      'A',
      'ok',
      latency
    );
  }

  private resolveLoopForItem(item: SetlistItemWithAudio): LoopResolution {
    // Precedence is handled by the stage-02 resolver. Reconstruct the context.
    const ctx: IntermediateResolutionContext = {
      item: {
        intermediate_mode: item.intermediate_mode,
        intermediate_audio_id: item.intermediate_audio_id,
      },
      setlistDefaultAudioId: this.prepared?.setlist.default_intermediate_audio_id ?? null,
      globalDefaultAudioId: this.globalDefaultAudioId,
      assetsById: {},
    };
    // assetsById built from available intermediate_audio on the item.
    if (item.intermediate_audio) {
      ctx.assetsById[item.intermediate_audio.id] = item.intermediate_audio;
    }
    const result = resolveEffectiveIntermediateAudio(ctx);
    return { audio: result.audio ?? null, reason: result.reason };
  }

  private async handleEngineError(deck: DeckId, trackId: string | null): Promise<void> {
    const state = this.engine.getState();
    const engineError = state.error;
    const item = trackId ? this.prepared?.items.find((i) => i.id === trackId) : null;
    this.setErrorState(
      engineError?.code ?? 'UNKNOWN',
      engineError?.message ?? 'Audio engine error',
      engineError?.fatal ?? false,
      ['retry', 'skip', 'reload'],
      { deck, trackId, original: engineError?.context?.original }
    );
    if (item) {
      this.handleLoadError(item, new Error(engineError?.message ?? 'Engine error'));
    }
  }

  private async handleLoadError(item: SetlistItemWithAudio, error: Error): Promise<void> {
    const code = error.message.includes('missing') ? 'MISSING_FILE' : 'DECODE_FAILED';
    this.setErrorState(
      code,
      `Cannot play "${item.song_title}": ${error.message}`,
      false,
      ['retry', 'skip', 'reload'],
      { itemId: item.id, songTitle: item.song_title, original: error.message }
    );
    this.setPhase('error');
    this.publishStatus();
    this.audioTracerLog('LOAD_ERROR', this.phase, 'error', item.id, 'A', 'error');
  }

  private handleAudioFocusDuck(): void {
    // Transient focus loss: lower volume slightly; resume on regain is handled
    // by the engine/app lifecycle. Policy is configurable; here we duck.
    void this.engine.setVolume(Math.max(0, this.targetVolume * 0.3));
  }

  /* ================================================================ */
  /* Helpers                                                          */
  /* ================================================================ */

  private setPhase(phase: PlaybackPhase): void {
    this.phase = phase;
  }

  private setErrorState(
    code: PlaybackError['code'],
    message: string,
    recoverable: boolean,
    actions: PlaybackError['actions'],
    context?: Record<string, unknown>
  ): void {
    const error: PlaybackError = { code, message, recoverable, actions, context };
    useLivePlaybackStore.getState().setError(error);
    this.publishStatus();
  }

  private publishStatus(): void {
    const status = this.buildStatus();
    useLivePlaybackStore.getState().setStatus(status);
  }

  private audioTracerLog(
    event: string,
    fromState: PlaybackPhase,
    toState: PlaybackPhase,
    songId: string | null,
    deck: DeckId | null,
    result: 'ok' | 'error' | 'blocked',
    latencyMs?: number
  ): void {
    const state = this.engine.getState();
    audioTracer.logTransition({
      event,
      fromState,
      toState,
      songId,
      deck,
      volume: state.volume,
      result,
      latencyMs,
    });
    useLivePlaybackStore.getState().addLog({
      event,
      fromState,
      toState,
      songId,
      deck,
      volume: state.volume,
      result,
      latencyMs,
    });
  }

  /** Observe app lifecycle to restore playback after interruption. */
  private observeAppLifecycle(): void {
    if (this.appStateSubscription) return;
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextStatus: AppStateStatus) => {
        if (nextStatus === 'active' && this.phase !== 'idle' && this.phase !== 'stopped') {
          void this.recover();
        }
      }
    );
  }
}

/** Singleton instance used by the app (stages 04/05). */
export const livePlaybackController = new LivePlaybackController();
