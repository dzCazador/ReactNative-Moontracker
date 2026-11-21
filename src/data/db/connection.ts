/**
 * Gestión de la conexión a la base de datos SQLite local.
 *
 * La base se abre de forma perezosa (lazy) en el primer acceso y se migra
 * automáticamente. En web expo-sqlite no está disponible (requiere wasm y
 * sistema de archivos nativo), por lo que se lanza un error claro de inmediato
 * para que las pantallas puedan mostrar un mensaje informativo en lugar de
 * quedarse en estado de carga infinito.
 */

import { Platform } from 'react-native';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from './migrations';

const DB_NAME = 'backtracker.db';

let db: SQLiteDatabase | null = null;

const IS_WEB = Platform.OS === 'web';

/**
 * Abre la base de datos, activa claves foráneas y ejecuta migraciones pendientes.
 * Llama tantas veces como sea necesario; devuelve la misma instancia ya abierta.
 */
export async function openDatabase(): Promise<SQLiteDatabase> {
  if (db) {
    return db;
  }

  if (IS_WEB) {
    throw new Error(
      'SQLite no está disponible en el entorno web. Usa un dispositivo o emulador Android para probar la persistencia de datos.'
    );
  }

  const database = await openDatabaseAsync(DB_NAME);

  try {
    // SQLite no aplica claves foráneas por defecto; hay que activarlo por conexión.
    await database.execAsync('PRAGMA foreign_keys = ON');
    await runMigrations(database);
    db = database;
    return db;
  } catch (error) {
    try {
      await database.closeAsync();
    } catch {
      // Ignorar errores al limpiar tras una falla de apertura.
    }
    throw error;
  }
}

/**
 * Devuelve la base de datos abierta, abriéndola si es necesario.
 * Lanza si no se pudo abrir (por ejemplo, worker de SQLite aún no listo en web).
 */
export async function getDatabase(): Promise<SQLiteDatabase> {
  if (!db) {
    return openDatabase();
  }
  return db;
}

/**
 * Cierra la conexión y libera la instancia en memoria.
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

/**
 * Cierra y borra el archivo de la base de datos. Solo para pruebas de desarrollo.
 */
export async function resetDatabase(): Promise<void> {
  await closeDatabase();
  const { deleteDatabaseAsync } = await import('expo-sqlite');
  await deleteDatabaseAsync(DB_NAME);
}
