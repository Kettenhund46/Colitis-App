import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const BACKUP_DIRECTORY_NAME = 'colitis-backups';

export async function writeAndShareBackup(envelopeJson: string): Promise<void> {
  const directory = new Directory(Paths.cache, BACKUP_DIRECTORY_NAME);
  directory.create({ idempotent: true });

  const fileName = `colitis-backup-${new Date().toISOString().slice(0, 10)}.colitisbackup`;
  const file = new File(directory, fileName);
  file.create({ overwrite: true });
  file.write(envelopeJson);

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  }
  await Sharing.shareAsync(file.uri);
}

export async function pickBackupFileContent(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled) {
    return null;
  }
  const file = new File(result.assets[0].uri);
  return file.text();
}
