import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { Card } from '../../../components/ui/Card';
import type { Toilet } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface ToiletInfoCardProps {
  toilet: Toilet;
  distanceMeters: number;
  onNavigate: () => void;
  onClose: () => void;
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m entfernt`;
  }
  return `${(distanceMeters / 1000).toFixed(1)} km entfernt`;
}

export function ToiletInfoCard({ toilet, distanceMeters, onNavigate, onClose }: ToiletInfoCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <Card style={styles.cardPosition}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Infokarte schließen"
        style={styles.closeButton}
        onPress={onClose}
      >
        <Text style={styles.closeButtonText}>×</Text>
      </Pressable>
      <Text style={styles.name}>{toilet.name ?? 'Öffentliche Toilette'}</Text>
      <Text style={styles.detail}>{formatDistance(distanceMeters)}</Text>
      {toilet.openingHours && <Text style={styles.detail}>Öffnungszeiten: {toilet.openingHours}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Route dorthin"
        style={styles.navigateButton}
        onPress={onNavigate}
      >
        <Text style={styles.navigateButtonText}>Route dorthin</Text>
      </Pressable>
    </Card>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    cardPosition: {
      position: 'absolute',
      left: tokens.spacing.md,
      right: tokens.spacing.md,
      bottom: tokens.spacing.md,
    },
    closeButton: {
      position: 'absolute',
      right: tokens.spacing.sm,
      top: tokens.spacing.sm,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButtonText: {
      fontSize: tokens.typography.fontSize.lg,
      color: colors.textSecondary,
    },
    name: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.xs,
      paddingRight: tokens.spacing.lg,
    },
    detail: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.xs,
    },
    navigateButton: {
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingVertical: tokens.spacing.sm,
      alignItems: 'center',
      marginTop: tokens.spacing.sm,
    },
    navigateButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
