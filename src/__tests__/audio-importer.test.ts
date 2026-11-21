import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/document/',
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

import { openDatabaseAsync } from 'expo-sqlite';
import { copyAsync, deleteAsync, getInfoAsync, makeDirectoryAsync } from 'expo-file-system/legacy';
import { getDocumentAsync } from 'expo-document-picker';
import {
  pickAudioFileAsync,
  importAudioFileAsync,
  detectMissingFilesAsync,
  safeDeleteAudioAssetAsync,
} from '../services/filesystem/audio-importer';
import { ImportError, DuplicateAudioError } from '@/lib/errors';

const mockOpenDatabaseAsync = jest.mocked(openDatabaseAsync);
const mockCopyAsync = jest.mocked(copyAsync);
const mockDeleteAsync = jest.mocked(deleteAsync);
const mockGetInfoAsync = jest.mocked(getInfoAsync);
const mockMakeDirectoryAsync = jest.mocked(makeDirectoryAsync);
const mockGetDocumentAsync = jest.mocked(getDocumentAsync);

const mockedDb: any = {
  runAsync: jest.fn(),
  getAllAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  withTransactionAsync: jest.fn((task: () => Promise<unknown>) => task()),
  execAsync: jest.fn(),
};

function audioAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    type: 'MAIN_TRACK',
    display_name: 'Canción',
    original_filename: 'cancion.wav',
    internal_uri: 'file:///mock/document/audio/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.wav',
    external_source_uri: null,
    source_url: null,
    file_extension: '.wav',
    mime_type: 'audio/wav',
    duration_ms: null,
    file_size_bytes: 1_000_000,
    sample_rate: null,
    channels: null,
    loudness_hint_db: null,
    is_missing: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('audio-importer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenDatabaseAsync.mockResolvedValue(mockedDb);
    mockedDb.runAsync.mockResolvedValue({ changes: 1 });
    mockedDb.getAllAsync.mockResolvedValue([]);
    mockedDb.getFirstAsync.mockResolvedValue(audioAsset());
    mockCopyAsync.mockResolvedValue(undefined);
    mockDeleteAsync.mockResolvedValue(undefined);
    mockGetInfoAsync.mockResolvedValue({
      exists: true,
      uri: 'file:///x.wav',
      size: 1000,
      isDirectory: false,
      modificationTime: 0,
    });
    mockMakeDirectoryAsync.mockResolvedValue(undefined);
  });

  describe('pickAudioFileAsync', () => {
    it('devuelve [] cuando se cancela', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
      const assets = await pickAudioFileAsync();
      expect(assets).toEqual([]);
    });

    it('devuelve los assets seleccionados', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: 'file:///x.wav',
            name: 'cancion.wav',
            mimeType: 'audio/wav',
            size: 1000,
            lastModified: 0,
          },
        ],
      });
      const assets = await pickAudioFileAsync();
      expect(assets).toHaveLength(1);
      expect(assets[0].name).toBe('cancion.wav');
    });
  });

  describe('importAudioFileAsync', () => {
    it('importa un archivo nuevo, lo copia y persiste metadatos', async () => {
      mockedDb.getAllAsync.mockResolvedValue([]); // sin duplicados

      const result = await importAudioFileAsync({
        uri: 'file:///mock/cache/original.wav',
        originalFilename: 'cancion.wav',
        mimeType: 'audio/wav',
        size: 1000,
      });

      expect(result.reused).toBe(false);
      expect(result.fileCopied).toBe(true);
      expect(result.audio.id).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
      expect(result.audio.display_name).toBe('cancion.wav');
      expect(result.audio.internal_uri).toContain('/audio/');
      expect(result.audio.file_extension).toBe('.wav');
      expect(mockCopyAsync).toHaveBeenCalled();
    });

    it('reutiliza un existente cuando hay duplicado', async () => {
      const existing = audioAsset({ original_filename: 'cancion.wav', file_size_bytes: 1000 });
      mockedDb.getAllAsync.mockResolvedValue([existing]);

      const result = await importAudioFileAsync({
        uri: 'file:///mock/cache/original.wav',
        originalFilename: 'cancion.wav',
        size: 1000,
      });

      expect(result.reused).toBe(true);
      expect(result.fileCopied).toBe(false);
      expect(result.audio.id).toBe(existing.id);
      expect(mockCopyAsync).not.toHaveBeenCalled();
    });

    it('lanza DuplicateAudioError si onDuplicate es copy y hay duplicado', async () => {
      const existing = audioAsset({ original_filename: 'cancion.wav', file_size_bytes: 1000 });
      mockedDb.getAllAsync.mockResolvedValue([existing]);

      await expect(
        importAudioFileAsync({
          uri: 'file:///x.wav',
          originalFilename: 'cancion.wav',
          size: 1000,
          onDuplicate: 'copy',
        })
      ).rejects.toBeInstanceOf(DuplicateAudioError);
    });

    it('rechaza formato no soportado', async () => {
      await expect(
        importAudioFileAsync({
          uri: 'file:///x.mp3',
          originalFilename: 'cancion.mp3',
          size: 1000,
        })
      ).rejects.toBeInstanceOf(ImportError);
    });
  });

  describe('detectMissingFilesAsync', () => {
    it('marca como faltante el archivo que no está en disco', async () => {
      const missing = audioAsset({
        is_missing: false,
        internal_uri: 'file:///mock/document/audio/missing.wav',
      });
      mockedDb.getAllAsync.mockResolvedValue([missing]);
      mockedDb.getFirstAsync.mockResolvedValue(missing);
      mockGetInfoAsync.mockResolvedValue({
        exists: false,
        uri: 'file:///mock/document/audio/missing.wav',
        isDirectory: false,
      });

      const report = await detectMissingFilesAsync();

      expect(report.checked).toBe(1);
      expect(report.markedMissing).toBe(1);
    });
  });

  describe('safeDeleteAudioAssetAsync', () => {
    it('elimina el audio y el archivo cuando no hay referencias', async () => {
      mockedDb.getFirstAsync.mockResolvedValue(audioAsset());
      mockedDb.getAllAsync.mockResolvedValue([{ count: '0' }]);
      mockedDb.runAsync.mockResolvedValue({ changes: 1 });

      const result = await safeDeleteAudioAssetAsync({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      });

      expect(result.deleted).toBe(true);
      expect(result.fileDeleted).toBe(true);
    });

    it('no elimina cuando hay referencias', async () => {
      mockedDb.getFirstAsync.mockResolvedValue(audioAsset());
      mockedDb.getAllAsync.mockResolvedValue([{ count: '1' }]);

      const result = await safeDeleteAudioAssetAsync({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      });

      expect(result.deleted).toBe(false);
      expect(result.fileDeleted).toBe(false);
    });
  });
});
