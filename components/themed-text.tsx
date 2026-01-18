import { Text, type TextProps } from 'react-native';
import { useTheme } from './theme-provider';

export type TextType = 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';

export function ThemedText({
  type = 'default',
  style,
  ...rest
}: TextProps & { type?: TextType }) {
  const { theme } = useTheme();

  return (
    <Text
      style={[
        { color: theme.text },
        type === 'default' ? { fontSize: 16, lineHeight: 24 } : null,
        type === 'title' ? { fontSize: 32, fontWeight: 'bold', lineHeight: 40 } : null,
        type === 'defaultSemiBold' ? { fontSize: 16, fontWeight: '600', lineHeight: 24 } : null,
        type === 'subtitle' ? { fontSize: 20, fontWeight: 'bold', lineHeight: 28 } : null,
        type === 'link' ? { color: theme.primary, fontSize: 16, lineHeight: 24 } : null,
        style,
      ]}
      {...rest}
    />
  );
}