import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// expo-sqlite carga el módulo nativo de React Native, que falla en jsdom.
// Se mockea para que los repositorios puedan probarse con un doble de prueba.
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

import { AudioAssetRepository } from '@/data/db/repositories/audio-asset-repository';
import { NotFoundError, AudioAssetInUseError } from '@/lib/errors';

function mockDb() {
  return {
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    withTransactionAsync: jest.fn((task: () => Promise<unknown>) => task()),
    execAsync: jest.fn(),
  };
}

function audioRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    type: 'MAIN_TRACK',
    display_name: 'Mi pista',
    original_filename: 'mi-pista.wav',
    internal_uri: 'file:///mock/document/audio/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.wav',
    external_source_uri: null,
    source_url: null,
    file_extension: '.wav',
    mime_type: 'audio/wav',
    duration_ms: 120000,
    file_size_bytes: 2_000_000,
    sample_rate: 44100,
    channels: 2,
    loudness_hint_db: null,
    is_missing: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('AudioAssetRepository', () => {
  let db: any;
  let repo: AudioAssetRepository;

  beforeEach(() => {
    db = mockDb();
    repo = new AudioAssetRepository(db);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('inserta y devuelve el audio creado', async () => {
      db.runAsync.mockResolvedValue({ changes: 1 });

      const audio = await repo.create({
        type: 'MAIN_TRACK',
        display_name: 'Pista',
        original_filename: 'pista.wav',
        internal_uri: 'file:///mock/document/audio/x.wav',
        file_extension: '.wav',
      });

      expect(db.runAsync).toHaveBeenCalledTimes(1);
      const [sql, params] = db.runAsync.mock.calls[0];
      expect(sql).toContain('INSERT INTO audio_assets');
      expect(params[0]).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
      expect(params[1]).toBe('MAIN_TRACK');
      expect(audio.id).toEqual(params[0]);
      expect(audio.display_name).toBe('Pista');
      expect(audio.is_missing).toBe(false);
      expect(audio.created_at).toBe(audio.updated_at);
    });
  });

  describe('list', () => {
    it('devuelve los audios no faltantes ordenados', async () => {
      db.getAllAsync.mockResolvedValue([
        audioRow(),
        audioRow({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }),
      ]);

      const audios = await repo.list();

      expect(audios).toHaveLength(2);
      expect(audios[0].is_missing).toBe(false);
      const [sql] = db.getAllAsync.mock.calls[0];
      expect(sql).toContain('WHERE is_missing = 0');
    });

    it('incluye faltantes cuando se solicita', async () => {
      db.getAllAsync.mockResolvedValue([audioRow({ is_missing: 1 })]);

      const audios = await repo.list({ includeMissing: true });

      expect(audios).toHaveLength(1);
      expect(audios[0].is_missing).toBe(true);
    });
  });

  describe('getById', () => {
    it('devuelve el audio existente', async () => {
      db.getFirstAsync.mockResolvedValue(audioRow());

      const audio = await repo.getById('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

      expect(audio?.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(audio?.display_name).toBe('Mi pista');
    });

    it('devuelve null cuando no existe', async () => {
      db.getFirstAsync.mockResolvedValue(null);

      const audio = await repo.getById('no-existe');
      expect(audio).toBeNull();
    });
  });

  describe('update', () => {
    it('actualiza y devuelve el audio', async () => {
      db.getFirstAsync.mockResolvedValueOnce(audioRow()); // existe antes
      db.runAsync.mockResolvedValue({ changes: 1 });
      db.getFirstAsync.mockResolvedValueOnce(audioRow({ display_name: 'Renombrado' })); // después

      const audio = await repo.update({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        display_name: 'Renombrado',
      });

      expect(audio.display_name).toBe('Renombrado');
      const [sql] = db.runAsync.mock.calls[0];
      expect(sql).toContain('UPDATE audio_assets SET');
      expect(sql).toContain('display_name = ?');
    });

    it('lanza NotFoundError si no existe', async () => {
      db.getFirstAsync.mockResolvedValue(null);

      await expect(repo.update({ id: 'no-existe', display_name: 'x' })).rejects.toBeInstanceOf(
        NotFoundError
      );
    });
  });

  describe('markMissing', () => {
    it('marca el audio como faltante', async () => {
      db.getFirstAsync.mockResolvedValue(audioRow());
      db.runAsync.mockResolvedValue({ changes: 1 });

      await repo.markMissing('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

      const [sql, params] = db.runAsync.mock.calls[0];
      expect(sql).toContain('is_missing = ?');
      expect(params[0]).toBe(1);
    });

    it('lanza NotFoundError si no existe', async () => {
      db.getFirstAsync.mockResolvedValue(null);
      await expect(repo.markMissing('no-existe')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('delete', () => {
    it('elimina cuando no hay referencias', async () => {
      db.getFirstAsync.mockResolvedValue(audioRow());
      db.getAllAsync.mockResolvedValue([{ count: '0' }]);
      db.runAsync.mockResolvedValue({ changes: 1 });

      await repo.delete('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

      const [sql] = db.runAsync.mock.calls[db.runAsync.mock.calls.length - 1];
      expect(sql).toBe('DELETE FROM audio_assets WHERE id = ?');
    });

    it('lanza AudioAssetInUseError cuando hay referencias', async () => {
      db.getFirstAsync.mockResolvedValue(audioRow());
      db.getAllAsync.mockResolvedValue([{ count: '2' }]);

      await expect(repo.delete('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).rejects.toBeInstanceOf(
        AudioAssetInUseError
      );
    });

    it('elimina forzando aunque haya referencias', async () => {
      db.getFirstAsync.mockResolvedValue(audioRow());
      db.getAllAsync.mockResolvedValue([{ count: '1' }]);
      db.runAsync.mockResolvedValue({ changes: 1 });

      await repo.delete('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', { force: true });

      expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM audio_assets WHERE id = ?', [
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      ]);
    });
  });
});
