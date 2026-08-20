import { View } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import type { DayRating } from '../calendarLogic';
import type { ThemeColors } from '../../../theme/types';

export const RATING_LABELS: Record<DayRating, string> = {
  good: 'gut',
  medium: 'mittel',
  bad: 'schub-verdächtig',
};

function ratingIndicatorStyle(colors: ThemeColors, rating: DayRating) {
  if (rating === 'bad') {
    return {
      width: 0,
      height: 0,
      marginTop: 2,
      borderLeftWidth: 4,
      borderRightWidth: 4,
      borderBottomWidth: 7,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: colors.danger,
    } as const;
  }
  if (rating === 'medium') {
    return {
      width: 6,
      height: 6,
      marginTop: 2,
      borderRadius: 1,
      backgroundColor: colors.warning,
    } as const;
  }
  return {
    width: 6,
    height: 6,
    marginTop: 2,
    borderRadius: 3,
    backgroundColor: colors.success,
  } as const;
}

interface RatingIndicatorProps {
  rating: DayRating;
}

export function RatingIndicator({ rating }: RatingIndicatorProps) {
  const { colors } = useTheme();
  return <View style={ratingIndicatorStyle(colors, rating)} />;
}
