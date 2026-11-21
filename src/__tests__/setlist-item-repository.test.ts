import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

import { SetlistItemRepository } from '@/data/db/repositories/setlist-item-repository';
import { NotFoundError } from '@/lib/errors';

function mockDb() {
  return {
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    withTransactionAsync: jest.fn((task: () => Promise<unknown>) => task()),
    execAsync: jest.fn(),
  };
}

function itemRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii',
    setlist_id: 'ssssssss-ssss-ssss-ssss-ssssssssssss',
    position: 1,
    song_title: 'Canción',
    artist: null,
    main_audio_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    intermediate_audio_id: null,
    intermediate_mode: 'GLOBAL_DEFAULT',
    notes: null,
    fade_out_loop_ms: null,
    fade_in_loop_ms: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('SetlistItemRepository', () => {
  let db: any;
  let repo: SetlistItemRepository;

  beforeEach(() => {
    db = mockDb();
    repo = new SetlistItemRepository(db);
    jest.clearAllMocks();
  });

  describe('add', () => {
    it('agrega en la siguiente posición y devuelve el ítem', async () => {
      db.getFirstAsync.mockResolvedValue({ max: null });
      db.runAsync.mockResolvedValue({ changes: 1 });

      const item = await repo.add({
        setlist_id: 'ssssssss-ssss-ssss-ssss-ssssssssssss',
        song_title: 'Canción',
        main_audio_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      });

      expect(item.position).toBe(1);
      expect(item.song_title).toBe('Canción');
      const [sql] = db.runAsync.mock.calls[0];
      expect(sql).toContain('INSERT INTO setlist_items');
    });

    it('respeta la posición indicada', async () => {
      db.getFirstAsync.mockResolvedValue({ max: '5' });
      db.runAsync.mockResolvedValue({ changes: 1 });

      const item = await repo.add({
        setlist_id: 'ssssssss-ssss-ssss-ssss-ssssssssssss',
        position: 3,
        song_title: 'Canción',
        main_audio_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      });

      expect(item.position).toBe(3);
    });
  });

  describe('remove', () => {
    it('elimina el ítem existente', async () => {
      db.getFirstAsync.mockResolvedValue(itemRow());
      db.runAsync.mockResolvedValue({ changes: 1 });

      await repo.remove('iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii');

      const [sql] = db.runAsync.mock.calls[db.runAsync.mock.calls.length - 1];
      expect(sql).toBe('DELETE FROM setlist_items WHERE id = ?');
    });

    it('lanza NotFoundError si no existe', async () => {
      db.getFirstAsync.mockResolvedValue(null);
      await expect(repo.remove('no-existe')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('reorder', () => {
    it('reordena usando posiciones temporales para evitar colisiones', async () => {
      db.getAllAsync.mockResolvedValue([
        itemRow({ id: 'item-1', position: 1 }),
        itemRow({ id: 'item-2', position: 2 }),
      ]);
      db.runAsync.mockResolvedValue({ changes: 1 });

      await repo.reorder('ssssssss-ssss-ssss-ssss-ssssssssssss', ['item-2', 'item-1']);

      expect(db.withTransactionAsync).toHaveBeenCalled();
      // Primera llamada dentro de la transacción: posición temporal negativa.
      const [firstSql] = db.runAsync.mock.calls[0];
      expect(firstSql).toContain('UPDATE setlist_items SET position = ?');
      expect(db.runAsync.mock.calls[0][1][0]).toBe(-2);
    });

    it('lanza si los IDs no coinciden con los ítems existentes', async () => {
      db.getAllAsync.mockResolvedValue([itemRow()]);
      await expect(
        repo.reorder('ssssssss-ssss-ssss-ssss-ssssssssssss', ['no-existe'])
      ).rejects.toThrow();
    });
  });

  describe('move', () => {
    it('mueve un ítem a una nueva posición y reordena', async () => {
      db.getAllAsync.mockResolvedValue([
        itemRow({ id: 'item-1', position: 1 }),
        itemRow({ id: 'item-2', position: 2 }),
        itemRow({ id: 'item-3', position: 3 }),
      ]);
      db.runAsync.mockResolvedValue({ changes: 1 });

      await repo.move('ssssssss-ssss-ssss-ssss-ssssssssssss', 'item-3', 1);

      expect(db.withTransactionAsync).toHaveBeenCalled();
    });

    it('lanza NotFoundError si el ítem no está en la setlist', async () => {
      db.getAllAsync.mockResolvedValue([itemRow()]);
      await expect(
        repo.move('ssssssss-ssss-ssss-ssss-ssssssssssss', 'no-existe', 1)
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('updateIntermediateConfig', () => {
    it('actualiza la configuración intermedia', async () => {
      db.getFirstAsync.mockResolvedValue(itemRow());
      db.runAsync.mockResolvedValue({ changes: 1 });

      await repo.updateIntermediateConfig('iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii', {
        intermediate_mode: 'CUSTOM',
        intermediate_audio_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        fade_out_loop_ms: 500,
      });

      const [sql] = db.runAsync.mock.calls[0];
      expect(sql).toContain('UPDATE setlist_items SET');
      expect(sql).toContain('intermediate_mode = ?');
    });

    it('no hace nada si no hay cambios', async () => {
      db.getFirstAsync.mockResolvedValue(itemRow());
      await repo.updateIntermediateConfig('iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii', {});
      expect(db.runAsync).not.toHaveBeenCalled();
    });

    it('lanza NotFoundError si no existe', async () => {
      db.getFirstAsync.mockResolvedValue(null);
      await expect(
        repo.updateIntermediateConfig('no-existe', { intermediate_mode: 'CUSTOM' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('getBySetlist', () => {
    it('devuelve ítems ordenados por posición', async () => {
      db.getAllAsync.mockResolvedValue([itemRow({ position: 1 }), itemRow({ position: 2 })]);

      const items = await repo.getBySetlist('ssssssss-ssss-ssss-ssss-ssssssssssss');

      expect(items).toHaveLength(2);
      expect(items[0].position).toBe(1);
      expect(items[1].position).toBe(2);
    });
  });

  describe('loadSetlistForLive', () => {
    it('carga setlist con audios resueltos ordenados', async () => {
      db.getAllAsync.mockResolvedValue([
        {
          ...itemRow(),
          main_audio_id_join: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          main_audio_type: 'MAIN_TRACK',
          main_audio_display_name: 'Pista principal',
          main_audio_original_filename: 'pista.wav',
          main_audio_internal_uri: 'file:///mock/document/audio/pista.wav',
          main_audio_external_source_uri: null,
          main_audio_source_url: null,
          main_audio_file_extension: '.wav',
          main_audio_mime_type: 'audio/wav',
          main_audio_duration_ms: 180000,
          main_audio_file_size_bytes: 3_000_000,
          main_audio_sample_rate: 44100,
          main_audio_channels: 2,
          main_audio_loudness_hint_db: null,
          main_audio_is_missing: 0,
          main_audio_created_at: '2026-01-01T00:00:00.000Z',
          main_audio_updated_at: '2026-01-01T00:00:00.000Z',
          intermediate_audio_id_join: null,
        },
      ]);

      const result = await repo.loadSetlistForLive('ssssssss-ssss-ssss-ssss-ssssssssssss');

      expect(result.setlistId).toBe('ssssssss-ssss-ssss-ssss-ssssssssssss');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].main_audio?.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(result.items[0].main_audio?.display_name).toBe('Pista principal');
      expect(result.items[0].intermediate_audio).toBeNull();
      const calls = db.getAllAsync.mock.calls as unknown[];
      const joinCalls = calls.filter((call) => {
        const arr = call as unknown[];
        return String(arr[0]).includes('INNER JOIN');
      });
      expect(joinCalls.length).toBeGreaterThan(0);
      expect((joinCalls[0] as unknown[])[0]).toContain('ORDER BY si.position ASC');
    });
  });
});
