import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildDoctorVisitPassHtml } from './doctorVisitPassBuilder';
import type { DoctorVisit } from './types';

export async function exportDoctorVisitPass(visits: DoctorVisit[]): Promise<void> {
  const html = buildDoctorVisitPassHtml(visits, new Date());
  const { uri } = await Print.printToFileAsync({ html });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
