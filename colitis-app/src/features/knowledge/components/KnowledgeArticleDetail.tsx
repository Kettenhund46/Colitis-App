import { Linking, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import type { KnowledgeArticle } from '../types';

interface KnowledgeArticleDetailProps {
  article: KnowledgeArticle;
}

export function KnowledgeArticleDetail({ article }: KnowledgeArticleDetailProps) {
  const paragraphs = article.body.split('\n\n');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    padding: tokens.spacing.lg,
  },
  title: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.md,
  },
  paragraph: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    marginBottom: tokens.spacing.md,
    lineHeight: 24,
  },
  sourcesSection: {
    marginTop: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  sourcesHeading: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.sm,
  },
  sourceLink: {
    color: tokens.colors.primary,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.sm,
  },
});
