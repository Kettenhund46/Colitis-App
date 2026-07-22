import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { getKnowledgeArticleBySlug } from '../../../src/features/knowledge/db/knowledgeRepository';
import { listFavoriteSlugs, addFavorite, removeFavorite } from '../../../src/features/knowledge/db/knowledgeFavoritesRepository';
import { KnowledgeArticleDetail } from '../../../src/features/knowledge/components/KnowledgeArticleDetail';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { KnowledgeArticle } from '../../../src/features/knowledge/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function ArtikelScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then(async (db) => {
          const [loadedArticle, favoriteSlugs] = await Promise.all([
            getKnowledgeArticleBySlug(db, slug),
            listFavoriteSlugs(db),
          ]);
          return { loadedArticle, favoriteSlugs };
        })
        .then(({ loadedArticle, favoriteSlugs }) => {
          if (isActive) {
            setArticle(loadedArticle);
            setIsFavorite(favoriteSlugs.includes(slug));
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

  async function handleToggleFavorite() {
    const db = await createEncryptedDb();
    if (isFavorite) {
      await removeFavorite(db, slug);
      setIsFavorite(false);
    } else {
      await addFavorite(db, slug);
      setIsFavorite(true);
    }
  }

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

  return <KnowledgeArticleDetail article={article} isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite} />;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.background,
    },
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.md,
      textAlign: 'center',
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
    },
  });
}
