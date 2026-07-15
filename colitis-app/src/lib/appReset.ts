import * as SQLite from 'expo-sqlite';
import { DB_FILE_NAME, resetDbCache } from '../db/client';
import { clearDbKey } from './encryption';
import { resetAppLock } from '../features/appLock/pinAuth';

export async function resetAppData(): Promise<void> {
  await SQLite.deleteDatabaseAsync(DB_FILE_NAME);
  await clearDbKey();
  await resetAppLock();
  resetDbCache();
}
