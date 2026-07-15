import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import { isMedicationActive } from '../medicationStatus';
import type { Medication } from '../types';

interface MedicationListProps {
  medications: Medication[];
  today: Date;
  onTakenToday: (medicationId: number) => void;
  onEnd: (medicationId: number) => void;
  onEdit: (medicationId: number) => void;
}

export function MedicationList({ medications, today, onTakenToday, onEnd, onEdit }: MedicationListProps) {
  if (medications.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Noch keine Medikamente. Tippe auf „+“, um dein erstes Medikament anzulegen.
        </Text>
      </View>
    );
  }

  const activeMedications = medications.filter((medication) => isMedicationActive(medication.endDate, today));
  const endedMedications = medications.filter((medication) => !isMedicationActive(medication.endDate, today));

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={[...activeMedications, ...endedMedications]}
      keyExtractor={(medication) => String(medication.id)}
      renderItem={({ item }) => {
        const isActive = isMedicationActive(item.endDate, today);
        return (
          <View style={[styles.card, !isActive && styles.cardEnded]}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardDetail}>
              {item.dose} · {item.schedule}
            </Text>
            {item.reminderTimes.length > 0 && (
              <Text style={styles.cardDetail}>
                Erinnerungen: {item.reminderTimes.map((reminderTime) => reminderTime.time).join(', ')}
              </Text>
            )}
            {!isActive && item.endDate && <Text style={styles.cardEndedLabel}>Beendet am {item.endDate}</Text>}
            <View style={styles.actionsRow}>
              {isActive && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} heute genommen`}
                  style={styles.takenButton}
                  onPress={() => onTakenToday(item.id)}
                >
                  <Text style={styles.takenButtonText}>Heute genommen</Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name} bearbeiten`}
                style={styles.editButton}
                onPress={() => onEdit(item.id)}
              >
                <Text style={styles.editButtonText}>Bearbeiten</Text>
              </Pressable>
              {isActive && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} beenden`}
                  style={styles.endButton}
                  onPress={() => onEnd(item.id)}
                >
                  <Text style={styles.endButtonText}>Beenden</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: tokens.colors.background },
  listContent: { padding: tokens.spacing.lg },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  emptyText: { color: tokens.colors.textSecondary, fontSize: tokens.typography.fontSize.md, textAlign: 'center' },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  cardEnded: { opacity: 0.6 },
  cardName: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
  },
  cardDetail: { color: tokens.colors.textSecondary, fontSize: tokens.typography.fontSize.sm },
  cardEndedLabel: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
    fontStyle: 'italic',
    marginTop: tokens.spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  takenButton: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 8,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
  },
  takenButtonText: { color: tokens.colors.surface, fontSize: tokens.typography.fontSize.sm },
  editButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
  },
  editButtonText: { color: tokens.colors.textPrimary, fontSize: tokens.typography.fontSize.sm },
  endButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.danger,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
  },
  endButtonText: { color: tokens.colors.danger, fontSize: tokens.typography.fontSize.sm },
});
