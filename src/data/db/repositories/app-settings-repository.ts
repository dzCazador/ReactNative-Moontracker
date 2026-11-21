/**
 * Repositorio de app_settings: almacén clave-valor con valor JSON.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../connection';
import type { AppSetting } from '../../models/app-setting';
import { nowISO } from '@/lib/helpers';
import { DatabaseError } from '@/lib/errors';

export class AppSettingsRepository {
  constructor(private readonly db?: SQLiteDatabase) {}

  private async resolveDb(): Promise<SQLiteDatabase> {
    return this.db ?? (await getDatabase());
  }

  private mapRow(row: Record<string, unknown>): AppSetting {
    return {
      key: String(row.key),
      value_json: String(row.value_json),
      updated_at: String(row.updated_at),
    };
  }

  async getSetting<T = unknown>(key: string): Promise<T | null> {
    const db = await this.resolveDb();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT value_json FROM app_settings WHERE key = ?',
      [key]
    );
    if (!row) return null;
    try {
      return JSON.parse(String(row.value_json)) as T;
    } catch (error) {
      throw new DatabaseError(`No se pudo parsear el ajuste "${key}"`, { original: String(error) });
    }
  }

  async setSetting<T = unknown>(key: string, value: T): Promise<void> {
    const db = await this.resolveDb();
    const now = nowISO();
    const valueJson = JSON.stringify(value);

    try {
      await db.runAsync(
        `INSERT INTO app_settings (key, value_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
        [key, valueJson, now]
      );
    } catch (error) {
      throw new DatabaseError(`No se pudo guardar el ajuste "${key}"`, { original: String(error) });
    }
  }

  async list(): Promise<AppSetting[]> {
    const db = await this.resolveDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      'SELECT key, value_json, updated_at FROM app_settings ORDER BY key ASC',
      []
    );
    return rows.map((row) => this.mapRow(row));
  }
}
