import { openDatabaseSync } from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { generateOrGetDbKey } from '../lib/encryption';
import * as schema from './schema';

const DB_FILE_NAME = 'colitis.db';

let cachedDbPromise: Promise<ExpoSQLiteDatabase<typeof schema>> | null = null;

/**
 * Opens (or returns the already-open) encrypted SQLite database wrapped in Drizzle.
 *
 * Safe to call from multiple feature modules: the underlying native connection and
 * Drizzle wrapper are created exactly once per process and cached, so repeated calls
 * return the same instance instead of re-opening/re-keying the connection (re-keying
 * an already-unlocked SQLCipher connection is undefined behavior).
 */
export function createEncryptedDb(): Promise<ExpoSQLiteDatabase<typeof schema>> {
  if (!cachedDbPromise) {
    cachedDbPromise = openEncryptedDb();
  }
  return cachedDbPromise;
}

async function openEncryptedDb(): Promise<ExpoSQLiteDatabase<typeof schema>> {
  const dbKey = await generateOrGetDbKey();
  const sqliteDb = openDatabaseSync(DB_FILE_NAME);
  await sqliteDb.execAsync(`PRAGMA key = "x'${dbKey}'";`);

  try {
    // SQLCipher does not validate the key at `PRAGMA key` time - it only validates
    // lazily on first real page read. Force that validation now so a wrong/corrupt
    // key fails clearly here instead of surfacing later as a confusing
    // "migration failed" error from useMigrations().
    await sqliteDb.getFirstAsync('SELECT count(*) FROM sqlite_master;');
  } catch (error: unknown) {
    console.error('[DB] Schlüsselvalidierung fehlgeschlagen:', error);
    throw new Error('Datenbank konnte nicht entschlüsselt werden (falscher oder beschädigter Schlüssel)');
  }

  await sqliteDb.execAsync('PRAGMA foreign_keys = ON;');

  return drizzle(sqliteDb, { schema });
}
