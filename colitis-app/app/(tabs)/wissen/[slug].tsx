import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { getKnowledgeArticleBySlug } from '../../../src/features/knowledge/db/knowledgeRepository';
import { KnowledgeArticleDetail } from '../../../src/features/knowledge/components/KnowledgeArticleDetail';
import { tokens } from '../../../src/styles/tokens';
import type { KnowledgeArticle } from '../../../src/features/knowledge/types';

export default function ArtikelScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then((db) => getKnowledgeArticleBySlug(db, slug))
        .then((loadedArticle) => {
          if (isActive) {
            setArticle(loadedArticle);
            setError(loadedArticle ? null : 'Artikel wurde nicht gefunden.');
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Wissen] Laden des Artikels fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Artikel konnte nicht geladen werden.');
          }
        });

      return () => {
        isActive = false;
      };
    }, [slug])
  );

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Artikel wird geladen …</Text>
      </View>
    );
  }

  return <KnowledgeArticleDetail article={article} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.md,
    textAlign: 'center',
  },
  loadingText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
  },
});
