import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { seedKnowledgeArticles, listKnowledgeArticles } from '../../../src/features/knowledge/db/knowledgeRepository';
import { filterKnowledgeArticles } from '../../../src/features/knowledge/search';
import { KnowledgeArticleList } from '../../../src/features/knowledge/components/KnowledgeArticleList';
import { tokens } from '../../../src/styles/tokens';
import type { KnowledgeArticle } from '../../../src/features/knowledge/types';

export default function WissenScreen() {
  const router = useRouter();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then(async (db) => {
          await seedKnowledgeArticles(db);
          return listKnowledgeArticles(db);
        })
        .then((loadedArticles) => {
          if (isActive) {
            setArticles(loadedArticles);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Wissen] Laden der Artikel fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Inhalte konnten nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  const visibleArticles = filterKnowledgeArticles(articles, query);

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <TextInput
        style={styles.searchInput}
        placeholder="Artikel durchsuchen …"
        placeholderTextColor={tokens.colors.textSecondary}
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Wissensartikel durchsuchen"
      />
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Artikel werden geladen …</Text>
        </View>
      ) : (
        <KnowledgeArticleList
          articles={visibleArticles}
          onSelect={(slug) => router.push(`/wissen/${slug}`)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    margin: tokens.spacing.md,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  loadingText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
  },
});
