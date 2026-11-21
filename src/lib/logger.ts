export const logger = {
  debug: (...args: unknown[]): void => {
    if (__DEV__) {
      console.log('[backTracker][debug]', ...args);
    }
  },
  info: (...args: unknown[]): void => {
    if (__DEV__) {
      console.info('[backTracker][info]', ...args);
    }
  },
  warn: (...args: unknown[]): void => {
    console.warn('[backTracker][warn]', ...args);
  },
  error: (...args: unknown[]): void => {
    console.error('[backTracker][error]', ...args);
  },
  audio: (...args: unknown[]): void => {
    if (__DEV__) {
      console.log('[backTracker][audio]', ...args);
    }
  },
  download: (...args: unknown[]): void => {
    if (__DEV__) {
      console.log('[backTracker][download]', ...args);
    }
  },
};
