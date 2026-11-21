/**
 * Repositorio de audio_assets: operaciones CRUD, marca de archivo faltante y eliminación segura.
 */

import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';
import { getDatabase } from '../connection';
import type {
  AudioAsset,
  CreateAudioAssetInput,
  UpdateAudioAssetInput,
} from '../../models/audio-asset';
import { generateId, nowISO } from '@/lib/helpers';
import { logger } from '@/lib/logger';
import { NotFoundError, AudioAssetInUseError, DatabaseError } from '@/lib/errors';

export class AudioAssetRepository {
  constructor(private readonly db?: SQLiteDatabase) {}

  private async resolveDb(): Promise<SQLiteDatabase> {
    return this.db ?? (await getDatabase());
  }

  private mapRow(row: Record<string, unknown>): AudioAsset {
    return {
      id: String(row.id),
      type: row.type as AudioAsset['type'],
      display_name: String(row.display_name),
      original_filename: String(row.original_filename),
      internal_uri: String(row.internal_uri),
      external_source_uri: (row.external_source_uri as string | null) ?? null,
      source_url: (row.source_url as string | null) ?? null,
      file_extension: String(row.file_extension),
      mime_type: (row.mime_type as string | null) ?? null,
      duration_ms: row.duration_ms == null ? null : Number(row.duration_ms),
      file_size_bytes: row.file_size_bytes == null ? null : Number(row.file_size_bytes),
      sample_rate: row.sample_rate == null ? null : Number(row.sample_rate),
      channels: row.channels == null ? null : Number(row.channels),
      loudness_hint_db: row.loudness_hint_db == null ? null : Number(row.loudness_hint_db),
      is_missing: Boolean(row.is_missing),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  async create(input: CreateAudioAssetInput): Promise<AudioAsset> {
    const db = await this.resolveDb();
    const id = generateId();
    const now = nowISO();

    try {
      await db.runAsync(
        `INSERT INTO audio_assets (
          id, type, display_name, original_filename, internal_uri, external_source_uri,
          source_url, file_extension, mime_type, duration_ms, file_size_bytes,
          sample_rate, channels, loudness_hint_db, is_missing, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.type,
          input.display_name,
          input.original_filename,
          input.internal_uri,
          input.external_source_uri ?? null,
          input.source_url ?? null,
          input.file_extension,
          input.mime_type ?? null,
          input.duration_ms ?? null,
          input.file_size_bytes ?? null,
          input.sample_rate ?? null,
          input.channels ?? null,
          input.loudness_hint_db ?? null,
          0,
          now,
          now,
        ]
      );
    } catch (error) {
      logger.error('[AudioAssetRepository] create failed', { input, error });
      throw new DatabaseError('No se pudo crear el audio asset', { original: String(error) });
    }

    return {
      id,
      type: input.type,
      display_name: input.display_name,
      original_filename: input.original_filename,
      internal_uri: input.internal_uri,
      external_source_uri: input.external_source_uri ?? null,
      source_url: input.source_url ?? null,
      file_extension: input.file_extension,
      mime_type: input.mime_type ?? null,
      duration_ms: input.duration_ms ?? null,
      file_size_bytes: input.file_size_bytes ?? null,
      sample_rate: input.sample_rate ?? null,
      channels: input.channels ?? null,
      loudness_hint_db: input.loudness_hint_db ?? null,
      is_missing: false,
      created_at: now,
      updated_at: now,
    };
  }

  async list({ includeMissing = false }: { includeMissing?: boolean } = {}): Promise<AudioAsset[]> {
    const db = await this.resolveDb();
    const sql = includeMissing
      ? 'SELECT * FROM audio_assets ORDER BY created_at DESC'
      : 'SELECT * FROM audio_assets WHERE is_missing = 0 ORDER BY created_at DESC';
    const rows = await db.getAllAsync<Record<string, unknown>>(sql, []);
    return rows.map((row) => this.mapRow(row));
  }

  async getById(id: string): Promise<AudioAsset | null> {
    const db = await this.resolveDb();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM audio_assets WHERE id = ?',
      [id]
    );
    if (!row) return null;
    return this.mapRow(row);
  }

  async update(input: UpdateAudioAssetInput): Promise<AudioAsset> {
    const db = await this.resolveDb();
    const existing = await this.getById(input.id);
    if (!existing) {
      throw new NotFoundError(`AudioAsset ${input.id}`);
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

    setField('type', input.type);
    setField('display_name', input.display_name);
    setField('original_filename', input.original_filename);
    setField('internal_uri', input.internal_uri);
    setField('external_source_uri', input.external_source_uri);
    setField('source_url', input.source_url);
    setField('file_extension', input.file_extension);
    setField('mime_type', input.mime_type);
    setField('duration_ms', input.duration_ms);
    setField('file_size_bytes', input.file_size_bytes);
    setField('sample_rate', input.sample_rate);
    setField('channels', input.channels);
    setField('loudness_hint_db', input.loudness_hint_db);
    setField('is_missing', input.is_missing ? 1 : 0);
    updates.push('updated_at = ?');
    params.push(now);
    params.push(input.id);

    try {
      await db.runAsync(`UPDATE audio_assets SET ${updates.join(', ')} WHERE id = ?`, params);
    } catch (error) {
      throw new DatabaseError(`No se pudo actualizar el audio asset ${input.id}`, {
        original: String(error),
      });
    }

    const updated = await this.getById(input.id);
    if (!updated) {
      throw new DatabaseError(`El audio asset ${input.id} desapareció tras actualizar`);
    }
    return updated;
  }

  async markMissing(id: string, isMissing = true): Promise<void> {
    const db = await this.resolveDb();
    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError(`AudioAsset ${id}`);
    }
    await db.runAsync('UPDATE audio_assets SET is_missing = ?, updated_at = ? WHERE id = ?', [
      isMissing ? 1 : 0,
      nowISO(),
      id,
    ]);
  }

  async delete(id: string, { force = false }: { force?: boolean } = {}): Promise<void> {
    const db = await this.resolveDb();
    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError(`AudioAsset ${id}`);
    }

    const rows = await db.getAllAsync<{ count: string }>(
      'SELECT COUNT(*) AS count FROM setlist_items WHERE main_audio_id = ? OR intermediate_audio_id = ?',
      [id, id]
    );
    const inUse = Number(rows[0]?.count ?? 0) > 0;

    if (inUse && !force) {
      throw new AudioAssetInUseError(
        `No se puede eliminar el audio asset "${existing.display_name}" porque está referenciado por canciones de setlist.`,
        { audioId: id, displayName: existing.display_name }
      );
    }

    try {
      await db.runAsync('DELETE FROM audio_assets WHERE id = ?', [id]);
    } catch (error) {
      throw new DatabaseError(`No se pudo eliminar el audio asset ${id}`, {
        original: String(error),
      });
    }
  }
}
