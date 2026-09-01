import React from 'react';
import * as ReactNative from 'react-native';
import { APP_FONT_FAMILY } from './typography';

// RN'nin Text/TextInput'u artık fonksiyon bileşen olduğu için eski
// `Text.defaultProps` / `Text.render` monkey-patch numaraları çalışmıyor
// (defaultProps.style, ekranların kendi style'ı tarafından tamamen eziliyor).
// Bunun yerine react-native modülünün export'unu, style dizisinin başına
// fontFamily ekleyen bir sarmalayıcıyla değiştiriyoruz. Metro/Babel'in
// commonjs derlemesinde `import { Text } from 'react-native'` her kullanım
// noktasında `_reactNative.Text` şeklinde canlı property erişimine
// dönüştüğü için, App.tsx başında bir kere burayı çağırmak tüm ekranlardaki
// Text/TextInput'u (React Navigation başlıkları dahil) otomatik kapsar.
function withFont<P extends { style?: unknown }>(
  Component: React.ComponentType<P>,
  fontFamily: string
): React.ComponentType<P> {
  const Wrapped = React.forwardRef<unknown, P>((props, ref) =>
    React.createElement(Component, { ...props, ref, style: [{ fontFamily }, props.style] } as any)
  );
  Wrapped.displayName = `WithGlobalFont(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped as unknown as React.ComponentType<P>;
}

let applied = false;

export function applyGlobalFont(): void {
  if (applied || !APP_FONT_FAMILY) return;
  applied = true;
  // react-native'in kendi index'i Text/TextInput'u lazy-require eden bir
  // getter olarak tanımlıyor (setter yok) — düz atama ("ReactNative.Text = ...")
  // "Cannot assign to property which has only a getter" hatasıyla patlıyor.
  // Property'yi kendi getter'ımızla yeniden tanımlamamız gerekiyor.
  const wrappedText = withFont(ReactNative.Text, APP_FONT_FAMILY);
  const wrappedTextInput = withFont(ReactNative.TextInput, APP_FONT_FAMILY);
  Object.defineProperty(ReactNative, 'Text', { value: wrappedText, configurable: true, enumerable: true });
  Object.defineProperty(ReactNative, 'TextInput', { value: wrappedTextInput, configurable: true, enumerable: true });
}
