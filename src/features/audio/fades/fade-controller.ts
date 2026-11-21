/**
 * Volume ramp controller for fades.
 *
 * Linear volume ramp with soft steps clamped to [16, 60]ms and output clamped
 * to [0, 1]. Only one fade can run at a time; starting a new fade cancels the
 * in-flight one (transition preemption).
 */

import type { FadeConfig, ResolvedFade } from '@/features/audio/types';
import { logger } from '@/lib/logger';

const MIN_STEP_MS = 16;
const MAX_STEP_MS = 60;
const DEFAULT_STEP_MS = 30;

export function normalizeStepMs(stepMs: number): number {
  return Math.min(Math.max(Math.floor(stepMs), MIN_STEP_MS), MAX_STEP_MS);
}

export interface FadeControllerDeps {
  /** Sets the global player volume (0..1). */
  setVolume: (level: number) => Promise<void>;
  /** Reads the current player volume. Defaults to the last set value. */
  getVolume?: () => Promise<number>;
  /** Step interval in ms for the ramp. Defaults to 30ms. */
  stepMs?: number;
}

interface RampState {
  startVolume: number;
  targetVolume: number;
  startTimeMs: number;
  durationMs: number;
  resolve: (value: void) => void;
  reject: (error: Error) => void;
  cancelled: boolean;
}

/**
 * Computes fade durations for a setlist item: per-song overrides win over
 * global defaults. Values are clamped to non-negative numbers.
 */
export function resolveFadeDurations(
  item: { fadeOutLoopMs: number | null; fadeInLoopMs: number | null },
  globals: FadeConfig
): ResolvedFade {
  return {
    fadeOutMs: Math.max(0, item.fadeOutLoopMs ?? globals.fadeOutMs),
    fadeInMs: Math.max(0, item.fadeInLoopMs ?? globals.fadeInMs),
  };
}

/**
 * Clamps a volume level to the audible range [0, 1].
 */
export function clampVolume(level: number): number {
  return Math.min(Math.max(level, 0), 1);
}

/**
 * FadeController drives volume from the current level to a target over a given
 * duration using equal time steps. The returned promise resolves when the ramp
 * finishes or is rejected/aborted when a new fade cancels it.
 */
export class FadeController {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ramp: RampState | null = null;
  private lastVolume: number;

  constructor(private readonly deps: FadeControllerDeps) {
    this.lastVolume = 1;
  }

  /**
   * Current fade target volume, or null when no fade is running.
   */
  get targetVolume(): number | null {
    return this.ramp?.targetVolume ?? null;
  }

  /**
   * Whether a fade ramp is currently in progress.
   */
  get isFading(): boolean {
    return this.timer !== null || this.ramp !== null;
  }

  /**
   * Starts a ramp to `targetVolume` over `durationMs`. Cancels any running
   * fade first. Resolves when the ramp reaches the target.
   */
  async fadeTo(targetVolume: number, durationMs: number): Promise<void> {
    this.cancel();
    const clampedTarget = clampVolume(targetVolume);
    const clampedDuration = Math.max(0, Math.floor(durationMs));
    const stepMs = normalizeStepMs(this.deps.stepMs ?? DEFAULT_STEP_MS);

    let startVolume = this.lastVolume;
    if (this.deps.getVolume) {
      try {
        startVolume = clampVolume(await this.deps.getVolume());
      } catch (error) {
        logger.warn('[FadeController] getVolume failed, using last known volume', {
          error,
        });
      }
    }

    if (clampedDuration === 0 || startVolume === clampedTarget) {
      this.lastVolume = clampedTarget;
      try {
        await this.deps.setVolume(clampedTarget);
      } catch (error) {
        throw new Error(`FadeController: setVolume failed during instant fade: ${String(error)}`);
      }
      return;
    }

    return new Promise((resolve, reject) => {
      const startTimeMs = Date.now();
      this.ramp = {
        startVolume,
        targetVolume: clampedTarget,
        startTimeMs,
        durationMs: clampedDuration,
        resolve,
        reject,
        cancelled: false,
      };

      const step = (): void => {
        const ramp = this.ramp;
        if (!ramp || ramp.cancelled) {
          this.cleanupTimer();
          return;
        }

        const elapsed = Date.now() - ramp.startTimeMs;
        const progress = Math.min(elapsed / ramp.durationMs, 1);
        const volume = clampVolume(
          ramp.startVolume + (ramp.targetVolume - ramp.startVolume) * progress
        );

        this.lastVolume = volume;
        void this.deps.setVolume(volume).catch((error) => {
          this.fail(new Error(`FadeController: setVolume failed during ramp: ${String(error)}`));
        });

        if (progress >= 1) {
          this.cleanupTimer();
          this.ramp = null;
          resolve();
        }
      };

      this.timer = setInterval(step, stepMs);
      // Execute the first step immediately so the response is not delayed by one interval.
      step();
    });
  }

  /**
   * Cancels the in-flight fade and leaves the volume at its last ramped value.
   * The in-flight promise rejects silently (consumers should treat cancellation
   * as non-fatal).
   */
  cancel(): void {
    if (this.ramp && !this.ramp.cancelled) {
      this.ramp.cancelled = true;
      try {
        this.ramp.reject(new Error('FadeController: fade cancelled by a newer transition'));
      } catch {
        // Ignore rejections on already-settled promises.
      }
      this.ramp = null;
    }
    this.cleanupTimer();
  }

  private cleanupTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private fail(error: Error): void {
    const ramp = this.ramp;
    this.cleanupTimer();
    this.ramp = null;
    ramp?.reject(error);
  }

  /** Tears down the controller, cancelling any running fade. */
  destroy(): void {
    this.cancel();
  }
}
