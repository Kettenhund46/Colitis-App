import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
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
import { DiaryReminderSettings } from '../../../src/features/diary/components/DiaryReminderSettings';
import { rescheduleDiaryReminder } from '../../../src/features/diary/scheduleDiaryReminder';
import { rescheduleAllReminders } from '../../../src/features/backup/rescheduleReminders';
import { BACKUP_FORMAT_VERSION, type BackupData, type BackupEnvelope } from '../../../src/features/backup/types';
import { useTheme } from '../../../src/theme/ThemeContext';
import { SectionHeading } from '../../../src/components/ui/SectionHeading';
import { SliderToggle } from '../../../src/components/SliderToggle';
import { SwipeableTabScreen } from '../../../src/components/SwipeableTabScreen';
import { useSwipeNavigation } from '../../../src/navigation/SwipeNavigationContext';
import {
  getDailyJokeEnabled,
  setDailyJokeEnabled,
  getIncludeIllnessJokes,
  setIncludeIllnessJokes,
  getBackupReminderEnabledRaw,
  setBackupReminderEnabled,
  getBackupReminderIntervalDays,
  setBackupReminderIntervalDays,
  getLastBackupAt,
  setLastBackupAt,
  getCommunityDisclaimerSeen,
  setCommunityDisclaimerSeen,
} from '../../../src/features/settings/settingsStorage';
import { COMMUNITY_INVITE_URL } from '../../../src/features/community/constants';
import { resolveBackupReminderEnabled } from '../../../src/features/backup/reminderScheduling';
import { rescheduleBackupReminder } from '../../../src/features/backup/scheduleBackupReminder';
import { tokens } from '../../../src/styles/tokens';
import type { ThemeId, ThemeColors } from '../../../src/theme/types';

type BackupFormMode = 'export' | 'import' | null;

const THEME_OPTIONS: { id: ThemeId; label: string }[] = [
  { id: 'light', label: 'Hell' },
  { id: 'dark', label: 'Dunkel' },
  { id: 'light-blue', label: 'Hell (Blau-Weiß)' },
];

const BACKUP_REMINDER_INTERVAL_OPTIONS = [14, 30, 60, 90] as const;

function isBackupEnvelopeShape(value: unknown): value is BackupEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    'version' in candidate &&
    typeof candidate.saltHex === 'string' &&
    typeof candidate.nonceHex === 'string' &&
    typeof candidate.ciphertextHex === 'string'
  );
}

export default function EinstellungenScreen() {
  const { themeId, colors, setThemeId } = useTheme();
  const { swipeEnabled, setSwipeEnabled } = useSwipeNavigation();
  const styles = makeStyles(colors);
  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [lockActionError, setLockActionError] = useState<string | null>(null);
  const [backupFormMode, setBackupFormMode] = useState<BackupFormMode>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [pendingImportContent, setPendingImportContent] = useState<string | null>(null);
  const [dailyJokeEnabled, setDailyJokeEnabledState] = useState(false);
  const [includeIllnessJokes, setIncludeIllnessJokesState] = useState(false);
  const [backupReminderEnabled, setBackupReminderEnabledState] = useState(false);
  const [backupReminderIntervalDays, setBackupReminderIntervalDaysState] = useState(30);
  const [lastBackupAt, setLastBackupAtState] = useState<string | null>(null);
  const [communityMessage, setCommunityMessage] = useState<string | null>(null);

  async function openCommunityLink() {
    try {
      await Linking.openURL(COMMUNITY_INVITE_URL);
      setCommunityMessage(null);
    } catch (linkError: unknown) {
      console.error('[Einstellungen] Community-Link konnte nicht geöffnet werden:', linkError);
      setCommunityMessage('Community-Link konnte nicht geöffnet werden.');
    }
  }

  async function confirmCommunityDisclaimer() {
    await setCommunityDisclaimerSeen(true);
    await openCommunityLink();
  }

  // Der Hinweis kommt nur beim ersten Mal. Wer ihn einmal bestaetigt hat,
  // landet danach direkt auf dem Server.
  async function handleCommunityPress() {
    const alreadySeen = await getCommunityDisclaimerSeen();
    if (alreadySeen) {
      await openCommunityLink();
      return;
    }
    Alert.alert(
      'Du verlässt die App',
      'Der Discord-Server ist eine externe Plattform mit eigenen Datenschutzbestimmungen. Inhalte dort werden nicht von dieser App moderiert.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Verstanden, weiter',
          onPress: () => void confirmCommunityDisclaimer(),
        },
      ]
    );
  }

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      isAppLockEnabled()
        .then((enabled) => {
          if (isActive) {
            setIsLockEnabled(enabled);
          }
        })
        .catch((error: unknown) => {
          console.error('[Einstellungen] Sperrstatus konnte nicht gelesen werden:', error);
        });
      Promise.all([getDailyJokeEnabled(), getIncludeIllnessJokes()])
        .then(([jokeEnabled, illnessJokes]) => {
          if (isActive) {
            setDailyJokeEnabledState(jokeEnabled);
            setIncludeIllnessJokesState(illnessJokes);
          }
        })
        .catch((error: unknown) => {
          console.error('[Einstellungen] Wortwitz-Einstellungen konnten nicht gelesen werden:', error);
        });
      Promise.all([getBackupReminderEnabledRaw(), getBackupReminderIntervalDays(), getLastBackupAt()])
        .then(([rawEnabled, intervalDays, lastBackup]) => {
          if (isActive) {
            setBackupReminderEnabledState(resolveBackupReminderEnabled(rawEnabled, lastBackup));
            setBackupReminderIntervalDaysState(intervalDays);
            setLastBackupAtState(lastBackup);
          }
        })
        .catch((error: unknown) => {
          console.error('[Einstellungen] Backup-Erinnerungs-Einstellungen konnten nicht gelesen werden:', error);
        });
      return () => {
        isActive = false;
        setBackupMessage(null);
      };
    }, [])
  );

  function handleToggleLock(value: boolean) {
    setLockActionError(null);
    if (value) {
      setIsSettingPin(true);
      return;
    }
    Alert.alert('App-Sperre deaktivieren?', 'Möchtest du die App-Sperre wirklich deaktivieren?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Deaktivieren',
        style: 'destructive',
        onPress: () => void confirmDisableLock(),
      },
    ]);
  }

  async function confirmDisableLock() {
    try {
      await disableAppLock();
      setIsLockEnabled(false);
    } catch (error: unknown) {
      console.error('[Einstellungen] Sperre konnte nicht deaktiviert werden:', error);
      setLockActionError('Sperre konnte nicht deaktiviert werden. Bitte erneut versuchen.');
    }
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
    try {
      await setPin(newPin);
      setIsLockEnabled(true);
      setIsSettingPin(false);
      setNewPin('');
      setConfirmPin('');
      setPinError(null);
    } catch (error: unknown) {
      console.error('[Einstellungen] PIN konnte nicht gespeichert werden:', error);
      setPinError('PIN konnte nicht gespeichert werden. Bitte erneut versuchen.');
    }
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
      const nowIso = new Date().toISOString();
      await setLastBackupAt(nowIso);
      setLastBackupAtState(nowIso);
      await rescheduleBackupReminder();
      setBackupReminderEnabledState(resolveBackupReminderEnabled(await getBackupReminderEnabledRaw(), nowIso));
      setBackupFormMode(null);
      setBackupMessage(null);
    } catch (error: unknown) {
      console.error('[Einstellungen] Backup-Export fehlgeschlagen:', error);
      setBackupMessage(error instanceof Error ? error.message : 'Backup konnte nicht erstellt werden.');
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

    let parsedEnvelope: unknown;
    try {
      parsedEnvelope = JSON.parse(pendingImportContent);
    } catch {
      setBackupMessage('Sicherungsdatei ist kein gültiges Format.');
      return;
    }
    if (!isBackupEnvelopeShape(parsedEnvelope)) {
      setBackupMessage('Sicherungsdatei ist kein gültiges Format.');
      return;
    }
    const envelope = parsedEnvelope;
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
          let db: Awaited<ReturnType<typeof createEncryptedDb>>;
          try {
            db = await createEncryptedDb();
            await importBackupData(db, data);
          } catch (error: unknown) {
            console.error('[Einstellungen] Backup-Import fehlgeschlagen:', error);
            setBackupMessage('Backup konnte nicht wiederhergestellt werden.');
            return;
          }

          setBackupFormMode(null);
          setPendingImportContent(null);

          try {
            await rescheduleAllReminders(db, data);
            await rescheduleBackupReminder();
            await rescheduleDiaryReminder();
            setBackupMessage('Backup erfolgreich wiederhergestellt.');
          } catch (error: unknown) {
            console.error('[Einstellungen] Erinnerungen konnten nicht neu geplant werden:', error);
            setBackupMessage('Daten wiederhergestellt. Erinnerungen konnten nicht neu geplant werden.');
          }
        },
      },
    ]);
  }

  async function handleToggleDailyJoke(value: boolean) {
    setDailyJokeEnabledState(value);
    try {
      await setDailyJokeEnabled(value);
    } catch (error: unknown) {
      console.error('[Einstellungen] Wortwitz-Einstellung konnte nicht gespeichert werden:', error);
    }
  }

  async function handleToggleIllnessJokes(value: boolean) {
    setIncludeIllnessJokesState(value);
    try {
      await setIncludeIllnessJokes(value);
    } catch (error: unknown) {
      console.error('[Einstellungen] Wortwitz-Einstellung konnte nicht gespeichert werden:', error);
    }
  }

  async function handleToggleBackupReminder(value: boolean) {
    setBackupReminderEnabledState(value);
    try {
      await setBackupReminderEnabled(value);
      await rescheduleBackupReminder();
    } catch (error: unknown) {
      console.error('[Einstellungen] Backup-Erinnerung konnte nicht aktualisiert werden:', error);
    }
  }

  async function handleChangeBackupReminderInterval(days: number) {
    setBackupReminderIntervalDaysState(days);
    try {
      await setBackupReminderIntervalDays(days);
      await rescheduleBackupReminder();
    } catch (error: unknown) {
      console.error('[Einstellungen] Backup-Erinnerungsintervall konnte nicht aktualisiert werden:', error);
    }
  }

  return (
    <SwipeableTabScreen tab="einstellungen" style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeading>Darstellung</SectionHeading>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`Theme ${option.label} auswählen`}
              accessibilityState={{ selected: themeId === option.id }}
              style={[styles.themeCard, themeId === option.id && styles.themeCardActive]}
              onPress={() => setThemeId(option.id)}
            >
              <Text style={[styles.themeCardText, themeId === option.id && styles.themeCardTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <SectionHeading>Navigation</SectionHeading>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Zwischen Tabs wischen</Text>
          <SliderToggle
            value={swipeEnabled}
            onValueChange={setSwipeEnabled}
            accessibilityLabel="Wischen zwischen Tabs aktivieren"
          />
        </View>

        <DiaryReminderSettings />

        <SectionHeading>App-Sperre</SectionHeading>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>PIN-/Biometrie-Sperre aktivieren</Text>
          <SliderToggle
            value={isLockEnabled}
            onValueChange={handleToggleLock}
            accessibilityLabel="PIN-/Biometrie-Sperre aktivieren"
          />
        </View>
        {lockActionError && <Text style={styles.error}>{lockActionError}</Text>}

        {isSettingPin && (
          <View style={styles.card}>
            <Text style={styles.label}>Neuer PIN ({PIN_LENGTH} Ziffern)</Text>
            <TextInput
              style={styles.textInput}
              placeholderTextColor={colors.textSecondary}
              value={newPin}
              onChangeText={(text) => setNewPin(text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={PIN_LENGTH}
            />
            <Text style={styles.label}>PIN bestätigen</Text>
            <TextInput
              style={styles.textInput}
              placeholderTextColor={colors.textSecondary}
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

        <SectionHeading>Wortwitze</SectionHeading>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Wortwitze des Tages</Text>
          <SliderToggle
            value={dailyJokeEnabled}
            onValueChange={handleToggleDailyJoke}
            accessibilityLabel="Wortwitze des Tages aktivieren"
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Auch krankheitsbedingte Witze</Text>
          <SliderToggle
            value={includeIllnessJokes}
            onValueChange={handleToggleIllnessJokes}
            accessibilityLabel="Auch krankheitsbedingte Witze anzeigen"
            disabled={!dailyJokeEnabled}
          />
        </View>

        <SectionHeading>Community</SectionHeading>
        <Text style={styles.sectionHint}>
          Der Austausch mit anderen Betroffenen läuft über einen Discord-Server — eine externe Plattform
          außerhalb dieser App.
        </Text>
        {communityMessage && <Text style={styles.backupMessage}>{communityMessage}</Text>}
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Community beitreten"
            style={styles.submitButton}
            onPress={() => void handleCommunityPress()}
          >
            <Text style={styles.submitButtonText}>Community beitreten</Text>
          </Pressable>
        </View>

        <SectionHeading>Backup</SectionHeading>
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

        <SectionHeading>Backup-Erinnerung</SectionHeading>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Erinnerung aktivieren</Text>
          <SliderToggle
            value={backupReminderEnabled}
            onValueChange={handleToggleBackupReminder}
            accessibilityLabel="Backup-Erinnerung aktivieren"
          />
        </View>
        <View style={styles.themeRow}>
          {BACKUP_REMINDER_INTERVAL_OPTIONS.map((days) => (
            <Pressable
              key={days}
              accessibilityRole="button"
              accessibilityLabel={`Erinnerung alle ${days} Tage`}
              accessibilityState={{ selected: backupReminderIntervalDays === days }}
              style={[styles.themeCard, backupReminderIntervalDays === days && styles.themeCardActive]}
              onPress={() => handleChangeBackupReminderInterval(days)}
            >
              <Text style={[styles.themeCardText, backupReminderIntervalDays === days && styles.themeCardTextActive]}>
                {days} Tage
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.backupMessage}>
          {lastBackupAt
            ? `Letztes Backup: ${new Date(lastBackupAt).toLocaleDateString('de-DE')}`
            : 'Noch kein Backup erstellt.'}
        </Text>
      </ScrollView>
    </SwipeableTabScreen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: tokens.spacing.lg,
    },
    themeRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
    },
    themeCard: {
      flex: 1,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    themeCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    themeCardText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'center',
    },
    themeCardTextActive: {
      color: colors.primary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: tokens.spacing.sm,
    },
    rowLabel: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
    },
    card: {
      padding: tokens.spacing.md,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: tokens.spacing.sm,
    },
    label: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.medium,
      marginBottom: tokens.spacing.xs,
      marginTop: tokens.spacing.sm,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: tokens.spacing.sm,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      marginBottom: tokens.spacing.sm,
    },
    error: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
    backupMessage: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
    sectionHint: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      lineHeight: 20,
      marginBottom: tokens.spacing.xs,
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
      borderColor: colors.border,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
    },
    submitButton: {
      flex: 1,
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    submitButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
