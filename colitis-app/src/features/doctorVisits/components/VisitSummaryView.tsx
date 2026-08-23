import { ScrollView, Text, View, StyleSheet } from 'react-native';
import {
  formatMedicationIntakeLabel,
  formatPeriodLabel,
  formatPhaseLabel,
  formatRatingLabel,
  formatSparseDataLabel,
} from '../visitSummary';
import { formatGermanDate } from '../doctorVisitPassBuilder';
import { SectionHeading } from '../../../components/ui/SectionHeading';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { VisitSummary } from '../visitSummary';
import type { ThemeColors } from '../../../theme/types';

/** Deutsche Schreibweise mit Komma statt Punkt. */
function formatDecimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

interface VisitSummaryViewProps {
  summary: VisitSummary;
}

export function VisitSummaryView({ summary }: VisitSummaryViewProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { figures } = summary;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.periodText}>{formatPeriodLabel(summary.period)}</Text>

      {figures === null ? (
        <Text style={styles.sparseText}>
          {formatSparseDataLabel(summary.daysWithEntries, summary.period.dayCount)}
        </Text>
      ) : (
        <>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiNumber}>{formatDecimal(figures.stoolsPerDay)}</Text>
              <Text style={styles.kpiLabel}>Stühle pro Tag</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiNumber}>{figures.daysWithBlood}</Text>
              <Text style={styles.kpiLabel}>Tage mit Blut</Text>
            </View>
          </View>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiNumber}>{formatDecimal(figures.averagePainLevel)}</Text>
              <Text style={styles.kpiLabel}>Schmerz von 10</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiNumber}>
                {summary.daysWithEntries} von {summary.period.dayCount}
              </Text>
              <Text style={styles.kpiLabel}>Tagen erfasst</Text>
            </View>
          </View>

          <SectionHeading>Tagesbewertung</SectionHeading>
          <Text style={styles.bodyText}>{formatRatingLabel(figures)}</Text>

          <SectionHeading>Auffällige Phasen</SectionHeading>
          {summary.phases.length === 0 ? (
            <Text style={styles.bodyText}>Keine zusammenhängende auffällige Phase.</Text>
          ) : (
            summary.phases.map((phase) => (
              <Text key={phase.fromDate} style={styles.bodyText}>
                {formatPhaseLabel(phase)}
              </Text>
            ))
          )}

          {summary.triggers.length > 0 && (
            <>
              <SectionHeading>Häufigste Auslöser</SectionHeading>
              <Text style={styles.bodyText}>
                {summary.triggers.map((share) => `${share.label} (${share.percent} %)`).join(' · ')}
              </Text>
            </>
          )}
        </>
      )}

      <SectionHeading>Medikamente</SectionHeading>
      {summary.medications.length === 0 ? (
        <Text style={styles.bodyText}>Im Zeitraum war kein Medikament hinterlegt.</Text>
      ) : (
        summary.medications.map((line) => (
          <View key={line.name} style={[styles.medication, line.endDate !== null && styles.medicationEnded]}>
            <Text style={styles.medicationName}>{line.name}</Text>
            <Text style={styles.medicationDetail}>
              {line.dose} · {line.schedule} · seit {formatGermanDate(line.startDate)}
              {line.endDate === null ? '' : ` · beendet am ${formatGermanDate(line.endDate)}`}
            </Text>
            <Text style={styles.medicationDetail}>{formatMedicationIntakeLabel(line)}</Text>
          </View>
        ))
      )}

      {summary.nextScreeningDate !== null && (
        <Text style={styles.screeningText}>
          Nächste Vorsorge-Koloskopie: {formatGermanDate(summary.nextScreeningDate)}
        </Text>
      )}

      <Text style={styles.footerText}>Die Angaben stammen aus einem selbstgeführten Tagebuch.</Text>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: tokens.spacing.lg, paddingBottom: tokens.spacing.xxl },
    periodText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.md,
    },
    sparseText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      fontStyle: 'italic',
      lineHeight: 20,
    },
    kpiRow: { flexDirection: 'row', gap: tokens.spacing.sm, marginBottom: tokens.spacing.sm },
    kpi: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: tokens.radius.md,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    kpiNumber: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    kpiLabel: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.xs,
      textAlign: 'center',
    },
    bodyText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      lineHeight: 20,
      marginBottom: tokens.spacing.xs,
    },
    medication: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: tokens.spacing.sm,
    },
    medicationEnded: { opacity: 0.6 },
    medicationName: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    medicationDetail: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: 2,
    },
    screeningText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.md,
    },
    footerText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: tokens.spacing.sm,
    },
  });
}
