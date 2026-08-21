import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { Card } from '../../../components/ui/Card';
import type { SavedPlace } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface SavedPlaceInfoCardProps {
  place: SavedPlace;
  onNavigate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function SavedPlaceInfoCard({ place, onNavigate, onEdit, onDelete, onClose }: SavedPlaceInfoCardProps) {
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
      <Text style={styles.name}>{place.name}</Text>
      {place.category.length > 0 && <Text style={styles.detail}>{place.category}</Text>}
      {place.note && <Text style={styles.detail}>{place.note}</Text>}
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bearbeiten"
          style={styles.secondaryButton}
          onPress={onEdit}
        >
          <Text style={styles.secondaryButtonText}>Bearbeiten</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Löschen" style={styles.dangerButton} onPress={onDelete}>
          <Text style={styles.dangerButtonText}>Löschen</Text>
        </Pressable>
      </View>
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
    actionRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
      marginTop: tokens.spacing.sm,
    },
    secondaryButton: {
      flex: 1,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: tokens.spacing.sm,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
    },
    dangerButton: {
      flex: 1,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.danger,
      paddingVertical: tokens.spacing.sm,
      alignItems: 'center',
    },
    dangerButtonText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
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
