import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../../src/db/client';
import {
  createVisitQuestion,
  listVisitQuestions,
  setVisitQuestionAnswered,
  deleteVisitQuestion,
} from '../../../../src/features/doctorVisits/db/visitQuestionsRepository';
import {
  sortForList,
  openQuestions,
  isOpen,
  isValidQuestionText,
  formatOpenCountLabel,
  MAX_QUESTION_LENGTH,
  QUESTIONS_HINT,
  EMPTY_QUESTIONS_TITLE,
  EMPTY_QUESTIONS_DESCRIPTION,
} from '../../../../src/features/doctorVisits/visitQuestions';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { Card } from '../../../../src/components/ui/Card';
import { SkeletonList } from '../../../../src/components/ui/SkeletonList';
import { SwipeableRow } from '../../../../src/components/swipe/SwipeableRow';
import { UndoBar } from '../../../../src/components/ui/UndoBar';
import { usePendingDeletion } from '../../../../src/features/deletion/usePendingDeletion';
import { saveFeedback } from '../../../../src/lib/haptics';
import { useTheme } from '../../../../src/theme/ThemeContext';
import { tokens } from '../../../../src/styles/tokens';
import type { VisitQuestion } from '../../../../src/features/doctorVisits/types';
import type { ThemeColors } from '../../../../src/theme/types';

export default function FragenScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [questions, setQuestions] = useState<VisitQuestion[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then((db) => listVisitQuestions(db))
        .then((loaded) => {
          if (isActive) {
            setQuestions(loaded);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Arztbesuche] Fragen konnten nicht geladen werden:', loadError);
          if (isActive) {
            setError('Fragen konnten nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  const { pending, requestDelete, undo } = usePendingDeletion<number>(async (questionId) => {
    try {
      const db = await createEncryptedDb();
      await deleteVisitQuestion(db, questionId);
      setQuestions(await listVisitQuestions(db));
      setError(null);
    } catch (deleteError: unknown) {
      console.error('[Arztbesuche] Frage löschen fehlgeschlagen:', deleteError);
      setError('Frage konnte nicht gelöscht werden.');
    }
  });

  async function handleAdd() {
    if (!isValidQuestionText(draft)) {
      setError(`Bitte eine Frage eingeben, höchstens ${MAX_QUESTION_LENGTH} Zeichen.`);
      return;
    }
    try {
      const db = await createEncryptedDb();
      await createVisitQuestion(db, draft.trim(), new Date().toISOString());
      setQuestions(await listVisitQuestions(db));
      setDraft('');
      setError(null);
      saveFeedback();
    } catch (addError: unknown) {
      console.error('[Arztbesuche] Frage speichern fehlgeschlagen:', addError);
      setError('Frage konnte nicht gespeichert werden.');
    }
  }

  async function handleToggle(question: VisitQuestion) {
    try {
      const db = await createEncryptedDb();
      // Abhaken und wieder oeffnen ist derselbe Griff -- wer versehentlich
      // abhakt, soll die Frage nicht neu tippen muessen.
      await setVisitQuestionAnswered(db, question.id, isOpen(question) ? new Date().toISOString() : null);
      setQuestions(await listVisitQuestions(db));
      setError(null);
      saveFeedback();
    } catch (toggleError: unknown) {
      console.error('[Arztbesuche] Frage konnte nicht geändert werden:', toggleError);
      setError('Frage konnte nicht geändert werden.');
    }
  }

  const visible = sortForList(questions).filter(
    (question) => pending === null || question.id !== pending.id
  );
  const openCount = openQuestions(questions).filter(
    (question) => pending === null || question.id !== pending.id
  ).length;

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.composer}>
        <Text style={styles.hint}>{QUESTIONS_HINT}</Text>
        <TextInput
          style={styles.input}
          placeholder="z. B. Kann ich die Dosis im Sommer senken?"
          placeholderTextColor={colors.textSecondary}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={MAX_QUESTION_LENGTH}
          accessibilityLabel="Neue Frage für den Arzttermin"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Frage notieren"
          accessibilityState={{ disabled: !isValidQuestionText(draft) }}
          disabled={!isValidQuestionText(draft)}
          style={[styles.addButton, !isValidQuestionText(draft) && styles.addButtonDisabled]}
          onPress={() => void handleAdd()}
        >
          <Text style={styles.addButtonText}>Frage notieren</Text>
        </Pressable>
      </View>

      <Text style={styles.countText}>{formatOpenCountLabel(openCount)}</Text>

      {isLoading ? (
        <SkeletonList count={3} lines={1} />
      ) : visible.length === 0 && pending === null ? (
        <EmptyState title={EMPTY_QUESTIONS_TITLE} description={EMPTY_QUESTIONS_DESCRIPTION} />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={visible}
          keyExtractor={(question) => String(question.id)}
          renderItem={({ item }) => (
            <SwipeableRow onDelete={() => requestDelete({ id: item.id, label: 'Frage' })}>
              <Card accent={isOpen(item) ? 'info' : 'neutral'} isMuted={!isOpen(item)}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !isOpen(item) }}
                  accessibilityLabel={`${item.text}, ${isOpen(item) ? 'offen' : 'besprochen'}`}
                  onPress={() => void handleToggle(item)}
                >
                  <Text style={[styles.questionText, !isOpen(item) && styles.questionTextAnswered]}>
                    {item.text}
                  </Text>
                  <Text style={styles.statusText}>
                    {isOpen(item) ? 'Tippen, wenn besprochen' : 'Besprochen — tippen, um wieder zu öffnen'}
                  </Text>
                </Pressable>
              </Card>
            </SwipeableRow>
          )}
        />
      )}

      {pending !== null && (
        <UndoBar label={`${pending.label} gelöscht`} onUndo={undo} avoidsFloatingButton={false} />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    errorBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.sm,
    },
    errorText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm, textAlign: 'center' },
    composer: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.lg,
    },
    hint: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: tokens.radius.sm,
      padding: tokens.spacing.sm,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      minHeight: 64,
      textAlignVertical: 'top',
      marginBottom: tokens.spacing.sm,
    },
    addButton: {
      backgroundColor: colors.accent,
      borderRadius: tokens.radius.sm,
      paddingVertical: tokens.spacing.sm,
      alignItems: 'center',
    },
    addButtonDisabled: { backgroundColor: colors.border },
    addButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    countText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      paddingHorizontal: tokens.spacing.lg,
      paddingTop: tokens.spacing.md,
    },
    list: { flex: 1 },
    listContent: { padding: tokens.spacing.lg, gap: tokens.spacing.md },
    questionText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      lineHeight: 22,
    },
    questionTextAnswered: { textDecorationLine: 'line-through' },
    statusText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.xs,
    },
  });
}
