import { FlatList, Pressable, Text, StyleSheet } from 'react-native';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
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
      <EmptyState
        title="Noch keine Neuigkeiten"
        description="Sobald neue Beiträge aus den hinterlegten Quellen eintreffen, erscheinen sie hier."
      />
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
          onPress={() => onSelect(item)}
        >
          {/* Auch gelesene Karten bekommen eine Kante -- ohne sie saesse ihr
              linker Rand vier Pixel weiter links als der der ungelesenen, und
              die Liste franste aus. Den Unterschied tragen Farbe und
              Daempfung, nicht die Geometrie. */}
          <Card accent={item.isRead ? 'neutral' : 'info'} isMuted={item.isRead}>
            <Text style={[styles.cardTitle, item.isRead && styles.textRead]}>{item.title}</Text>
            <Text style={[styles.cardSummary, item.isRead && styles.textRead]}>{item.summaryDe}</Text>
            <Text style={styles.cardMeta}>
              {sourceLabelFor(item.source)} · {item.publishedDate}
            </Text>
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
