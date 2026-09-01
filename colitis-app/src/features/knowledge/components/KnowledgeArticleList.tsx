import { FlatList, Pressable, Text, StyleSheet } from 'react-native';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { KnowledgeArticle } from '../types';
import type { ThemeColors } from '../../../theme/types';

/**
 * Warum die Liste leer ist. 'none' heisst: gar keine Artikel hinterlegt --
 * dann waere ein Hinweis auf einen anderen Suchbegriff sinnlos, weil keiner
 * eingegeben wurde.
 */
export type KnowledgeEmptyVariant = 'search' | 'favorites' | 'none';

interface KnowledgeArticleListProps {
  articles: KnowledgeArticle[];
  onSelect: (slug: string) => void;
  emptyVariant?: KnowledgeEmptyVariant;
}

function teaserFor(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > 100 ? `${trimmed.slice(0, 100)}…` : trimmed;
}

export function KnowledgeArticleList({ articles, onSelect, emptyVariant = 'search' }: KnowledgeArticleListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  if (articles.length === 0) {
    if (emptyVariant === 'favorites') {
      return (
        <EmptyState
          title="Noch keine Favoriten"
          description="Markiere einen Artikel als Favorit, dann findest du ihn hier ohne Suchen wieder."
        />
      );
    }
    if (emptyVariant === 'none') {
      return (
        <EmptyState
          title="Keine Artikel vorhanden"
          description="Die Wissensartikel werden beim Öffnen dieses Tabs angelegt. Falls hier nichts erscheint, hilft ein Neustart der App."
          showGhost={false}
        />
      );
    }
    return (
      <EmptyState
        title="Keine Artikel gefunden"
        description="Versuch es mit einem anderen Suchbegriff."
        showGhost={false}
      />
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={articles}
      keyExtractor={(article) => article.slug}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Artikel: ${item.title}`}
          onPress={() => onSelect(item.slug)}
        >
          <Card>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardTeaser}>{teaserFor(item.body)}</Text>
          </Card>
        </Pressable>
      )}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      padding: tokens.spacing.lg,
      gap: tokens.spacing.md,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.xs,
    },
    cardTeaser: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
    },
  });
}
