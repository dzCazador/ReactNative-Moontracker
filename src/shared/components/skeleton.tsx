import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '@/shared/theme/colors';

interface SkeletonProps {
  style?: ViewStyle;
  width?: number | string;
  height?: number | string;
  radius?: number;
  marginTop?: number;
}

export function Skeleton({ style, width, height, radius = 4, marginTop }: SkeletonProps) {
  return <View style={[styles.base, { width, height, borderRadius: radius, marginTop }, style]} />;
}

interface SkeletonListProps {
  count?: number;
  itemHeight?: number;
}

export function SkeletonList({ count = 4, itemHeight = 64 }: SkeletonListProps) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.listItem}>
          <Skeleton width="55%" height={16} />
          <Skeleton style={styles.skeletonLine} width="75%" height={16} marginTop={6} />
          <Skeleton width="40%" height={14} marginTop={6} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.dark.surfaceElevated,
  },
  list: {
    gap: 12,
  },
  listItem: {
    gap: 6,
  },
  skeletonLine: {
    backgroundColor: colors.dark.surfaceElevated,
  },
});
