import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { sourceLabelFor } from '../sourceLabel';
import type { FeedItem } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface NewsFeedListProps {
  items: FeedItem[];
  onSelect: (item: FeedItem) => void;
}

export function NewsFeedList({ items, onSelect }: NewsFeedListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Noch keine Neuigkeiten vorhanden.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Neuigkeit: ${item.title}${item.isRead ? ' (bereits gelesen)' : ''}`}
          style={[styles.card, item.isRead && styles.cardRead]}
          onPress={() => onSelect(item)}
        >
          <Text style={[styles.cardTitle, item.isRead && styles.textRead]}>{item.title}</Text>
          <Text style={[styles.cardSummary, item.isRead && styles.textRead]}>{item.summaryDe}</Text>
          <Text style={styles.cardMeta}>
            {sourceLabelFor(item.source)} · {item.publishedDate}
          </Text>
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
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.background,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: tokens.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: tokens.spacing.md,
      marginBottom: tokens.spacing.md,
    },
    cardRead: {
      opacity: 0.6,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.xs,
    },
    cardSummary: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.xs,
    },
    textRead: {
      color: colors.textSecondary,
    },
    cardMeta: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
    },
  });
}
