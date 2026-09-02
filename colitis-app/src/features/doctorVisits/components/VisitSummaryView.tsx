import { ScrollView, Text, View, StyleSheet } from 'react-native';
import {
  formatDecimal,
  formatMedicationDetailLabel,
  formatMedicationIntakeLabel,
  formatPeriodLabel,
  formatPhaseLabel,
  formatRatingLabel,
  formatNocturnalLabel,
  formatRecordedDaysLabel,
  formatSparseDataLabel,
  formatTriggerListLabel,
  KPI_LABEL_BLOOD,
  KPI_LABEL_PAIN,
  KPI_LABEL_RECORDED,
  KPI_LABEL_STOOLS,
  NO_MEDICATION_TEXT,
  NO_NOTABLE_PHASE_TEXT,
  NO_ACTIVITY_DATA_TEXT,
  formatActivityLabel,
  ORIGIN_NOTE_TEXT,
} from '../visitSummary';
import {
  ACTIVITY_INDEX_NAME,
  ACTIVITY_INDEX_ORIGIN_NOTE,
  NO_BASELINE_TEXT,
  formatActivityIndexValue,
  formatActivityIndexBreakdown,
} from '../../diary/activityIndex';
import { QUESTIONS_SECTION_TITLE } from '../visitQuestions';
import { formatGermanDate } from '../doctorVisitPassBuilder';
import { SectionHeading } from '../../../components/ui/SectionHeading';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { VisitSummary } from '../visitSummary';
import type { ThemeColors } from '../../../theme/types';

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

      {/* Ganz oben, vor den Zahlen: Im Sprechzimmer ist die Frage das, was
          sonst verlorengeht. */}
      {summary.openQuestions.length > 0 && (
        <>
          <SectionHeading>{QUESTIONS_SECTION_TITLE}</SectionHeading>
          {summary.openQuestions.map((question) => (
            <Text key={question.id} style={styles.bodyText}>
              • {question.text}
            </Text>
          ))}
        </>
      )}

      <SectionHeading>{ACTIVITY_INDEX_NAME}</SectionHeading>
      {summary.activity === null ? (
        <Text style={styles.bodyText}>
          {summary.isActivityBaselineMissing ? NO_BASELINE_TEXT : NO_ACTIVITY_DATA_TEXT}
        </Text>
      ) : (
        <>
          <View style={styles.activityRow}>
            <Text style={styles.activityNumber}>{formatActivityIndexValue(summary.activity.latest)}</Text>
            <Text style={styles.activityBreakdown}>
              {formatActivityIndexBreakdown(summary.activity.latest)}
            </Text>
          </View>
          <Text style={styles.bodyText}>{formatActivityLabel(summary.activity)}</Text>
          <Text style={styles.originNote}>{ACTIVITY_INDEX_ORIGIN_NOTE}</Text>
        </>
      )}

      {figures === null ? (
        <Text style={styles.sparseText}>
          {formatSparseDataLabel(summary.daysWithEntries, summary.period.dayCount)}
        </Text>
      ) : (
        <>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiNumber} numberOfLines={1} adjustsFontSizeToFit>{formatDecimal(figures.stoolsPerDay)}</Text>
              <Text style={styles.kpiLabel}>{KPI_LABEL_STOOLS}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiNumber} numberOfLines={1} adjustsFontSizeToFit>{figures.daysWithBlood}</Text>
              <Text style={styles.kpiLabel}>{KPI_LABEL_BLOOD}</Text>
            </View>
          </View>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiNumber} numberOfLines={1} adjustsFontSizeToFit>{formatDecimal(figures.averagePainLevel)}</Text>
              <Text style={styles.kpiLabel}>{KPI_LABEL_PAIN}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiNumber} numberOfLines={1} adjustsFontSizeToFit>{formatRecordedDaysLabel(summary)}</Text>
              <Text style={styles.kpiLabel}>{KPI_LABEL_RECORDED}</Text>
            </View>
          </View>

          <SectionHeading>Tagesbewertung</SectionHeading>
          <Text style={styles.bodyText}>{formatRatingLabel(figures)}</Text>
          <Text style={styles.bodyText}>{formatNocturnalLabel(figures, summary.daysWithEntries)}</Text>

          <SectionHeading>Auffällige Phasen</SectionHeading>
          {summary.phases.length === 0 ? (
            <Text style={styles.bodyText}>{NO_NOTABLE_PHASE_TEXT}</Text>
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
              <Text style={styles.bodyText}>{formatTriggerListLabel(summary.triggers)}</Text>
            </>
          )}
        </>
      )}

      <SectionHeading>Medikamente</SectionHeading>
      {summary.medications.length === 0 ? (
        <Text style={styles.bodyText}>{NO_MEDICATION_TEXT}</Text>
      ) : (
        summary.medications.map((line) => (
          <View key={line.medicationId} style={[styles.medication, line.hasEnded && styles.medicationEnded]}>
            <Text style={styles.medicationName}>{line.name}</Text>
            <Text style={styles.medicationDetail}>{formatMedicationDetailLabel(line)}</Text>
            <Text style={styles.medicationDetail}>{formatMedicationIntakeLabel(line)}</Text>
          </View>
        ))
      )}

      {summary.nextScreeningDate !== null && (
        <Text style={styles.screeningText}>
          Nächste Vorsorge-Koloskopie: {formatGermanDate(summary.nextScreeningDate)}
        </Text>
      )}

      <Text style={styles.footerText}>{ORIGIN_NOTE_TEXT}</Text>
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
    activityRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      flexWrap: 'wrap',
      gap: tokens.spacing.sm,
      marginBottom: tokens.spacing.xs,
    },
    // Die groesste Stufe der Skala: Diese Zahl ist der Grund, warum das
    // Dokument ueberhaupt aufgeschlagen wird.
    activityNumber: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.xl,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    activityBreakdown: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
    },
    originNote: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontStyle: 'italic',
      lineHeight: 18,
      marginBottom: tokens.spacing.md,
    },
    kpiRow: { flexDirection: 'row', gap: tokens.spacing.sm, marginBottom: tokens.spacing.sm },
    kpi: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: tokens.radius.md,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    // Eine Stufe ueber der Abschnittsueberschrift: Die Zahlen sind der Grund,
    // warum jemand diesen Bildschirm oeffnet.
    kpiNumber: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.xl,
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
