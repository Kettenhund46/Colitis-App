import { useMemo, useRef } from 'react';
import { Animated, PanResponder, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { isDeleteSwipe, startedInEdgeStrip } from './swipeDecision';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { ReactNode } from 'react';

const EXIT_DURATION_MS = 180;

interface SwipeableRowProps {
  children: ReactNode;
  onDelete: () => void;
}

export function SwipeableRow({ children, onDelete }: SwipeableRowProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isReducedMotion = useReducedMotion();
  const translateX = useRef(new Animated.Value(0)).current;
  const startXRef = useRef(0);
  const rowWidthRef = useRef(screenWidth);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Bubble-Phase, nicht Capture: Tippen muss weiterhin bei Knoepfen
        // innerhalb der Zeile ankommen.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (event, gestureState) => {
          startXRef.current = event.nativeEvent.pageX - gestureState.dx;
          if (startedInEdgeStrip(startXRef.current, screenWidth)) {
            return false;
          }
          if (gestureState.dx >= 0) {
            return false;
          }
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        },
        onPanResponderMove: (_event, gestureState) => {
          if (gestureState.dx < 0) {
            translateX.setValue(gestureState.dx);
          }
        },
        onPanResponderRelease: (_event, gestureState) => {
          const shouldDelete = isDeleteSwipe({
            startX: startXRef.current,
            dx: gestureState.dx,
            dy: gestureState.dy,
            screenWidth,
          });

          if (!shouldDelete) {
            Animated.timing(translateX, {
              toValue: 0,
              duration: isReducedMotion ? 0 : EXIT_DURATION_MS,
              useNativeDriver: true,
            }).start();
            return;
          }

          if (isReducedMotion) {
            translateX.setValue(0);
            onDelete();
            return;
          }

          Animated.timing(translateX, {
            toValue: -rowWidthRef.current,
            duration: EXIT_DURATION_MS,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            onDelete();
          });
        },
        onPanResponderTerminate: () => {
          translateX.setValue(0);
        },
      }),
    [screenWidth, isReducedMotion, translateX, onDelete]
  );

  function handleLayout(event: LayoutChangeEvent) {
    rowWidthRef.current = event.nativeEvent.layout.width;
  }

  return (
    <Animated.View
      onLayout={handleLayout}
      style={{ transform: [{ translateX }] }}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}
