import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildMedicationPassHtml } from './medicationPassBuilder';
import type { ScheduleHistory } from './scheduleHistory';
import type { Medication, MedicationIntake } from './types';

export async function exportMedicationPass(
  medications: Medication[],
  intakes: MedicationIntake[],
  history: ScheduleHistory
): Promise<void> {
  const html = buildMedicationPassHtml(medications, intakes, history, new Date());
  const { uri } = await Print.printToFileAsync({ html });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
