import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildVisitSummaryHtml } from './visitSummaryPdfBuilder';
import type { VisitSummary } from './visitSummary';

export async function exportVisitSummary(summary: VisitSummary): Promise<void> {
  const html = buildVisitSummaryHtml(summary, new Date());
  const { uri } = await Print.printToFileAsync({ html });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
