import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import type { KnowledgeArticle } from '../types';

interface KnowledgeArticleListProps {
  articles: KnowledgeArticle[];
  onSelect: (slug: string) => void;
}

function teaserFor(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > 100 ? `${trimmed.slice(0, 100)}…` : trimmed;
}

export function KnowledgeArticleList({ articles, onSelect }: KnowledgeArticleListProps) {
  if (articles.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Keine Artikel gefunden.</Text>
      </View>
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
          style={styles.card}
          onPress={() => onSelect(item.slug)}
        >
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardTeaser}>{teaserFor(item.body)}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  listContent: {
    padding: tokens.spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  emptyText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
    textAlign: 'center',
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  cardTitle: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
  },
  cardTeaser: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
  },
});
