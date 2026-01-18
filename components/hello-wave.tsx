import Animated from 'react-native-reanimated';

export function HelloWave() {
  return (
    <Animated.Text
      style={{
        fontSize: 28,
        lineHeight: 32,
        marginTop: -6,
        animationName: {
          '50%': { transform: [{ rotate: '25deg' }] },
        },
        animationIterationCount: 4,
        animationDuration: '300ms',
      }}>
      👋
    </Animated.Text>
  );
}
parallel-scroll-view.tsx
import { useRef } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from './theme-provider';
import { HelloWave } from './hello-wave';

type Props = {
  children: React.ReactNode;
  headerBackgroundColor: { light: string; dark: string };
  headerImage: React.ReactNode;
};

export default function ParallaxScrollView({
  children,
  headerBackgroundColor,
  headerImage,
}: Props) {
  const { theme, isDark } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        <ThemedView style={[styles.header, { backgroundColor: isDark ? headerBackgroundColor.dark : headerBackgroundColor.light }]}>
          {headerImage}
          <HelloWave />
        </ThemedView>
        <ThemedView style={styles.content}>{children}</ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  header: {
    height: 200,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 16,
    overflow: 'hidden',
  },
});