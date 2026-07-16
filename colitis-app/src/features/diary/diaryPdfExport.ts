import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildDiaryPdfHtml } from './diaryPdfBuilder';
import type { DiaryEntryWithTriggers } from './types';

export async function exportDiaryEntriesAsPdf(entries: DiaryEntryWithTriggers[]): Promise<void> {
  const html = buildDiaryPdfHtml(entries);
  const { uri } = await Print.printToFileAsync({ html });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
