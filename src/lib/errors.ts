/**
 * Errores tipados de la capa de datos y almacenamiento.
 * Extienden AppError (src/types/index.ts) para llevar `code` y `context`
 * y poder renderizar mensajes de UI accionables.
 */

import type { AppError } from '@/types';

export class DatabaseError extends Error implements AppError {
  public readonly code = 'DATABASE_ERROR';
  public readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'DatabaseError';
    this.context = context;
  }
}

export class NotFoundError extends Error implements AppError {
  public readonly code = 'NOT_FOUND';
  public readonly context?: Record<string, unknown>;

  constructor(resource: string, context?: Record<string, unknown>) {
    super(`${resource} no encontrado`);
    this.name = 'NotFoundError';
    this.context = context;
  }
}

export class DuplicateAudioError extends Error implements AppError {
  public readonly code = 'DUPLICATE_AUDIO';
  public readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'DuplicateAudioError';
    this.context = context;
  }
}

export class AudioAssetInUseError extends Error implements AppError {
  public readonly code = 'AUDIO_ASSET_IN_USE';
  public readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'AudioAssetInUseError';
    this.context = context;
  }
}

export class InvalidFileError extends Error implements AppError {
  public readonly code = 'INVALID_FILE';
  public readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'InvalidFileError';
    this.context = context;
  }
}

export class ImportError extends Error implements AppError {
  public readonly code = 'IMPORT_ERROR';
  public readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'ImportError';
    this.context = context;
  }
}

export class StorageError extends Error implements AppError {
  public readonly code = 'STORAGE_ERROR';
  public readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'StorageError';
    this.context = context;
  }
}
