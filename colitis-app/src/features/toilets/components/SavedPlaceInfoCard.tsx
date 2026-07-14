import { Pressable, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import type { SavedPlace } from '../types';

interface SavedPlaceInfoCardProps {
  place: SavedPlace;
  onNavigate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function SavedPlaceInfoCard({ place, onNavigate, onEdit, onDelete, onClose }: SavedPlaceInfoCardProps) {
  return (
    <View style={styles.card}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: tokens.spacing.md,
    right: tokens.spacing.md,
    bottom: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
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
    color: tokens.colors.textSecondary,
  },
  name: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
    paddingRight: tokens.spacing.lg,
  },
  detail: {
    color: tokens.colors.textSecondary,
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
    borderColor: tokens.colors.border,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.sm,
  },
  dangerButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.danger,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
  },
  navigateButton: {
    backgroundColor: tokens.colors.accent,
    borderRadius: 8,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
    marginTop: tokens.spacing.sm,
  },
  navigateButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
