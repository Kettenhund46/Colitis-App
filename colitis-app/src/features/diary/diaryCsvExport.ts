import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildDiaryCsv } from './diaryCsvBuilder';
import type { DiaryEntryWithTriggers } from './types';

const EXPORT_DIRECTORY_NAME = 'colitis-exports';

export async function exportDiaryEntriesAsCsv(entries: DiaryEntryWithTriggers[]): Promise<void> {
  const csv = buildDiaryCsv(entries);

  const directory = new Directory(Paths.cache, EXPORT_DIRECTORY_NAME);
  directory.create({ idempotent: true });

  const fileName = `tagebuch-export-${new Date().toISOString().slice(0, 10)}.csv`;
  const file = new File(directory, fileName);
  file.create({ overwrite: true });
  file.write(csv);

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  }
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  } finally {
    file.delete();
  }
}
