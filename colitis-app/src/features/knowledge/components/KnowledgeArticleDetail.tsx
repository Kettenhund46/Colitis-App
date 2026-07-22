import { Linking, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { KnowledgeArticle } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface KnowledgeArticleDetailProps {
  article: KnowledgeArticle;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export function KnowledgeArticleDetail({ article, isFavorite, onToggleFavorite }: KnowledgeArticleDetailProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const paragraphs = article.body.split('\n\n');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
        accessibilityState={{ selected: isFavorite }}
        style={styles.favoriteButton}
        onPress={onToggleFavorite}
      >
        <Text style={styles.favoriteButtonText}>{isFavorite ? '★ Favorit' : '☆ Favorit'}</Text>
      </Pressable>
      <Text style={styles.title}>{article.title}</Text>
      {paragraphs.map((paragraph, index) => (
        <Text key={index} style={styles.paragraph}>
          {paragraph}
        </Text>
      ))}
      <View style={styles.sourcesSection}>
        <Text style={styles.sourcesHeading}>Quellen</Text>
        {article.sources.map((source) => (
          <Pressable
            key={source}
            accessibilityRole="link"
            accessibilityLabel={`Quelle öffnen: ${source}`}
            onPress={() => Linking.openURL(source)}
          >
            <Text style={styles.sourceLink}>{source}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: tokens.spacing.lg,
    },
    favoriteButton: {
      alignSelf: 'flex-start',
      marginBottom: tokens.spacing.sm,
    },
    favoriteButtonText: {
      color: colors.accent,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    title: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.xl,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.md,
    },
    paragraph: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      marginBottom: tokens.spacing.md,
      lineHeight: 24,
    },
    sourcesSection: {
      marginTop: tokens.spacing.lg,
      paddingTop: tokens.spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    sourcesHeading: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.sm,
    },
    sourceLink: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
  });
}
