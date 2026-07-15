import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View, StyleSheet } from 'react-native';
import * as Crypto from 'expo-crypto';
import { createEncryptedDb } from '../../../src/db/client';
import { isAppLockEnabled, setPin, disableAppLock } from '../../../src/features/appLock/pinAuth';
import { isValidPinFormat, PIN_LENGTH } from '../../../src/features/appLock/pinFormLogic';
import { exportBackupData, importBackupData } from '../../../src/features/backup/db/backupRepository';
import { serializeBackupData, parseBackupData } from '../../../src/features/backup/backupSerializer';
import {
  deriveKeyFromPassword,
  encryptWithKey,
  decryptWithKey,
  bytesToHex,
  hexToBytes,
  PBKDF2_SALT_LENGTH_BYTES,
  GCM_NONCE_LENGTH_BYTES,
} from '../../../src/features/backup/backupCrypto';
import { writeAndShareBackup, pickBackupFileContent } from '../../../src/features/backup/backupFileService';
import { BackupPasswordForm } from '../../../src/features/backup/components/BackupPasswordForm';
import { rescheduleAllReminders } from '../../../src/features/backup/rescheduleReminders';
import { BACKUP_FORMAT_VERSION, type BackupData, type BackupEnvelope } from '../../../src/features/backup/types';
import { tokens } from '../../../src/styles/tokens';

type BackupFormMode = 'export' | 'import' | null;

export default function EinstellungenScreen() {
  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [backupFormMode, setBackupFormMode] = useState<BackupFormMode>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [pendingImportContent, setPendingImportContent] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      isAppLockEnabled().then((enabled) => {
        if (isActive) {
          setIsLockEnabled(enabled);
        }
      });
      return () => {
        isActive = false;
      };
    }, [])
  );

  async function handleToggleLock(value: boolean) {
    if (value) {
      setIsSettingPin(true);
      return;
    }
    await disableAppLock();
    setIsLockEnabled(false);
  }

  async function handleSetPin() {
    if (!isValidPinFormat(newPin)) {
      setPinError(`Der PIN muss genau ${PIN_LENGTH} Ziffern haben.`);
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('Die beiden PINs stimmen nicht überein.');
      return;
    }
    await setPin(newPin);
    setIsLockEnabled(true);
    setIsSettingPin(false);
    setNewPin('');
    setConfirmPin('');
    setPinError(null);
  }

  async function handleExport(password: string) {
    try {
      const db = await createEncryptedDb();
      const data = await exportBackupData(db);
      const plaintext = serializeBackupData(data);
      const saltBytes = await Crypto.getRandomBytesAsync(PBKDF2_SALT_LENGTH_BYTES);
      const nonceBytes = await Crypto.getRandomBytesAsync(GCM_NONCE_LENGTH_BYTES);
      const key = deriveKeyFromPassword(password, saltBytes);
      const ciphertextBytes = encryptWithKey(new TextEncoder().encode(plaintext), key, nonceBytes);
      const envelope: BackupEnvelope = {
        version: BACKUP_FORMAT_VERSION,
        saltHex: bytesToHex(saltBytes),
        nonceHex: bytesToHex(nonceBytes),
        ciphertextHex: bytesToHex(ciphertextBytes),
      };
      await writeAndShareBackup(JSON.stringify(envelope));
      setBackupFormMode(null);
      setBackupMessage(null);
    } catch (error: unknown) {
      console.error('[Einstellungen] Backup-Export fehlgeschlagen:', error);
      setBackupMessage('Backup konnte nicht erstellt werden.');
    }
  }

  async function handlePickImportFile() {
    try {
      const content = await pickBackupFileContent();
      if (content === null) {
        return;
      }
      setPendingImportContent(content);
      setBackupFormMode('import');
      setBackupMessage(null);
    } catch (error: unknown) {
      console.error('[Einstellungen] Sicherungsdatei konnte nicht gelesen werden:', error);
      setBackupMessage('Sicherungsdatei konnte nicht gelesen werden.');
    }
  }

  async function handleImport(password: string) {
    if (!pendingImportContent) {
      return;
    }

    let envelope: BackupEnvelope;
    try {
      envelope = JSON.parse(pendingImportContent) as BackupEnvelope;
    } catch {
      setBackupMessage('Sicherungsdatei ist kein gültiges Format.');
      return;
    }
    if (envelope.version !== BACKUP_FORMAT_VERSION) {
      setBackupMessage('Sicherungsdatei hat eine unbekannte oder nicht unterstützte Version.');
      return;
    }

    let plaintextBytes: Uint8Array;
    try {
      const key = deriveKeyFromPassword(password, hexToBytes(envelope.saltHex));
      plaintextBytes = decryptWithKey(hexToBytes(envelope.ciphertextHex), key, hexToBytes(envelope.nonceHex));
    } catch (error: unknown) {
      console.error('[Einstellungen] Backup-Entschlüsselung fehlgeschlagen:', error);
      setBackupMessage('Falsches Passwort oder beschädigte Sicherungsdatei.');
      return;
    }

    let data: BackupData;
    try {
      data = parseBackupData(new TextDecoder().decode(plaintextBytes));
    } catch (error: unknown) {
      setBackupMessage(error instanceof Error ? error.message : 'Sicherungsdatei ist kein gültiges Format.');
      return;
    }

    Alert.alert('Backup wiederherstellen?', 'Alle vorhandenen Daten werden unwiderruflich ersetzt.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Wiederherstellen',
        style: 'destructive',
        onPress: async () => {
          try {
            const db = await createEncryptedDb();
            await importBackupData(db, data);
            await rescheduleAllReminders(db, data);
            setBackupFormMode(null);
            setPendingImportContent(null);
            setBackupMessage('Backup erfolgreich wiederhergestellt.');
          } catch (error: unknown) {
            console.error('[Einstellungen] Backup-Import fehlgeschlagen:', error);
            setBackupMessage('Backup konnte nicht wiederhergestellt werden.');
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>App-Sperre</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>PIN-/Biometrie-Sperre aktivieren</Text>
        <Switch value={isLockEnabled} onValueChange={handleToggleLock} />
      </View>

      {isSettingPin && (
        <View style={styles.card}>
          <Text style={styles.label}>Neuer PIN ({PIN_LENGTH} Ziffern)</Text>
          <TextInput
            style={styles.textInput}
            placeholderTextColor={tokens.colors.textSecondary}
            value={newPin}
            onChangeText={(text) => setNewPin(text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={PIN_LENGTH}
          />
          <Text style={styles.label}>PIN bestätigen</Text>
          <TextInput
            style={styles.textInput}
            placeholderTextColor={tokens.colors.textSecondary}
            value={confirmPin}
            onChangeText={(text) => setConfirmPin(text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={PIN_LENGTH}
          />
          {pinError && <Text style={styles.error}>{pinError}</Text>}
          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abbrechen"
              style={styles.cancelButton}
              onPress={() => {
                setIsSettingPin(false);
                setNewPin('');
                setConfirmPin('');
                setPinError(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="PIN speichern"
              style={styles.submitButton}
              onPress={handleSetPin}
            >
              <Text style={styles.submitButtonText}>PIN speichern</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Backup</Text>
      {backupMessage && <Text style={styles.backupMessage}>{backupMessage}</Text>}

      {backupFormMode === 'export' && (
        <BackupPasswordForm
          requireConfirmation
          submitLabel="Backup erstellen"
          onSubmit={handleExport}
          onCancel={() => setBackupFormMode(null)}
        />
      )}

      {backupFormMode === 'import' && (
        <BackupPasswordForm
          requireConfirmation={false}
          submitLabel="Wiederherstellen"
          onSubmit={handleImport}
          onCancel={() => {
            setBackupFormMode(null);
            setPendingImportContent(null);
          }}
        />
      )}

      {backupFormMode === null && (
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Backup erstellen"
            style={styles.submitButton}
            onPress={() => {
              setBackupMessage(null);
              setBackupFormMode('export');
            }}
          >
            <Text style={styles.submitButtonText}>Backup erstellen</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Backup wiederherstellen"
            style={styles.cancelButton}
            onPress={handlePickImportFile}
          >
            <Text style={styles.cancelButtonText}>Backup wiederherstellen</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    padding: tokens.spacing.lg,
  },
  sectionTitle: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    marginTop: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.sm,
  },
  rowLabel: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
  },
  card: {
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginTop: tokens.spacing.sm,
  },
  label: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.medium,
    marginBottom: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.background,
    marginBottom: tokens.spacing.sm,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.sm,
  },
  backupMessage: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
  },
  submitButton: {
    flex: 1,
    backgroundColor: tokens.colors.accent,
    borderRadius: 8,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  submitButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
