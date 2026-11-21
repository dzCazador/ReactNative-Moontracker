/**
 * Serial command queue with debounce.
 *
 * Guarantees that playback transitions (load, prepare, triggerNext, stop,
 * recover) are executed one at a time, in order. A configurable debounce
 * window suppresses duplicate triggers (e.g. double-tap on "Next").
 */

export type QueuedCommand = () => Promise<void>;

export interface CommandQueueOptions {
  /** Debounce window in milliseconds for repeated identical commands. Defaults to 800ms. */
  debounceMs?: number;
}

/**
 * CommandQueue chains commands on a promise mutex and applies a debounce
 * window per command name so rapid repeated triggers are collapsed.
 */
export class CommandQueue {
  private chain: Promise<void> = Promise.resolve();
  private debounceWindows = new Map<string, number>();
  private inFlight = 0;
  private readonly debounceMs: number;

  constructor(options: CommandQueueOptions = {}) {
    this.debounceMs = options.debounceMs ?? 800;
  }

  /**
   * Queues `command` to run after all previously queued work. Resolves with the
   * command's result. Rejects if the command is inside a debounce window
   * (duplicate trigger).
   */
  enqueue(name: string, command: QueuedCommand): Promise<void> {
    const now = Date.now();
    const lockedUntil = this.debounceWindows.get(name) ?? 0;

    if (now < lockedUntil) {
      return Promise.reject(
        new Error(
          `CommandQueue: command "${name}" blocked by debounce window (${Math.ceil((lockedUntil - now) / 1000)}s remaining)`
        )
      );
    }

    const run = async (): Promise<void> => {
      this.inFlight += 1;
      try {
        await command();
      } finally {
        this.inFlight -= 1;
        // The debounce window starts when the command finishes so rapid repeats
        // after a transition are suppressed, but a retry after failure is not
        // blocked.
        this.debounceWindows.set(name, Date.now() + this.debounceMs);
      }
    };

    this.chain = this.chain.then(run);
    return this.chain;
  }

  /** Clears the debounce window for a command (used after recovery). */
  clearDebounce(name: string): void {
    this.debounceWindows.delete(name);
  }

  /** Whether a command is currently in flight. */
  get busy(): boolean {
    return this.inFlight > 0;
  }
}
