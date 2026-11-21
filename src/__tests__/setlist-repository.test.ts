import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

import { SetlistRepository } from '@/data/db/repositories/setlist-repository';
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

function setlistRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'ssssssss-ssss-ssss-ssss-ssssssssssss',
    name: 'Mi setlist',
    description: null,
    default_intermediate_audio_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    last_played_at: null,
    item_count: 2,
    has_missing_audio: 0,
    ...overrides,
  };
}

describe('SetlistRepository', () => {
  let db: any;
  let repo: SetlistRepository;

  beforeEach(() => {
    db = mockDb();
    repo = new SetlistRepository(db);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('inserta y devuelve la setlist', async () => {
      db.runAsync.mockResolvedValue({ changes: 1 });

      const setlist = await repo.create({ name: 'Nueva' });

      expect(setlist.name).toBe('Nueva');
      expect(setlist.id).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
      const [sql] = db.runAsync.mock.calls[0];
      expect(sql).toContain('INSERT INTO setlists');
    });
  });

  describe('list', () => {
    it('devuelve setlists con conteos', async () => {
      db.getAllAsync.mockResolvedValue([
        setlistRow(),
        setlistRow({ id: 'tttttttt-tttt-tttt-tttt-tttttttttttt' }),
      ]);

      const setlists = await repo.list();

      expect(setlists).toHaveLength(2);
      expect(setlists[0].item_count).toBe(2);
      expect(setlists[0].has_missing_audio).toBe(false);
      const [sql] = db.getAllAsync.mock.calls[0];
      expect(sql).toContain('FROM setlists s');
      expect(sql).toContain('GROUP BY s.id');
    });
  });

  describe('getById', () => {
    it('devuelve la setlist existente', async () => {
      db.getAllAsync.mockResolvedValue([setlistRow()]);

      const setlist = await repo.getById('ssssssss-ssss-ssss-ssss-ssssssssssss');

      expect(setlist?.name).toBe('Mi setlist');
    });

    it('devuelve null cuando no existe', async () => {
      db.getAllAsync.mockResolvedValue([]);
      const setlist = await repo.getById('no-existe');
      expect(setlist).toBeNull();
    });
  });

  describe('update', () => {
    it('actualiza last_played_at', async () => {
      db.getAllAsync.mockResolvedValue([
        { ...setlistRow(), last_played_at: '2026-01-02T00:00:00.000Z' },
      ]);
      db.runAsync.mockResolvedValue({ changes: 1 });

      const setlist = await repo.update({
        id: 'ssssssss-ssss-ssss-ssss-ssssssssssss',
        last_played_at: '2026-01-02T00:00:00.000Z',
      });

      expect(setlist.last_played_at).toBe('2026-01-02T00:00:00.000Z');
      const [sql] = db.runAsync.mock.calls[0];
      expect(sql).toContain('UPDATE setlists SET');
    });

    it('lanza NotFoundError si no existe', async () => {
      db.getAllAsync.mockResolvedValue([]);
      await expect(repo.update({ id: 'no-existe', name: 'x' })).rejects.toBeInstanceOf(
        NotFoundError
      );
    });
  });

  describe('delete', () => {
    it('elimina la setlist existente', async () => {
      db.getAllAsync.mockResolvedValue([setlistRow()]);
      db.runAsync.mockResolvedValue({ changes: 1 });

      await repo.delete('ssssssss-ssss-ssss-ssss-ssssssssssss');

      const [sql] = db.runAsync.mock.calls[db.runAsync.mock.calls.length - 1];
      expect(sql).toBe('DELETE FROM setlists WHERE id = ?');
    });

    it('lanza NotFoundError si no existe', async () => {
      db.getAllAsync.mockResolvedValue([]);
      await expect(repo.delete('no-existe')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('duplicate', () => {
    it('duplica la setlist y sus ítems en una transacción', async () => {
      db.getAllAsync.mockResolvedValue([setlistRow()]);
      // items del setlist fuente
      db.getAllAsync.mockResolvedValueOnce([setlistRow()]); // getById
      db.getAllAsync.mockResolvedValue([
        {
          id: 'iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii',
          setlist_id: 'ssssssss-ssss-ssss-ssss-ssssssssssss',
          position: 1,
          song_title: 'Canción 1',
          artist: null,
          main_audio_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          intermediate_audio_id: null,
          intermediate_mode: 'GLOBAL_DEFAULT',
          notes: null,
          fade_out_loop_ms: null,
          fade_in_loop_ms: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ]);
      db.runAsync.mockResolvedValue({ changes: 1 });

      const copy = await repo.duplicate('ssssssss-ssss-ssss-ssss-ssssssssssss', 'Copia');

      expect(copy.name).toBe('Copia');
      expect(copy.id).not.toBe('ssssssss-ssss-ssss-ssss-ssssssssssss');
      expect(db.withTransactionAsync).toHaveBeenCalled();
    });
  });
});
