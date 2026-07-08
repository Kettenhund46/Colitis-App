import { openDatabaseSync } from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { generateOrGetDbKey } from '../lib/encryption';
import * as schema from './schema';

const DB_FILE_NAME = 'colitis.db';

export async function createEncryptedDb(): Promise<ExpoSQLiteDatabase<typeof schema>> {
  const dbKey = await generateOrGetDbKey();
  const sqliteDb = openDatabaseSync(DB_FILE_NAME);
  await sqliteDb.execAsync(`PRAGMA key = "x'${dbKey}'";`);
  return drizzle(sqliteDb, { schema });
}
