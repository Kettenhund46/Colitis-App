import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { fetchFeedPublication } from '../../../src/features/newsFeed/feedClient';
import {
  syncFeedItems,
  listCachedFeedItems,
  markFeedItemAsRead,
} from '../../../src/features/newsFeed/db/feedItemsRepository';
import { NewsFeedList } from '../../../src/features/newsFeed/components/NewsFeedList';
import { SkeletonList } from '../../../src/components/ui/SkeletonList';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { FeedItem } from '../../../src/features/newsFeed/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function NewsFeedScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offlineHint, setOfflineHint] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const requestId = ++loadRequestIdRef.current;
      setIsLoading(true);
      loadFeed(requestId).finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });
      return () => {
        isActive = false;
      };
    }, [])
  );

  async function loadFeed(requestId: number) {
    try {
      const publication = await fetchFeedPublication();
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      const db = await createEncryptedDb();
      await syncFeedItems(db, publication.items);
      const cached = await listCachedFeedItems(db);
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      setItems(cached);
      setLoadError(null);
      setOfflineHint(null);
    } catch (error: unknown) {
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      console.error('[NewsFeed] Laden der Neuigkeiten fehlgeschlagen:', error);
      await handleLoadFailure(requestId);
    }
  }

  async function handleLoadFailure(requestId: number) {
    try {
      const db = await createEncryptedDb();
      const cached = await listCachedFeedItems(db);
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      if (cached.length > 0) {
        setItems(cached);
        setOfflineHint('Offline — zeigt zuletzt geladene Neuigkeiten');
        setLoadError(null);
        return;
      }
    } catch (cacheError: unknown) {
      console.error('[NewsFeed] Cache konnte nicht gelesen werden:', cacheError);
    }
    if (requestId !== loadRequestIdRef.current) {
      return;
    }
    setLoadError('Neuigkeiten konnten nicht geladen werden.');
    setOfflineHint(null);
  }

  async function handleSelect(item: FeedItem) {
    Linking.openURL(item.url);
    if (item.isRead) {
      return;
    }
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
    try {
      const db = await createEncryptedDb();
      await markFeedItemAsRead(db, item.id);
    } catch (error: unknown) {
      console.error('[NewsFeed] Gelesen-Status konnte nicht gespeichert werden:', error);
    }
  }

  return (
    <View style={styles.container}>
      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      )}
      {offlineHint && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>{offlineHint}</Text>
        </View>
      )}
      {isLoading && items.length === 0 ? (
        <SkeletonList count={3} lines={3} />
      ) : (
        <NewsFeedList items={items} onSelect={handleSelect} />
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
    offlineBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.sm,
    },
    offlineText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
    },
  });
}
