/**
 * Servicio de actualización de setlist_items.
 *
 * Nota: el repositorio de capa de datos (`src/data/`) se deja intacto según el
 * plan de etapas. Este servicio se encarga de los campos que el repositorio
 * aún no expone (título, artista, notas, pista principal y fundidos), usando
 * directamente la conexión de SQLite ya configurada.
 */

import type { SQLiteBindValue } from 'expo-sqlite';
import { getDatabase } from '@/data/db/connection';
import { nowISO } from '@/lib/helpers';
import { DatabaseError } from '@/lib/errors';
import type { IntermediateMode } from '@/data/models';

export interface UpdateSetlistItemFields {
  song_title?: string;
  artist?: string | null;
  notes?: string | null;
  main_audio_id?: string;
  intermediate_audio_id?: string | null;
  intermediate_mode?: IntermediateMode;
  fade_out_loop_ms?: number | null;
  fade_in_loop_ms?: number | null;
}

/**
 * Actualiza campos editables de un ítem de setlist. Todos los cambios se
 * persisten inmediatamente en SQLite y sobreviven el reinicio de la app.
 */
export async function updateSetlistItem(
  id: string,
  fields: UpdateSetlistItemFields
): Promise<void> {
  const db = await getDatabase();
  const now = nowISO();
  const updates: string[] = [];
  const params: SQLiteBindValue[] = [];

  const setField = (name: string, value: SQLiteBindValue | undefined) => {
    if (value !== undefined) {
      updates.push(`${name} = ?`);
      params.push(value === null ? null : value);
    }
  };

  setField('song_title', fields.song_title);
  setField('artist', fields.artist);
  setField('notes', fields.notes);
  setField('main_audio_id', fields.main_audio_id);
  setField('intermediate_audio_id', fields.intermediate_audio_id);
  setField('intermediate_mode', fields.intermediate_mode);
  setField('fade_out_loop_ms', fields.fade_out_loop_ms);
  setField('fade_in_loop_ms', fields.fade_in_loop_ms);

  if (updates.length === 0) return;

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  try {
    await db.runAsync(`UPDATE setlist_items SET ${updates.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    throw new DatabaseError(`No se pudo actualizar el ítem ${id}`, {
      original: error instanceof Error ? error.message : String(error),
    });
  }
}
