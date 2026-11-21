/**
 * Ejecutor de migraciones de SQLite.
 * Lleva un registro de versiones aplicadas en `schema_migrations` y aplica las
 * migraciones pendientes en orden dentro de una transacción.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_VERSION } from '../schema/tables';
import { INITIAL_MIGRATION } from './0001-initial-schema';
import { ADD_ARTIST_ALBUM_MIGRATION } from './0002-add-artist-album';

export type Migration = {
  version: number;
  name: string;
  up: string;
};

export const MIGRATIONS: Migration[] = [INITIAL_MIGRATION, ADD_ARTIST_ALBUM_MIGRATION];

/**
 * Crea (si no existe) la tabla de seguimiento de versiones de migraciones.
 */
export async function ensureMigrationTrackingTable(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

/**
 * Devuelve las versiones de migración ya aplicadas, ordenadas ascendentemente.
 */
export async function getAppliedVersions(db: SQLiteDatabase): Promise<number[]> {
  const rows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  );
  return rows.map((row) => row.version);
}

/**
 * Aplica las migraciones pendientes en orden de versión dentro de una transacción.
 * Devuelve las migraciones aplicadas en esta ejecución.
 */
export async function runMigrations(
  db: SQLiteDatabase,
  migrations: Migration[] = MIGRATIONS
): Promise<Migration[]> {
  await ensureMigrationTrackingTable(db);

  const applied = new Set(await getAppliedVersions(db));
  const pending = migrations
    .filter((migration) => !applied.has(migration.version))
    .sort((a, b) => a.version - b.version);

  const appliedNow: Migration[] = [];

  await db.withTransactionAsync(async () => {
    for (const migration of pending) {
      // `execAsync` ejecuta varias sentencias DDL separadas por punto y coma.
      await db.execAsync(migration.up);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        migration.version,
        new Date().toISOString()
      );
      appliedNow.push(migration);
    }
  });

  return appliedNow;
}

/**
 * Devuelve el valor de `PRAGMA user_version` (útil para diagnósticos).
 */
export async function getUserVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export { SCHEMA_VERSION };
