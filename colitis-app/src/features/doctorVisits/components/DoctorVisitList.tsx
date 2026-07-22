import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { DoctorVisit } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface DoctorVisitListProps {
  visits: DoctorVisit[];
  onEdit: (visitId: number) => void;
  onDelete: (visitId: number) => void;
}

export function DoctorVisitList({ visits, onEdit, onDelete }: DoctorVisitListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  if (visits.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Noch keine Arztbesuche. Tippe auf „+“, um deinen ersten Besuch anzulegen.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={visits}
      keyExtractor={(visit) => String(visit.id)}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Arztbesuch vom ${item.visitDate} bearbeiten`}
          style={styles.card}
          onPress={() => onEdit(item.id)}
        >
          <Text style={styles.cardDate}>{item.visitDate}</Text>
          {item.doctorName && <Text style={styles.cardDetail}>{item.doctorName}</Text>}
          {item.reason && <Text style={styles.cardDetail}>{item.reason}</Text>}
          {item.nextAppointmentDate && (
            <Text style={styles.cardNextAppointment}>Nächster Termin: {item.nextAppointmentDate}</Text>
          )}
          <View style={styles.actionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Arztbesuch vom ${item.visitDate} löschen`}
              style={styles.deleteButton}
              onPress={() => onDelete(item.id)}
            >
              <Text style={styles.deleteButtonText}>Löschen</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: tokens.spacing.lg },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.background,
    },
    emptyText: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.md, textAlign: 'center' },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: tokens.spacing.md,
      marginBottom: tokens.spacing.md,
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
