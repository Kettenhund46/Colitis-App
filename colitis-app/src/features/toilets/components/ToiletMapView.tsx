import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { MAP_HTML } from '../mapHtml.generated';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { Coordinates, SavedPlace, Toilet, WebViewToNativeMessage } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface ToiletMapViewProps {
  center: Coordinates;
  toilets: Toilet[];
  savedPlaces: SavedPlace[];
  onRegionChange: (center: Coordinates) => void;
  onMarkerTap: (id: string, kind: 'toilet' | 'place') => void;
  onLongPress: (coordinates: Coordinates) => void;
}

export function ToiletMapView({
  center,
  toilets,
  savedPlaces,
  onRegionChange,
  onMarkerTap,
  onLongPress,
}: ToiletMapViewProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const isRegionChangeEchoRef = useRef(false);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (isRegionChangeEchoRef.current) {
      isRegionChangeEchoRef.current = false;
      return;
    }
    webViewRef.current?.injectJavaScript(`window.setCenter(${center.latitude}, ${center.longitude}); true;`);
  }, [isReady, center]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    webViewRef.current?.injectJavaScript(`window.setToilets(${JSON.stringify(JSON.stringify(toilets))}); true;`);
  }, [isReady, toilets]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    webViewRef.current?.injectJavaScript(`window.setSavedPlaces(${JSON.stringify(JSON.stringify(savedPlaces))}); true;`);
  }, [isReady, savedPlaces]);

  function handleMessage(event: { nativeEvent: { data: string } }) {
    let message: WebViewToNativeMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as WebViewToNativeMessage;
    } catch {
      return;
    }

    if (message.type === 'ready') {
      setIsReady(true);
    } else if (message.type === 'regionChange') {
      isRegionChangeEchoRef.current = true;
      onRegionChange({ latitude: message.latitude, longitude: message.longitude });
    } else if (message.type === 'markerTap') {
      onMarkerTap(message.id, message.kind);
    } else if (message.type === 'longPress') {
      onLongPress({ latitude: message.latitude, longitude: message.longitude });
    }
  }

  function handleLoadError() {
    setHasLoadError(true);
  }

  if (hasLoadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Karte konnte nicht geladen werden.</Text>
      </View>
    );
  }

  return (
    <WebView
      ref={webViewRef}
      style={styles.webview}
      source={{ html: MAP_HTML }}
      onMessage={handleMessage}
      onError={handleLoadError}
      onHttpError={handleLoadError}
      originWhitelist={['*']}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    webview: {
      flex: 1,
    },
    errorContainer: {
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
  });
}
