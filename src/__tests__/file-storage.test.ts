import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/document/',
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}));

import { copyAsync, deleteAsync, getInfoAsync, makeDirectoryAsync } from 'expo-file-system/legacy';
import {
  AUDIO_DIRECTORY,
  copyFileToAppStorageAsync,
  deleteFileAsync,
  ensureAudioDirectoryAsync,
  extensionOf,
  fileExistsAsync,
  getFileSizeAsync,
  isSupportedExtension,
  SUPPORTED_EXTENSIONS,
} from '../services/filesystem/file-storage';

const mockCopyAsync = jest.mocked(copyAsync);
const mockDeleteAsync = jest.mocked(deleteAsync);
const mockGetInfoAsync = jest.mocked(getInfoAsync);
const mockMakeDirectoryAsync = jest.mocked(makeDirectoryAsync);

describe('file-storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMakeDirectoryAsync.mockResolvedValue(undefined);
    mockCopyAsync.mockResolvedValue(undefined);
    mockDeleteAsync.mockResolvedValue(undefined);
  });

  describe('constantes', () => {
    it('tiene directorio de audio y extensiones admitidas', () => {
      expect(AUDIO_DIRECTORY).toBe('file:///mock/document/audio/');
      expect(SUPPORTED_EXTENSIONS).toContain('.wav');
      expect(SUPPORTED_EXTENSIONS).toContain('.ogg');
      expect(SUPPORTED_EXTENSIONS).toContain('.flac');
      expect(isSupportedExtension('.WAV')).toBe(true);
      expect(isSupportedExtension('.mp3')).toBe(false);
    });

    it('extrae extensión y nombre interno', () => {
      expect(extensionOf('cancion.Flac')).toBe('.flac');
      expect(extensionOf('sin_extension')).toBe('');
    });
  });

  describe('ensureAudioDirectoryAsync', () => {
    it('crea el directorio con intermediates', async () => {
      await ensureAudioDirectoryAsync();
      expect(mockMakeDirectoryAsync).toHaveBeenCalledWith(AUDIO_DIRECTORY, {
        intermediates: true,
      });
    });
  });

  describe('copyFileToAppStorageAsync', () => {
    it('copia al almacenamiento gestionado y devuelve URI interna, nombre y tamaño', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        uri: 'file:///x/a.wav',
        size: 1234,
        isDirectory: false,
        modificationTime: 0,
      });

      const result = await copyFileToAppStorageAsync({
        uri: 'file:///mock/cache/original.wav',
        originalFilename: 'cancion.wav',
      });

      expect(mockCopyAsync).toHaveBeenCalledWith({
        from: 'file:///mock/cache/original.wav',
        to: expect.stringMatching(/audio\/[0-9a-f-]{36}\.wav$/),
      });
      expect(mockGetInfoAsync).toHaveBeenCalled();
      expect(result.size).toBe(1234);
      expect(result.fileName).toMatch(/^[0-9a-f-]{36}\.wav$/);
      expect(result.internalUri).toBe(`${AUDIO_DIRECTORY}${result.fileName}`);
    });

    it('rechaza formato no soportado antes de copiar', async () => {
      await expect(
        copyFileToAppStorageAsync({ uri: 'file:///x.mp3', originalFilename: 'cancion.mp3' })
      ).rejects.toMatchObject({ message: expect.stringContaining('.mp3') });
      expect(mockCopyAsync).not.toHaveBeenCalled();
    });

    it('lanzas StorageError si el archivo no queda persistido', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: false,
        uri: 'file:///x.wav',
        isDirectory: false,
      });
      await expect(
        copyFileToAppStorageAsync({ uri: 'file:///x.wav', originalFilename: 'cancion.wav' })
      ).rejects.toThrow();
    });
  });

  describe('fileExistsAsync', () => {
    it('devuelve true si existe', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        uri: 'file:///x.wav',
        size: 0,
        isDirectory: false,
        modificationTime: 0,
      });
      expect(await fileExistsAsync('file:///x.wav')).toBe(true);
    });

    it('devuelve false si no existe', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: false,
        uri: 'file:///x.wav',
        isDirectory: false,
      });
      expect(await fileExistsAsync('file:///x.wav')).toBe(false);
    });
  });

  describe('getFileSizeAsync', () => {
    it('devuelve el tamaño si existe', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        uri: 'file:///x.wav',
        size: 500,
        isDirectory: false,
        modificationTime: 0,
      });
      expect(await getFileSizeAsync('file:///x.wav')).toBe(500);
    });

    it('devuelve null si no existe', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: false,
        uri: 'file:///x.wav',
        isDirectory: false,
      });
      expect(await getFileSizeAsync('file:///x.wav')).toBeNull();
    });
  });

  describe('deleteFileAsync', () => {
    it('llama a deleteAsync con idempotent', async () => {
      await deleteFileAsync('file:///x.wav');
      expect(mockDeleteAsync).toHaveBeenCalledWith('file:///x.wav', { idempotent: true });
    });
  });
});
