/**
 * Structured transition logging and metrics for the playback engine.
 *
 * Logs are kept in a fixed-size ring buffer so long-lived live sessions do not
 * grow memory unboundedly. Metrics capture trigger-to-audio latency and
 * transition durations for on-device diagnostics.
 */

import type { TransitionLogEntry, PlaybackPhase } from '@/features/audio/types';
import { logger } from '@/lib/logger';

const MAX_LOGS = 500;
const MAX_METRIC_SAMPLES = 200;

interface LatencySample {
  timestampMs: number;
  event: string;
  latencyMs: number;
}

interface TransitionSample {
  timestampMs: number;
  fromState: PlaybackPhase;
  toState: PlaybackPhase;
  durationMs: number;
  result: 'ok' | 'error' | 'blocked';
}

/**
 * AudioTracer records structured transition logs and timing metrics. All
 * methods are safe to call from any thread of the JS runtime.
 */
export class AudioTracer {
  private logs: TransitionLogEntry[] = [];
  private latencySamples: LatencySample[] = [];
  private transitionSamples: TransitionSample[] = [];

  /**
   * Records a structured transition log entry.
   */
  logTransition(entry: Omit<TransitionLogEntry, 'timestampMs'>): void {
    const log: TransitionLogEntry = { ...entry, timestampMs: Date.now() };
    this.logs.push(log);
    if (this.logs.length > MAX_LOGS) {
      this.logs.shift();
    }
    if (__DEV__) {
      logger.audio('[AudioTracer]', {
        event: log.event,
        from: log.fromState,
        to: log.toState,
        songId: log.songId,
        deck: log.deck,
        result: log.result,
        latencyMs: log.latencyMs,
      });
    }
  }

  /** Returns a copy of the transition logs, newest first. */
  getLogs(): TransitionLogEntry[] {
    return [...this.logs].reverse();
  }

  /** Returns the last N transition logs, newest first. */
  getRecentLogs(limit: number): TransitionLogEntry[] {
    return this.getLogs().slice(0, limit);
  }

  /**
   * Records a trigger-to-audio latency sample in milliseconds.
   */
  recordTriggerLatency(event: string, latencyMs: number): void {
    this.latencySamples.push({ timestampMs: Date.now(), event, latencyMs });
    if (this.latencySamples.length > MAX_METRIC_SAMPLES) {
      this.latencySamples.shift();
    }
  }

  /**
   * Records a transition duration sample.
   */
  recordTransitionDuration(
    fromState: PlaybackPhase,
    toState: PlaybackPhase,
    durationMs: number,
    result: 'ok' | 'error' | 'blocked'
  ): void {
    this.transitionSamples.push({
      timestampMs: Date.now(),
      fromState,
      toState,
      durationMs,
      result,
    });
    if (this.transitionSamples.length > MAX_METRIC_SAMPLES) {
      this.transitionSamples.shift();
    }
  }

  /** Returns aggregated latency metrics per event type. */
  getLatencyMetrics(): Record<
    string,
    { count: number; avgMs: number; maxMs: number; lastMs: number }
  > {
    const byEvent = new Map<string, LatencySample[]>();
    for (const sample of this.latencySamples) {
      const list = byEvent.get(sample.event) ?? [];
      list.push(sample);
      byEvent.set(sample.event, list);
    }
    const metrics: Record<string, { count: number; avgMs: number; maxMs: number; lastMs: number }> =
      {};
    for (const [event, samples] of byEvent) {
      const values = samples.map((s) => s.latencyMs);
      metrics[event] = {
        count: values.length,
        avgMs: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
        maxMs: Math.max(...values),
        lastMs: samples[samples.length - 1].latencyMs,
      };
    }
    return metrics;
  }

  /** Returns transition duration metrics grouped by (from, to). */
  getTransitionMetrics(): {
    fromState: PlaybackPhase;
    toState: PlaybackPhase;
    count: number;
    avgMs: number;
    okCount: number;
    errorCount: number;
  }[] {
    const byPair = new Map<string, TransitionSample[]>();
    for (const sample of this.transitionSamples) {
      const key = `${sample.fromState}->${sample.toState}`;
      const list = byPair.get(key) ?? [];
      list.push(sample);
      byPair.set(key, list);
    }
    const result: {
      fromState: PlaybackPhase;
      toState: PlaybackPhase;
      count: number;
      avgMs: number;
      okCount: number;
      errorCount: number;
    }[] = [];
    for (const [key, samples] of byPair) {
      const [fromState, toState] = key.split('->') as [PlaybackPhase, PlaybackPhase];
      const values = samples.map((s) => s.durationMs);
      result.push({
        fromState,
        toState,
        count: values.length,
        avgMs: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
        okCount: samples.filter((s) => s.result === 'ok').length,
        errorCount: samples.filter((s) => s.result === 'error').length,
      });
    }
    return result;
  }

  /** Clears all logs and metrics. */
  reset(): void {
    this.logs = [];
    this.latencySamples = [];
    this.transitionSamples = [];
  }
}

export const audioTracer = new AudioTracer();
