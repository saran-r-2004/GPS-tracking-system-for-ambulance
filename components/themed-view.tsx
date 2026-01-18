import { View, type ViewProps } from 'react-native';
import { useTheme } from './theme-provider';

export function ThemedView({ style, ...otherProps }: ViewProps) {
  const { theme } = useTheme();
  return (
    <View
      style={[{ backgroundColor: theme.background }, style]}
      {...otherProps}
    />
  );
}
