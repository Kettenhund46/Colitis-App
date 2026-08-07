import { useMemo, useRef, type ReactNode } from 'react';
import {
  PanResponder,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getNeighbourTab, tabPath, type TabName } from '../navigation/tabOrder';
import { useSwipeNavigation } from '../navigation/SwipeNavigationContext';

/** Breite des Streifens an der Bildschirmkante, in dem die Geste beginnen muss. */
const EDGE_WIDTH = 25;
/** Waagerechte Mindeststrecke, ab der die Geste als Wischen gilt. */
const MIN_HORIZONTAL_DISTANCE = 60;

interface SwipeableTabScreenProps {
  tab: TabName;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function SwipeableTabScreen({ tab, style, children }: SwipeableTabScreenProps) {
  const router = useRouter();
  const { swipeEnabled } = useSwipeNavigation();
  const widthRef = useRef(0);
  const startEdgeRef = useRef<'left' | 'right' | null>(null);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Merkt sich nur, ob die Berührung am Rand begann. Gibt bewusst immer
        // false zurück, damit Tippen weiterhin bei den Kind-Elementen ankommt.
        onStartShouldSetPanResponderCapture: (event) => {
          const startX = event.nativeEvent.pageX;
          const width = widthRef.current;
          if (startX <= EDGE_WIDTH) {
            startEdgeRef.current = 'left';
          } else if (width > 0 && startX >= width - EDGE_WIDTH) {
            startEdgeRef.current = 'right';
          } else {
            startEdgeRef.current = null;
          }
          return false;
        },
        // Übernimmt die Geste erst, wenn sie am Rand begann, in die für diesen
        // Rand gültige Richtung geht, deutlich waagerecht verläuft und die
        // Mindeststrecke überschritten hat. Der Richtungscheck muss hier und
        // nicht erst bei onPanResponderRelease erfolgen, da sonst eine Geste im
        // Randstreifen in die "falsche" Richtung trotzdem gekapert würde und
        // darunterliegende Kind-Elemente (z. B. die Leaflet-Karte im Toiletten-Tab)
        // kein Pan mehr erhalten, obwohl am Ende gar nicht navigiert wird.
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
          const startEdge = startEdgeRef.current;
          if (!swipeEnabled || startEdge === null) {
            return false;
          }
          if (Math.abs(gestureState.dx) <= Math.abs(gestureState.dy)) {
            return false;
          }
          if (startEdge === 'left' && gestureState.dx <= 0) {
            return false;
          }
          if (startEdge === 'right' && gestureState.dx >= 0) {
            return false;
          }
          return Math.abs(gestureState.dx) >= MIN_HORIZONTAL_DISTANCE;
        },
        onPanResponderRelease: (_event, gestureState) => {
          const startEdge = startEdgeRef.current;
          startEdgeRef.current = null;
          if (startEdge === null) {
            return;
          }

          // gestureState.dx ist die kumulierte Distanz seit Berührungsbeginn,
          // nicht die Distanz seit dem letzten Schritt. Und
          // onMoveShouldSetPanResponderCapture wird nur einmal beim Kapern
          // der Geste gefragt, nicht erneut bei jeder Bewegung. Eine Geste
          // kann also z. B. am linken Rand beginnen, weit genug nach rechts
          // wandern, um gekapert zu werden, und dann ohne Loslassen wieder
          // über den Ausgangspunkt hinaus nach links zurückwandern. Das
          // Vorzeichen von dx beim Loslassen entspräche dann "next", obwohl
          // der Startrand nur "previous" erlauben darf. Deshalb hier erneut
          // gegen den Startrand prüfen, statt der Kaper-Prüfung blind zu
          // vertrauen.
          const direction = gestureState.dx > 0 ? 'previous' : 'next';
          if (startEdge === 'left' && direction !== 'previous') {
            return;
          }
          if (startEdge === 'right' && direction !== 'next') {
            return;
          }

          const target = getNeighbourTab(tab, direction);
          if (target !== null) {
            router.navigate(tabPath(target));
          }
        },
        onPanResponderTerminate: () => {
          startEdgeRef.current = null;
        },
      }),
    [swipeEnabled, tab, router]
  );

  function handleLayout(event: LayoutChangeEvent) {
    widthRef.current = event.nativeEvent.layout.width;
  }

  return (
    <View style={style} onLayout={handleLayout} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
