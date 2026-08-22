import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { isMedicationActive } from '../medicationStatus';
import { expectedDosesPerDay, formatTakenButtonLabel } from '../adherence';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SwipeableRow } from '../../../components/swipe/SwipeableRow';
import type { Medication } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface MedicationListProps {
  medications: Medication[];
  today: Date;
  takenTodayCounts: Map<number, number>;
  onTakenToday: (medicationId: number) => void;
  onEnd: (medicationId: number) => void;
  onEdit: (medicationId: number) => void;
  onDelete: (medicationId: number) => void;
  onCreate: () => void;
  hiddenId: number | null;
}

export function MedicationList({
  medications,
  today,
  takenTodayCounts,
  onTakenToday,
  onEnd,
  onEdit,
  onDelete,
  onCreate,
  hiddenId,
}: MedicationListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  if (medications.filter((medication) => medication.id !== hiddenId).length === 0 && hiddenId === null) {
    return (
      <EmptyState
        title="Noch keine Medikamente hinterlegt"
        description="Trage ein, was du nimmst — Dosis, Zeitplan und Erinnerungszeiten. Die App meldet sich dann von selbst zur richtigen Zeit."
        action={{ label: 'Erstes Medikament anlegen', onPress: onCreate }}
      />
    );
  }

  const activeMedications = medications.filter((medication) => isMedicationActive(medication.endDate, today));
  const endedMedications = medications.filter((medication) => !isMedicationActive(medication.endDate, today));

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={[...activeMedications, ...endedMedications].filter((medication) => medication.id !== hiddenId)}
      keyExtractor={(medication) => String(medication.id)}
      renderItem={({ item }) => {
        const isActive = isMedicationActive(item.endDate, today);
        const expectedToday = expectedDosesPerDay(item);
        const takenToday = takenTodayCounts.get(item.id) ?? 0;
        const isTakenToday = takenToday >= expectedToday;
        return (
          <SwipeableRow onDelete={() => onDelete(item.id)}>
            <Card accent={isActive ? 'good' : 'neutral'} isMuted={!isActive}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardDetail}>
                {item.dose} · {item.schedule}
              </Text>
              {item.reminderTimes.length > 0 && (
                <Text style={styles.cardDetail}>
                  Erinnerungen: {item.reminderTimes.map((reminderTime) => reminderTime.time).join(', ')}
                </Text>
              )}
              {item.sideEffectsNote && (
                <Text style={styles.cardSideEffects}>Nebenwirkungen: {item.sideEffectsNote}</Text>
              )}
              {!isActive && item.endDate && <Text style={styles.cardEndedLabel}>Beendet am {item.endDate}</Text>}
              <View style={styles.actionsRow}>
                {isActive && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isTakenToday }}
                    accessibilityLabel={
                      isTakenToday
                        ? `${item.name} heute vollständig genommen`
                        : `${item.name} heute genommen, ${takenToday} von ${expectedToday}`
                    }
                    disabled={isTakenToday}
                    style={isTakenToday ? styles.takenButton : styles.notTakenButton}
                    onPress={() => onTakenToday(item.id)}
                  >
                    <Text style={isTakenToday ? styles.takenButtonText : styles.notTakenButtonText}>
                      {formatTakenButtonLabel(takenToday, expectedToday)}
                    </Text>
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
                {isActive &&
                  (item.endDate === null ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item.name} beenden`}
                      style={styles.endButton}
                      onPress={() => onEnd(item.id)}
                    >
                      <Text style={styles.endButtonText}>Beenden</Text>
                    </Pressable>
                  ) : (
                    <View
                      accessibilityRole="text"
                      accessibilityLabel={`${item.name} beendet`}
                      style={styles.endedHintBadge}
                    >
                      <Text style={styles.endedHintBadgeText}>Beendet</Text>
                    </View>
                  ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} löschen`}
                  style={styles.deleteButton}
                  onPress={() => onDelete(item.id)}
                >
                  <Text style={styles.deleteButtonText}>Löschen</Text>
                </Pressable>
              </View>
            </Card>
          </SwipeableRow>
        );
      }}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: tokens.spacing.lg, gap: tokens.spacing.md },
    cardName: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.xs,
    },
    cardDetail: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.sm },
    cardSideEffects: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.xs,
    },
    cardEndedLabel: {
      color: colors.textSecondary,
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
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    takenButtonText: { color: colors.surface, fontSize: tokens.typography.fontSize.sm },
    notTakenButton: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    notTakenButtonText: { color: colors.primary, fontSize: tokens.typography.fontSize.sm },
    editButton: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    editButtonText: { color: colors.textPrimary, fontSize: tokens.typography.fontSize.sm },
    endButton: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.danger,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    endButtonText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm },
    endedHintBadge: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.border,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    endedHintBadgeText: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.sm },
    deleteButton: {
      backgroundColor: colors.danger,
      borderRadius: 8,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    deleteButtonText: { color: colors.surface, fontSize: tokens.typography.fontSize.sm },
  });
}
