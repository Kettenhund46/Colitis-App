import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { formatGermanDate } from '../doctorVisitPassBuilder';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FAB_CLEARANCE } from '../../../components/ui/floatingActionButton';
import { SwipeableRow } from '../../../components/swipe/SwipeableRow';
import type { DoctorVisit } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface DoctorVisitListProps {
  visits: DoctorVisit[];
  onEdit: (visitId: number) => void;
  onDelete: (visitId: number) => void;
  onCreate: () => void;
  hiddenId: number | null;
}

export function DoctorVisitList({ visits, onEdit, onDelete, onCreate, hiddenId }: DoctorVisitListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  if (visits.filter((visit) => visit.id !== hiddenId).length === 0 && hiddenId === null) {
    return (
      <EmptyState
        title="Noch keine Arztbesuche erfasst"
        description="Halte fest, wann du bei wem warst und worum es ging. Vor dem nächsten Termin hast du dann alles beisammen."
        action={{ label: 'Ersten Besuch anlegen', onPress: onCreate }}
      />
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={visits.filter((visit) => visit.id !== hiddenId)}
      keyExtractor={(visit) => String(visit.id)}
      renderItem={({ item }) => (
        <SwipeableRow onDelete={() => onDelete(item.id)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Arztbesuch vom ${formatGermanDate(item.visitDate)} bearbeiten`}
            onPress={() => onEdit(item.id)}
          >
            <Card accent="neutral">
              <Text style={styles.cardDate}>{formatGermanDate(item.visitDate)}</Text>
              {item.doctorName && <Text style={styles.cardDetail}>{item.doctorName}</Text>}
              {item.reason && <Text style={styles.cardDetail}>{item.reason}</Text>}
              {item.nextAppointmentDate && (
                <Text style={styles.cardNextAppointment}>
                  Nächster Termin: {formatGermanDate(item.nextAppointmentDate)}
                </Text>
              )}
              <View style={styles.actionsRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Arztbesuch vom ${formatGermanDate(item.visitDate)} löschen`}
                  style={styles.deleteButton}
                  onPress={() => onDelete(item.id)}
                >
                  <Text style={styles.deleteButtonText}>Löschen</Text>
                </Pressable>
              </View>
            </Card>
          </Pressable>
        </SwipeableRow>
      )}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { flex: 1, backgroundColor: colors.background },
    listContent: {
      padding: tokens.spacing.lg,
      // Haelt die letzte Karte ueber dem "+"-Knopf, der sie sonst verdeckt.
      paddingBottom: FAB_CLEARANCE,
      gap: tokens.spacing.md,
    },
    cardDate: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.xs,
    },
    cardDetail: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.sm },
    cardNextAppointment: {
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
    deleteButton: {
      backgroundColor: colors.danger,
      borderRadius: 8,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    deleteButtonText: { color: colors.surface, fontSize: tokens.typography.fontSize.sm },
  });
}
