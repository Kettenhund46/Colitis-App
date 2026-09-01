import { useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { DiaryReminderSettings } from '../../diary/components/DiaryReminderSettings';
import {
  ONBOARDING_STEPS,
  isLastStep,
  nextStepIndex,
  formatStepProgress,
  formatPrimaryLabel,
} from '../steps';
import type { ThemeColors } from '../../../theme/types';

interface OnboardingViewProps {
  /** Wird beim Durchklicken wie beim Überspringen gerufen. */
  onDone: () => void;
  /** Beschriftung des Abbruch-Knopfs oben rechts. */
  skipLabel?: string;
}

export function OnboardingView({ onDone, skipLabel = 'Überspringen' }: OnboardingViewProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [stepIndex, setStepIndex] = useState(0);

  const step = ONBOARDING_STEPS[stepIndex];

  function handlePrimary() {
    if (isLastStep(stepIndex)) {
      onDone();
      return;
    }
    setStepIndex(nextStepIndex(stepIndex));
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.progress}>{formatStepProgress(stepIndex)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Einführung überspringen"
          style={styles.skipButton}
          onPress={onDone}
        >
          <Text style={styles.skipButtonText}>{skipLabel}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.title}>{step.title}</Text>
        {step.paragraphs.map((paragraph) => (
          <Text key={paragraph} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
        {step.hasReminderSettings && (
          <View style={styles.reminderBlock}>
            <DiaryReminderSettings />
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {ONBOARDING_STEPS.map((candidate, index) => (
            <View
              key={candidate.key}
              style={[styles.dot, index === stepIndex && styles.dotActive]}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={formatPrimaryLabel(stepIndex)}
          style={styles.primaryButton}
          onPress={handlePrimary}
        >
          <Text style={styles.primaryButtonText}>{formatPrimaryLabel(stepIndex)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: tokens.spacing.lg,
      paddingTop: tokens.spacing.xxl,
      paddingBottom: tokens.spacing.sm,
    },
    progress: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
    },
    skipButton: {
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.sm,
    },
    skipButtonText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    body: { flex: 1 },
    bodyContent: {
      paddingHorizontal: tokens.spacing.lg,
      paddingTop: tokens.spacing.lg,
      paddingBottom: tokens.spacing.xl,
    },
    // Die groesste Stufe der Skala, hier zum ersten Mal: Der erste Bildschirm
    // der App darf seine Ueberschrift auch wie eine aussehen lassen.
    title: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.xxl,
      fontWeight: tokens.typography.fontWeight.bold,
      lineHeight: 42,
      marginBottom: tokens.spacing.lg,
    },
    paragraph: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
      lineHeight: 24,
      marginBottom: tokens.spacing.md,
    },
    reminderBlock: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: tokens.spacing.sm,
      paddingTop: tokens.spacing.md,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: tokens.spacing.lg,
      paddingTop: tokens.spacing.md,
      paddingBottom: tokens.spacing.xl,
      gap: tokens.spacing.md,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: tokens.spacing.xs,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: { backgroundColor: colors.primary },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: tokens.radius.sm,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
