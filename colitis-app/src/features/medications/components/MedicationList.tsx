import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { isMedicationActive, formatLocalDate } from '../medicationStatus';
import { expectedDosesPerDay, formatTakenButtonLabel, isMedicationDueOn } from '../adherence';
import { formatSupplyLabel, formatRefillLabel, isSupplyLow } from '../supply';
import { pausedSince, segmentsFor } from '../scheduleHistory';
import { formatMedicationStartDate } from '../medicationPassBuilder';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SkeletonList } from '../../../components/ui/SkeletonList';
import { FAB_CLEARANCE } from '../../../components/ui/floatingActionButton';
import { SwipeableRow } from '../../../components/swipe/SwipeableRow';
import type { ReactElement } from 'react';
import type { ScheduleHistory } from '../scheduleHistory';
import type { Medication } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface MedicationListProps {
  medications: Medication[];
  today: Date;
  takenTodayCounts: Map<number, number>;
  onTakenToday: (medicationId: number) => void;
  onEnd: (medicationId: number) => void;
  /** Setzt aus: keine Erinnerungen, keine Versaeumnisse, kein Verbrauch. */
  onPause: (medicationId: number) => void;
  onResume: (medicationId: number) => void;
  /** Zeitplan-Abschnitte je Medikament -- daraus kommt der Pausen-Zustand. */
  history: ScheduleHistory;
  onEdit: (medicationId: number) => void;
  onDelete: (medicationId: number) => void;
  /** Legt eine Packung nach. */
  onRefill: (medicationId: number) => void;
  /** Ab wie vielen Tagen Restreichweite der Vorrat als knapp gilt. */
  prescriptionLeadDays: number;
  onCreate: () => void;
  hiddenId: number | null;
  /**
   * Was unterhalb der Karten steht und mitscrollen soll -- der Vorsorge-Block.
   * Er steht bewusst unter der Liste: Der Tab heisst Medikamente, und sein
   * aufgeklapptes Formular fuellt den halben Schirm. Darueber gesetzt haette
   * es den Leerzustand samt "Erstes Medikament anlegen" unter den Rand
   * geschoben, solange noch nichts hinterlegt ist.
   */
  footer?: ReactElement | null;
  isLoading?: boolean;
}

export function MedicationList({
  medications,
  today,
  takenTodayCounts,
  onTakenToday,
  onEnd,
  onPause,
  onResume,
  history,
  onEdit,
  onDelete,
  onRefill,
  prescriptionLeadDays,
  onCreate,
  hiddenId,
  footer = null,
  isLoading = false,
}: MedicationListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const activeMedications = medications.filter((medication) => isMedicationActive(medication.endDate, today));
  const endedMedications = medications.filter((medication) => !isMedicationActive(medication.endDate, today));
  const visibleMedications = isLoading
    ? []
    : [...activeMedications, ...endedMedications].filter((medication) => medication.id !== hiddenId);

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={visibleMedications}
      keyExtractor={(medication) => String(medication.id)}
      ListFooterComponent={footer}
      // Der Vorsorge-Block bleibt auch ohne Karten stehen: Sonst waere er ohne
      // ein einziges Medikament nicht mehr erreichbar. Waehrend des
      // Rueckgaengig-Fensters bleibt der Leerzustand aus -- er widerspraeche
      // dem Streifen, der die Zeile gerade noch zurueckholen kann.
      ListEmptyComponent={
        isLoading ? (
          <SkeletonList count={3} lines={2} />
        ) : hiddenId === null ? (
          <EmptyState
            title="Noch keine Medikamente hinterlegt"
            description="Trage ein, was du nimmst — Dosis, Zeitplan und Erinnerungszeiten. Die App meldet sich dann von selbst zur richtigen Zeit."
            action={{ label: 'Erstes Medikament anlegen', onPress: onCreate }}
          />
        ) : null
      }
      renderItem={({ item }) => {
        const isActive = isMedicationActive(item.endDate, today);
        const pausedFrom = pausedSince(segmentsFor(history, item.id), formatLocalDate(today));
        const isPaused = pausedFrom !== null;
        const isDueToday = isMedicationDueOn(item, formatLocalDate(today)) && !isPaused;
        const expectedToday = expectedDosesPerDay(item);
        const takenToday = takenTodayCounts.get(item.id) ?? 0;
        const isTakenToday = takenToday >= expectedToday;
        // Waehrend einer Pause wird nichts verbraucht -- eine Reichweite in
        // Tagen waere dort schlicht falsch.
        const supplyLabel = isPaused ? null : formatSupplyLabel(item);
        const isLow = isSupplyLow(item, prescriptionLeadDays);
        const refillLabel = formatRefillLabel(item);
        return (
          <View style={styles.rowWrapper}>
            <SwipeableRow onDelete={() => onDelete(item.id)}>
              <Card accent={!isActive || isPaused ? 'neutral' : 'good'} isMuted={!isActive}>
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
              {supplyLabel !== null && (
                <Text style={isLow ? styles.cardSupplyLow : styles.cardDetail}>{supplyLabel}</Text>
              )}
              {pausedFrom !== null && (
                <Text style={styles.cardPausedLabel}>
                  Pausiert seit {formatMedicationStartDate(pausedFrom)}
                </Text>
              )}
              {!isActive && item.endDate && <Text style={styles.cardEndedLabel}>Beendet am {item.endDate}</Text>}
              <View style={styles.actionsRow}>
                {isDueToday && (
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
                {/* Waehrend der Pause steht Fortsetzen an erster Stelle: Es ist die
                    einzige Handlung, die den Zustand aufhebt. */}
                {isActive && isPaused && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} fortsetzen`}
                    style={styles.resumeButton}
                    onPress={() => onResume(item.id)}
                  >
                    <Text style={styles.resumeButtonText}>Fortsetzen</Text>
                  </Pressable>
                )}
                {refillLabel !== null && supplyLabel !== null && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Packung ${item.name} nachlegen`}
                    style={styles.refillButton}
                    onPress={() => onRefill(item.id)}
                  >
                    <Text style={styles.refillButtonText}>{refillLabel}</Text>
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
                {isActive && !isPaused && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} pausieren`}
                    style={styles.pauseButton}
                    onPress={() => onPause(item.id)}
                  >
                    <Text style={styles.pauseButtonText}>Pausieren</Text>
                  </Pressable>
                )}
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
          </View>
        );
      }}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { flex: 1, backgroundColor: colors.background },
    listContent: {
      // Kein seitlicher Rand am Inhaltsbehaelter: Der Kopfbereich bringt seine
      // eigenen Abstaende mit -- die Vorsorge-Karte einen Rand, die beiden
      // Links gehen bewusst ueber die volle Breite. Die Karten bekommen ihren
      // Rand deshalb einzeln.
      paddingTop: tokens.spacing.md,
      // Haelt die letzte Karte ueber dem "+"-Knopf, der sie sonst verdeckt.
      paddingBottom: FAB_CLEARANCE,
      gap: tokens.spacing.md,
      flexGrow: 1,
    },
    rowWrapper: { paddingHorizontal: tokens.spacing.lg },
    cardName: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.xs,
    },
    cardDetail: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.sm },
    // Knapper Vorrat in Warnfarbe: Der Nutzer muss etwas tun, aber nichts ist
    // schiefgegangen -- deshalb kein Rot.
    cardSupplyLow: {
      color: colors.warning,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    refillButton: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    refillButtonText: { color: colors.primary, fontSize: tokens.typography.fontSize.sm },
    cardSideEffects: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.xs,
    },
    // Kein Warnton: Eine Pause ist eine Entscheidung, kein Fehlzustand.
    cardPausedLabel: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontStyle: 'italic',
      marginTop: tokens.spacing.xs,
    },
    pauseButton: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    pauseButtonText: { color: colors.textPrimary, fontSize: tokens.typography.fontSize.sm },
    // Waehrend der Pause ist Fortsetzen die eine Handlung, die zaehlt. Sie
    // traegt dieselbe gefuellte Form wie "Heute genommen" und steht damit
    // sichtbar vor den uebrigen Knoepfen der Karte.
    resumeButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    resumeButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
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
