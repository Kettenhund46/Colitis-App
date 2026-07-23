import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Linking, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { seedKnowledgeArticles, listKnowledgeArticles } from '../../../src/features/knowledge/db/knowledgeRepository';
import { listFavoriteSlugs } from '../../../src/features/knowledge/db/knowledgeFavoritesRepository';
import { filterKnowledgeArticles, filterFavoriteArticles } from '../../../src/features/knowledge/search';
import { KnowledgeArticleList } from '../../../src/features/knowledge/components/KnowledgeArticleList';
import { COMMUNITY_INVITE_URL } from '../../../src/features/community/constants';
import {
  getCommunityDisclaimerSeen,
  setCommunityDisclaimerSeen,
} from '../../../src/features/settings/settingsStorage';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { KnowledgeArticle } from '../../../src/features/knowledge/types';
import type { ThemeColors } from '../../../src/theme/types';

type ViewFilter = 'all' | 'favorites';

export default function WissenScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [favoriteSlugs, setFavoriteSlugs] = useState<Set<string>>(new Set());
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
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
          const [loadedArticles, loadedFavoriteSlugs] = await Promise.all([
            listKnowledgeArticles(db),
            listFavoriteSlugs(db),
          ]);
          return { loadedArticles, loadedFavoriteSlugs };
        })
        .then(({ loadedArticles, loadedFavoriteSlugs }) => {
          if (isActive) {
            setArticles(loadedArticles);
            setFavoriteSlugs(new Set(loadedFavoriteSlugs));
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

  async function openCommunityLink() {
    try {
      await Linking.openURL(COMMUNITY_INVITE_URL);
      setError(null);
    } catch (linkError: unknown) {
      console.error('[Wissen] Community-Link konnte nicht geöffnet werden:', linkError);
      setError('Community-Link konnte nicht geöffnet werden.');
    }
  }

  async function confirmCommunityDisclaimer() {
    await setCommunityDisclaimerSeen(true);
    await openCommunityLink();
  }

  async function handleCommunityPress() {
    const alreadySeen = await getCommunityDisclaimerSeen();
    if (alreadySeen) {
      await openCommunityLink();
      return;
    }
    Alert.alert(
      'Du verlässt die App',
      'Der Discord-Server ist eine externe Plattform mit eigenen Datenschutzbestimmungen. Inhalte dort werden nicht von dieser App moderiert.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Verstanden, weiter',
          onPress: () => void confirmCommunityDisclaimer(),
        },
      ]
    );
  }

  const searchedArticles = filterKnowledgeArticles(articles, query);
  const visibleArticles =
    viewFilter === 'favorites' ? filterFavoriteArticles(searchedArticles, favoriteSlugs) : searchedArticles;

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Neuigkeiten ansehen"
        style={styles.newsLink}
        onPress={() => router.push('/wissen/feed')}
      >
        <Text style={styles.newsLinkText}>Neuigkeiten ansehen →</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Community beitreten"
        style={styles.newsLink}
        onPress={() => void handleCommunityPress()}
      >
        <Text style={styles.newsLinkText}>Community beitreten →</Text>
      </Pressable>
      <View style={styles.viewToggleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: viewFilter === 'all' }}
          style={[styles.viewToggleButton, viewFilter === 'all' && styles.viewToggleButtonActive]}
          onPress={() => setViewFilter('all')}
        >
          <Text style={[styles.viewToggleButtonText, viewFilter === 'all' && styles.viewToggleButtonTextActive]}>
            Alle
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: viewFilter === 'favorites' }}
          style={[styles.viewToggleButton, viewFilter === 'favorites' && styles.viewToggleButtonActive]}
          onPress={() => setViewFilter('favorites')}
        >
          <Text
            style={[styles.viewToggleButtonText, viewFilter === 'favorites' && styles.viewToggleButtonTextActive]}
          >
            Favoriten
          </Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.searchInput}
        placeholder="Artikel durchsuchen …"
        placeholderTextColor={colors.textSecondary}
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
          emptyMessage={viewFilter === 'favorites' ? 'Noch keine Favoriten markiert.' : undefined}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    errorBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.sm,
    },
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
    },
    newsLink: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.md,
    },
    newsLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'center',
    },
    viewToggleRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    viewToggleButton: {
      flex: 1,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    viewToggleButtonActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    viewToggleButtonText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    viewToggleButtonTextActive: {
      color: colors.primary,
    },
    searchInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      margin: tokens.spacing.md,
      padding: tokens.spacing.sm,
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
    },
  });
}
