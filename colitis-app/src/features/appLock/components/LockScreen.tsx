import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { verifyPin } from '../pinAuth';
import { isBiometricsAvailable, authenticateWithBiometrics } from '../biometrics';
import { PIN_LENGTH, RESET_CONFIRMATION_PHRASE, isResetConfirmationValid } from '../pinFormLogic';
import { tokens } from '../../../styles/tokens';
import { useTheme } from '../../../theme/ThemeContext';
import type { ThemeColors } from '../../../theme/types';

interface LockScreenProps {
  onUnlock: () => void;
  onReset: () => Promise<void>;
}

export function LockScreen({ onUnlock, onReset }: LockScreenProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    isBiometricsAvailable()
      .then(async (available) => {
        if (!isActive) {
          return;
        }
        setBiometricsAvailable(available);
        if (available) {
          try {
            const success = await authenticateWithBiometrics('Colitis2Go entsperren');
            if (success && isActive) {
              onUnlock();
            }
          } catch (biometricsError: unknown) {
            console.error('[AppLock] Biometrie-Prüfung fehlgeschlagen:', biometricsError);
          }
        }
      })
      .catch((availabilityError: unknown) => {
        console.error('[AppLock] Biometrie-Verfügbarkeit konnte nicht geprüft werden:', availabilityError);
        if (isActive) {
          setBiometricsAvailable(false);
        }
      });
    return () => {
      isActive = false;
    };
  }, [onUnlock]);

  async function handleBiometricsRetry() {
    try {
      const success = await authenticateWithBiometrics('Colitis2Go entsperren');
      if (success) {
        onUnlock();
      }
    } catch (biometricsError: unknown) {
      console.error('[AppLock] Biometrie-Entsperrung fehlgeschlagen:', biometricsError);
      setError('Biometrie ist gerade nicht verfügbar. Bitte PIN verwenden.');
    }
  }

  async function handlePinChange(text: string) {
    const digitsOnly = text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH);
    setPin(digitsOnly);
    setError(null);
    if (digitsOnly.length === PIN_LENGTH) {
      try {
        const isValid = await verifyPin(digitsOnly);
        if (isValid) {
          onUnlock();
        } else {
          setError('Falscher PIN. Bitte erneut versuchen.');
          setPin('');
        }
      } catch (verifyError: unknown) {
        console.error('[AppLock] PIN-Prüfung fehlgeschlagen:', verifyError);
        setError('PIN konnte nicht geprüft werden. Bitte erneut versuchen.');
        setPin('');
      }
    }
  }

  async function handleResetConfirm() {
    setIsResetting(true);
    setResetError(null);
    try {
      await onReset();
    } catch (resetErrorValue: unknown) {
      console.error('[AppLock] Zurücksetzen fehlgeschlagen:', resetErrorValue);
      setResetError('Zurücksetzen konnte nicht vollständig abgeschlossen werden. Bitte erneut versuchen.');
    } finally {
      setIsResetting(false);
    }
  }

  if (isResetMode) {
    const canConfirmReset = isResetConfirmationValid(resetConfirmation) && !isResetting;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>PIN zurücksetzen</Text>
        <Text style={styles.warning}>
          Das Zurücksetzen löscht alle App-Daten unwiderruflich. Ein vorher erstelltes Backup ist danach der
          einzige Weg, die Daten wiederzubekommen.
        </Text>
        {resetError && <Text style={styles.warning}>{resetError}</Text>}
        <Text style={styles.label}>Tippe zur Bestätigung „{RESET_CONFIRMATION_PHRASE}“ ein:</Text>
        <TextInput
          style={styles.textInput}
          placeholderTextColor={colors.textSecondary}
          value={resetConfirmation}
          onChangeText={setResetConfirmation}
          autoCapitalize="characters"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Alle Daten endgültig löschen"
          accessibilityState={{ disabled: !canConfirmReset }}
          disabled={!canConfirmReset}
          style={[styles.dangerButton, !canConfirmReset && styles.buttonDisabled]}
          onPress={handleResetConfirm}
        >
          <Text style={styles.dangerButtonText}>Endgültig löschen</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abbrechen"
          style={styles.cancelButton}
          onPress={() => {
            setIsResetMode(false);
            setResetConfirmation('');
          }}
        >
          <Text style={styles.cancelButtonText}>Abbrechen</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>App gesperrt</Text>
      <Text style={styles.label}>PIN eingeben</Text>
      <TextInput
        style={styles.pinInput}
        placeholderTextColor={colors.textSecondary}
        value={pin}
        onChangeText={handlePinChange}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
        autoFocus
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {biometricsAvailable && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mit Biometrie entsperren"
          style={styles.biometricsButton}
          onPress={handleBiometricsRetry}
        >
          <Text style={styles.biometricsButtonText}>Mit Biometrie entsperren</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="PIN vergessen"
        style={styles.forgotButton}
        onPress={() => setIsResetMode(true)}
      >
        <Text style={styles.forgotButtonText}>PIN vergessen</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.background,
    },
    title: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.xl,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.lg,
    },
    label: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      marginBottom: tokens.spacing.sm,
      textAlign: 'center',
    },
    warning: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
      marginBottom: tokens.spacing.lg,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: tokens.spacing.sm,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      marginBottom: tokens.spacing.md,
      width: '100%',
      textAlign: 'center',
    },
    pinInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: tokens.spacing.md,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      marginBottom: tokens.spacing.md,
      fontSize: tokens.typography.fontSize.xl,
      letterSpacing: 8,
      textAlign: 'center',
      width: '60%',
    },
    error: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.md,
    },
    biometricsButton: {
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.lg,
      borderRadius: 8,
      backgroundColor: colors.primary,
      marginBottom: tokens.spacing.md,
    },
    biometricsButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    forgotButton: {
      marginTop: tokens.spacing.lg,
    },
    forgotButtonText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      textDecorationLine: 'underline',
    },
    dangerButton: {
      backgroundColor: colors.danger,
      borderRadius: 8,
      paddingVertical: tokens.spacing.md,
      paddingHorizontal: tokens.spacing.lg,
      marginBottom: tokens.spacing.md,
      width: '100%',
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    dangerButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    cancelButton: {
      paddingVertical: tokens.spacing.sm,
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
    },
  });
}
