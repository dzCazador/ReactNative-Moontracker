/**
 * Repositorio de setlist_items: agregar, eliminar, reordenar (transaccional),
 * actualizar configuración de audio intermedio y carga completa para Modo En Vivo.
 */

import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';
import { getDatabase } from '../connection';
import type {
  SetlistItem,
  SetlistItemWithAudio,
  CreateSetlistItemInput,
  IntermediateMode,
} from '../../models/setlist-item';
import type { AudioAsset } from '../../models/audio-asset';
import { generateId, nowISO } from '@/lib/helpers';
import { logger } from '@/lib/logger';
import { NotFoundError, DatabaseError } from '@/lib/errors';

export class SetlistItemRepository {
  constructor(private readonly db?: SQLiteDatabase) {}

  private async resolveDb(): Promise<SQLiteDatabase> {
    return this.db ?? (await getDatabase());
  }

  private mapRow(row: Record<string, unknown>): SetlistItem {
    return {
      id: String(row.id),
      setlist_id: String(row.setlist_id),
      position: Number(row.position),
      song_title: String(row.song_title),
      artist: (row.artist as string | null) ?? null,
      main_audio_id: String(row.main_audio_id),
      intermediate_audio_id: (row.intermediate_audio_id as string | null) ?? null,
      intermediate_mode: row.intermediate_mode as IntermediateMode,
      notes: (row.notes as string | null) ?? null,
      fade_out_loop_ms: row.fade_out_loop_ms == null ? null : Number(row.fade_out_loop_ms),
      fade_in_loop_ms: row.fade_in_loop_ms == null ? null : Number(row.fade_in_loop_ms),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapRowWithAudio(
    row: Record<string, unknown>,
    mainAudio: AudioAsset | null,
    intermediateAudio: AudioAsset | null
  ): SetlistItemWithAudio {
    return {
      ...this.mapRow(row),
      main_audio: mainAudio,
      intermediate_audio: intermediateAudio,
    };
  }

  async add(input: CreateSetlistItemInput, db?: SQLiteDatabase): Promise<SetlistItem> {
    const database = db ?? (await this.resolveDb());
    const id = generateId();
    const now = nowISO();
    const position = input.position ?? (await this.nextPosition(input.setlist_id, database));

    try {
      await database.runAsync(
        `INSERT INTO setlist_items (
          id, setlist_id, position, song_title, artist, main_audio_id,
          intermediate_audio_id, intermediate_mode, notes,
          fade_out_loop_ms, fade_in_loop_ms, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.setlist_id,
          position,
          input.song_title,
          input.artist ?? null,
          input.main_audio_id,
          input.intermediate_audio_id ?? null,
          input.intermediate_mode ?? 'GLOBAL_DEFAULT',
          input.notes ?? null,
          input.fade_out_loop_ms ?? null,
          input.fade_in_loop_ms ?? null,
          now,
          now,
        ]
      );
    } catch (error) {
      logger.error('[SetlistItemRepository] add failed', { input, error });
      throw new DatabaseError('No se pudo agregar el ítem a la setlist', {
        original: String(error),
      });
    }

    return {
      id,
      setlist_id: input.setlist_id,
      position,
      song_title: input.song_title,
      artist: input.artist ?? null,
      main_audio_id: input.main_audio_id,
      intermediate_audio_id: input.intermediate_audio_id ?? null,
      intermediate_mode: input.intermediate_mode ?? 'GLOBAL_DEFAULT',
      notes: input.notes ?? null,
      fade_out_loop_ms: input.fade_out_loop_ms ?? null,
      fade_in_loop_ms: input.fade_in_loop_ms ?? null,
      created_at: now,
      updated_at: now,
    };
  }

  async remove(id: string): Promise<void> {
    const db = await this.resolveDb();
    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError(`SetlistItem ${id}`);
    }
    try {
      await db.runAsync('DELETE FROM setlist_items WHERE id = ?', [id]);
    } catch (error) {
      throw new DatabaseError(`No se pudo eliminar el ítem ${id}`, { original: String(error) });
    }
  }

  /**
   * Reordena los ítems de una setlist dentro de una transacción.
   * `orderedItemIds` es el arreglo de IDs de ítems en la posición final deseada (índice 0 = posición 1).
   *
   * Técnica de compensación para evitar violaciones de la restricción UNIQUE(setlist_id, position)
   * durante el reorden (por ejemplo, al intercambiar dos ítems):
   *  1. Asigna posiciones temporales negativas únicas a todos los ítems.
   *  2. Asigna la posición final a cada ítem.
   */
  async reorder(setlistId: string, orderedItemIds: string[]): Promise<void> {
    const db = await this.resolveDb();
    const items = await this.getBySetlist(setlistId, db);

    const orderedSet = new Set(orderedItemIds);
    const missing = orderedItemIds.filter((itemId) => !items.some((i) => i.id === itemId));
    const extra = items.filter((i) => !orderedSet.has(i.id));
    if (missing.length > 0 || extra.length > 0) {
      throw new DatabaseError(
        'Los IDs de ítems a reordenar no coinciden exactamente con los ítems existentes de la setlist',
        { missing, extra: extra.map((i) => i.id) }
      );
    }

    await db.withTransactionAsync(async () => {
      // Paso 1: posiciones temporales negativas únicas (elimina colisiones de UNIQUE).
      for (const item of items) {
        await db.runAsync('UPDATE setlist_items SET position = ?, updated_at = ? WHERE id = ?', [
          -(item.position + 1),
          nowISO(),
          item.id,
        ]);
      }
      // Paso 2: posiciones finales 1..n en el orden indicado.
      for (let index = 0; index < orderedItemIds.length; index += 1) {
        const position = index + 1;
        await db.runAsync('UPDATE setlist_items SET position = ?, updated_at = ? WHERE id = ?', [
          position,
          nowISO(),
          orderedItemIds[index],
        ]);
      }
    });
  }

  /**
   * Mueve un ítem a una nueva posición (1-indexada), desplazando los demás.
   */
  async move(setlistId: string, itemId: string, newPosition: number): Promise<void> {
    const db = await this.resolveDb();
    const items = await this.getBySetlist(setlistId, db);

    const target = items.find((i) => i.id === itemId);
    if (!target) {
      throw new NotFoundError(`SetlistItem ${itemId} no encontrado en la setlist ${setlistId}`);
    }

    const clampedPosition = Math.min(Math.max(newPosition, 1), items.length);
    const ordered = items
      .filter((i) => i.id !== itemId)
      .slice(0, clampedPosition - 1)
      .concat({ ...target })
      .concat(items.filter((i) => i.id !== itemId).slice(clampedPosition - 1));

    await this.reorder(
      setlistId,
      ordered.map((i) => i.id)
    );
  }

  async updateIntermediateConfig(
    id: string,
    config: {
      intermediate_audio_id?: string | null;
      intermediate_mode?: IntermediateMode;
      fade_out_loop_ms?: number | null;
      fade_in_loop_ms?: number | null;
    }
  ): Promise<void> {
    const db = await this.resolveDb();
    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError(`SetlistItem ${id}`);
    }

    const now = nowISO();
    const updates: string[] = [];
    const params: SQLiteBindValue[] = [];

    const setField = (name: string, value: SQLiteBindValue | undefined) => {
      if (value !== undefined) {
        updates.push(`${name} = ?`);
        params.push(value === null ? null : value);
      }
    };

    setField('intermediate_audio_id', config.intermediate_audio_id);
    setField('intermediate_mode', config.intermediate_mode);
    setField('fade_out_loop_ms', config.fade_out_loop_ms);
    setField('fade_in_loop_ms', config.fade_in_loop_ms);

    if (updates.length === 0) return;

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    try {
      await db.runAsync(`UPDATE setlist_items SET ${updates.join(', ')} WHERE id = ?`, params);
    } catch (error) {
      throw new DatabaseError(`No se pudo actualizar la configuración intermedia del ítem ${id}`, {
        original: String(error),
      });
    }
  }

  async getBySetlist(setlistId: string, db?: SQLiteDatabase): Promise<SetlistItem[]> {
    const database = db ?? (await this.resolveDb());
    const rows = await database.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM setlist_items WHERE setlist_id = ? ORDER BY position ASC',
      [setlistId]
    );
    return rows.map((row) => this.mapRow(row));
  }

  async getById(id: string): Promise<SetlistItem | null> {
    const db = await this.resolveDb();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM setlist_items WHERE id = ?',
      [id]
    );
    if (!row) return null;
    return this.mapRow(row);
  }

  /**
   * Carga una setlist completa para Modo En Vivo, con los audios principales e
   * intermedios resueltos, ordenada por posición de reproducción.
   */
  async loadSetlistForLive(
    setlistId: string
  ): Promise<{ setlistId: string; items: SetlistItemWithAudio[] }> {
    const db = await this.resolveDb();

    const setlistRows = await db.getAllAsync<Record<string, unknown>>(
      'SELECT id FROM setlists WHERE id = ?',
      [setlistId]
    );
    if (setlistRows.length === 0) {
      throw new NotFoundError(`Setlist ${setlistId}`);
    }

    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT
        si.id, si.setlist_id, si.position, si.song_title, si.artist, si.main_audio_id,
        si.intermediate_audio_id, si.intermediate_mode, si.notes, si.fade_out_loop_ms,
        si.fade_in_loop_ms, si.created_at, si.updated_at,
        ma.id AS main_audio_id_join, ma.type AS main_audio_type, ma.display_name AS main_audio_display_name,
        ma.original_filename AS main_audio_original_filename, ma.internal_uri AS main_audio_internal_uri,
        ma.external_source_uri AS main_audio_external_source_uri, ma.source_url AS main_audio_source_url,
        ma.file_extension AS main_audio_file_extension, ma.mime_type AS main_audio_mime_type,
        ma.duration_ms AS main_audio_duration_ms, ma.file_size_bytes AS main_audio_file_size_bytes,
        ma.sample_rate AS main_audio_sample_rate, ma.channels AS main_audio_channels,
        ma.loudness_hint_db AS main_audio_loudness_hint_db, ma.is_missing AS main_audio_is_missing,
        ma.created_at AS main_audio_created_at, ma.updated_at AS main_audio_updated_at,
        ia.id AS intermediate_audio_id_join, ia.type AS intermediate_audio_type,
        ia.display_name AS intermediate_audio_display_name,
        ia.original_filename AS intermediate_audio_original_filename,
        ia.internal_uri AS intermediate_audio_internal_uri,
        ia.external_source_uri AS intermediate_audio_external_source_uri,
        ia.source_url AS intermediate_audio_source_url,
        ia.file_extension AS intermediate_audio_file_extension, ia.mime_type AS intermediate_audio_mime_type,
        ia.duration_ms AS intermediate_audio_duration_ms, ia.file_size_bytes AS intermediate_audio_file_size_bytes,
        ia.sample_rate AS intermediate_audio_sample_rate, ia.channels AS intermediate_audio_channels,
        ia.loudness_hint_db AS intermediate_audio_loudness_hint_db, ia.is_missing AS intermediate_audio_is_missing,
        ia.created_at AS intermediate_audio_created_at, ia.updated_at AS intermediate_audio_updated_at
      FROM setlist_items si
      INNER JOIN audio_assets ma ON ma.id = si.main_audio_id
      LEFT JOIN audio_assets ia ON ia.id = si.intermediate_audio_id
      WHERE si.setlist_id = ?
      ORDER BY si.position ASC`,
      [setlistId]
    );

    const items = rows.map((row) => {
      const mainAudio: AudioAsset | null =
        row.main_audio_id_join == null ? null : this.mapAudioAssetRow(row, 'main_audio_');
      const intermediateAudio: AudioAsset | null =
        row.intermediate_audio_id_join == null
          ? null
          : this.mapAudioAssetRow(row, 'intermediate_audio_');

      return {
        ...this.mapRow(row),
        main_audio: mainAudio,
        intermediate_audio: intermediateAudio,
      };
    });

    return { setlistId, items };
  }

  private mapAudioAssetRow(row: Record<string, unknown>, prefix: string): AudioAsset {
    return {
      id: String(row[`${prefix}id`]),
      type: row[`${prefix}type`] as AudioAsset['type'],
      display_name: String(row[`${prefix}display_name`]),
      original_filename: String(row[`${prefix}original_filename`]),
      internal_uri: String(row[`${prefix}internal_uri`]),
      external_source_uri: (row[`${prefix}external_source_uri`] as string | null) ?? null,
      source_url: (row[`${prefix}source_url`] as string | null) ?? null,
      file_extension: String(row[`${prefix}file_extension`]),
      mime_type: (row[`${prefix}mime_type`] as string | null) ?? null,
      duration_ms: row[`${prefix}duration_ms`] == null ? null : Number(row[`${prefix}duration_ms`]),
      file_size_bytes:
        row[`${prefix}file_size_bytes`] == null ? null : Number(row[`${prefix}file_size_bytes`]),
      sample_rate: row[`${prefix}sample_rate`] == null ? null : Number(row[`${prefix}sample_rate`]),
      channels: row[`${prefix}channels`] == null ? null : Number(row[`${prefix}channels`]),
      loudness_hint_db:
        row[`${prefix}loudness_hint_db`] == null ? null : Number(row[`${prefix}loudness_hint_db`]),
      is_missing: Boolean(row[`${prefix}is_missing`]),
      created_at: String(row[`${prefix}created_at`]),
      updated_at: String(row[`${prefix}updated_at`]),
    };
  }

  private async nextPosition(setlistId: string, db: SQLiteDatabase): Promise<number> {
    const row = await db.getFirstAsync<{ max: string | null }>(
      'SELECT MAX(position) AS max FROM setlist_items WHERE setlist_id = ?',
      [setlistId]
    );
    return Number(row?.max ?? 0) + 1;
  }
}
