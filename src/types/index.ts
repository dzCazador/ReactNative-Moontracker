export interface AppError extends Error {
  code?: string;
  context?: Record<string, unknown>;
}
