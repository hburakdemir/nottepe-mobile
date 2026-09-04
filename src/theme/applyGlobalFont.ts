import React from 'react';
import * as ReactNative from 'react-native';
import { APP_FONT_FAMILY } from './typography';

// Sistem yazı tipi ölçeğinin (Android: Ayarlar → Ekran → Yazı tipi boyutu)
// tavanı. Kullanıcı ölçeği %130'a çektiğinde tasarımdaki sabit yükseklikli
// kutulara (tab bar, üst bar, rozet, gün kutucuğu…) sığmayan yazılar
// KIRPILIYORDU — APK ile Expo/iOS arasındaki farkın büyük kısmı buydu, çünkü
// cihaz ölçeği ikisinde aynı değildi. Ölçeği tamamen kapatmıyoruz (erişilebilirlik),
// güvenli bir tavanla sınırlıyoruz.
const MAX_FONT_SCALE = 1.2;

// `numberOfLines` verilmiş yazılar tek/az satırlık ETİKETLERDİR: sığmadıklarında
// sarmak yerine kırpılırlar. Bunlarda otomatik küçültmeyi açıyoruz —
// yazı önce %75'ine kadar küçülüyor, ancak ondan sonra kırpılıyor.
const MIN_FONT_SCALE = 0.75;

// RN'nin Text/TextInput'u artık fonksiyon bileşen olduğu için eski
// `Text.defaultProps` / `Text.render` monkey-patch numaraları çalışmıyor
// (defaultProps.style, ekranların kendi style'ı tarafından tamamen eziliyor).
// Bunun yerine react-native modülünün export'unu, style dizisinin başına
// fontFamily ekleyen (ve yukarıdaki ölçek kurallarını uygulayan) bir
// sarmalayıcıyla değiştiriyoruz. Metro/Babel'in commonjs derlemesinde
// `import { Text } from 'react-native'` her kullanım noktasında
// `_reactNative.Text` şeklinde canlı property erişimine dönüştüğü için,
// App.tsx başında bir kere burayı çağırmak tüm ekranlardaki Text/TextInput'u
// (React Navigation başlıkları dahil) otomatik kapsar.
function withFont<P extends { style?: unknown }>(
  Component: React.ComponentType<P>,
  fontFamily: string | undefined,
  shrinkToFit: boolean
): React.ComponentType<P> {
  const Wrapped = React.forwardRef<unknown, P>((props: any, ref) => {
    const patched: Record<string, unknown> = {};

    if (props.maxFontSizeMultiplier === undefined && props.allowFontScaling !== false) {
      patched.maxFontSizeMultiplier = MAX_FONT_SCALE;
    }

    if (shrinkToFit && props.numberOfLines > 0 && props.adjustsFontSizeToFit === undefined) {
      patched.adjustsFontSizeToFit = true;
      if (props.minimumFontScale === undefined) patched.minimumFontScale = MIN_FONT_SCALE;
    }

    return React.createElement(Component, {
      ...patched,
      ...props,
      ref,
      style: fontFamily ? [{ fontFamily }, props.style] : props.style,
    } as any);
  });
  Wrapped.displayName = `WithGlobalFont(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped as unknown as React.ComponentType<P>;
}

let applied = false;

export function applyGlobalFont(): void {
  if (applied) return;
  applied = true;
  // react-native'in kendi index'i Text/TextInput'u lazy-require eden bir
  // getter olarak tanımlıyor (setter yok) — düz atama ("ReactNative.Text = ...")
  // "Cannot assign to property which has only a getter" hatasıyla patlıyor.
  // Property'yi kendi getter'ımızla yeniden tanımlamamız gerekiyor.
  //
  // `adjustsFontSizeToFit` yalnızca Text'in prop'u — TextInput'a verilmiyor.
  const wrappedText = withFont(ReactNative.Text, APP_FONT_FAMILY, true);
  const wrappedTextInput = withFont(ReactNative.TextInput, APP_FONT_FAMILY, false);
  Object.defineProperty(ReactNative, 'Text', { value: wrappedText, configurable: true, enumerable: true });
  Object.defineProperty(ReactNative, 'TextInput', { value: wrappedTextInput, configurable: true, enumerable: true });
}
