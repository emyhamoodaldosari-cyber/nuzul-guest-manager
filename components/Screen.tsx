import type { ComponentProps } from 'react';
import { YStack } from '@blinkdotnew/mobile-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// `style` and `$media` props bypass prop order and could replace the inset, so passing one is a type error (lint_check).
type ScreenProps = Omit<ComponentProps<typeof YStack>, 'style' | `$${string}`> & { bottomInset?: boolean };

// Root of a screen. Its top padding is the device inset (0 on web) and wins over any padding passed in, so give top
// spacing to a child. `bottomInset` clears the home indicator under a custom bottom bar.
export function Screen({ bottomInset, children, paddingTop: _ignored, paddingBottom, ...props }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottom = bottomInset ? insets.bottom : paddingBottom;
  return (
    <YStack flex={1} {...props} {...(bottom === undefined ? null : { paddingBottom: bottom })} paddingTop={insets.top}>
      {children}
    </YStack>
  );
}
