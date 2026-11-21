/**
 * Repositorio de setlists: CRUD, duplicado y listado con conteos.
 */

import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';
import { getDatabase } from '../connection';
import { SetlistItemRepository } from './setlist-item-repository';
import type {
  Setlist,
  SetlistWithCounts,
  CreateSetlistInput,
  UpdateSetlistInput,
} from '../../models/setlist';
import { generateId, nowISO } from '@/lib/helpers';
import { logger } from '@/lib/logger';
import { NotFoundError, DatabaseError } from '@/lib/errors';

export class SetlistRepository {
  constructor(private readonly db?: SQLiteDatabase) {}

  private async resolveDb(): Promise<SQLiteDatabase> {
    return this.db ?? (await getDatabase());
  }

  private mapRow(row: Record<string, unknown>): SetlistWithCounts {
    return {
      id: String(row.id),
      name: String(row.name),
      description: (row.description as string | null) ?? null,
      default_intermediate_audio_id: (row.default_intermediate_audio_id as string | null) ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      last_played_at: (row.last_played_at as string | null) ?? null,
      item_count: Number(row.item_count ?? 0),
      has_missing_audio: Boolean(Number(row.has_missing_audio ?? 0)),
    };
  }

  async create(input: CreateSetlistInput): Promise<Setlist> {
    const db = await this.resolveDb();
    const id = generateId();
    const now = nowISO();

    try {
      await db.runAsync(
        `INSERT INTO setlists (id, name, description, default_intermediate_audio_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.name,
          input.description ?? null,
          input.default_intermediate_audio_id ?? null,
          now,
          now,
        ]
      );
    } catch (error) {
      logger.error('[SetlistRepository] create failed', { input, error });
      throw new DatabaseError('No se pudo crear la setlist', { original: String(error) });
    }

    return {
      id,
      name: input.name,
      description: input.description ?? null,
      default_intermediate_audio_id: input.default_intermediate_audio_id ?? null,
      created_at: now,
      updated_at: now,
      last_played_at: null,
    };
  }

  async list(): Promise<SetlistWithCounts[]> {
    const db = await this.resolveDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT
        s.id, s.name, s.description, s.default_intermediate_audio_id, s.created_at, s.updated_at, s.last_played_at,
        COUNT(si.id) AS item_count,
        CASE WHEN SUM(CASE WHEN aa.id IS NOT NULL AND aa.is_missing = 1 THEN 1 ELSE 0 END) > 0 THEN 1 ELSE 0 END AS has_missing_audio
      FROM setlists s
      LEFT JOIN setlist_items si ON si.setlist_id = s.id
      LEFT JOIN audio_assets aa ON aa.id = si.main_audio_id
      GROUP BY s.id
      ORDER BY s.updated_at DESC`,
      []
    );
    return rows.map((row) => this.mapRow(row));
  }

  async getById(id: string): Promise<SetlistWithCounts | null> {
    const db = await this.resolveDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT
        s.id, s.name, s.description, s.default_intermediate_audio_id, s.created_at, s.updated_at, s.last_played_at,
        COUNT(si.id) AS item_count,
        CASE WHEN SUM(CASE WHEN aa.id IS NOT NULL AND aa.is_missing = 1 THEN 1 ELSE 0 END) > 0 THEN 1 ELSE 0 END AS has_missing_audio
      FROM setlists s
      LEFT JOIN setlist_items si ON si.setlist_id = s.id
      LEFT JOIN audio_assets aa ON aa.id = si.main_audio_id
      WHERE s.id = ?
      GROUP BY s.id`,
      [id]
    );
    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  async update(input: UpdateSetlistInput): Promise<Setlist> {
    const db = await this.resolveDb();
    const existing = await this.getById(input.id);
    if (!existing) {
      throw new NotFoundError(`Setlist ${input.id}`);
    }

    const now = nowISO();
    const updates: string[] = [];
    const params: SQLiteBindValue[] = [];

    const setField = (name: string, value: SQLiteBindValue | undefined) => {
      if (value !== undefined) {
        updates.push(`${name} = ?`);
        params.push(value);
      }
    };

    setField('name', input.name);
    setField('description', input.description);
    setField('default_intermediate_audio_id', input.default_intermediate_audio_id);
    setField('last_played_at', input.last_played_at);
    updates.push('updated_at = ?');
    params.push(now);
    params.push(input.id);

    try {
      await db.runAsync(`UPDATE setlists SET ${updates.join(', ')} WHERE id = ?`, params);
    } catch (error) {
      throw new DatabaseError(`No se pudo actualizar la setlist ${input.id}`, {
        original: String(error),
      });
    }

    const updated = await this.getById(input.id);
    if (!updated) {
      throw new DatabaseError(`La setlist ${input.id} desapareció tras actualizar`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const db = await this.resolveDb();
    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError(`Setlist ${id}`);
    }

    // `ON DELETE CASCADE` en setlist_items(setlist_id) borra los ítems automáticamente
    // siempre que PRAGMA foreign_keys = ON esté activo (ver connection.ts).
    try {
      await db.runAsync('DELETE FROM setlists WHERE id = ?', [id]);
    } catch (error) {
      throw new DatabaseError(`No se pudo eliminar la setlist ${id}`, { original: String(error) });
    }
  }

  async duplicate(id: string, newName: string): Promise<Setlist> {
    const db = await this.resolveDb();
    const source = await this.getById(id);
    if (!source) {
      throw new NotFoundError(`Setlist ${id}`);
    }

    const itemsRepository = new SetlistItemRepository(db);
    const items = await itemsRepository.getBySetlist(id);

    let newSetlist: Setlist | undefined;
    await db.withTransactionAsync(async () => {
      newSetlist = await this.create({
        name: newName,
        description: source.description,
        default_intermediate_audio_id: source.default_intermediate_audio_id,
      });

      for (const item of items) {
        await itemsRepository.add(
          {
            setlist_id: newSetlist.id,
            position: item.position,
            song_title: item.song_title,
            artist: item.artist,
            main_audio_id: item.main_audio_id,
            intermediate_audio_id: item.intermediate_audio_id,
            intermediate_mode: item.intermediate_mode,
            notes: item.notes,
            fade_out_loop_ms: item.fade_out_loop_ms,
            fade_in_loop_ms: item.fade_in_loop_ms,
          },
          db
        );
      }
    });

    if (!newSetlist) {
      throw new DatabaseError('No se pudo duplicar la setlist');
    }
    return newSetlist;
  }
}
