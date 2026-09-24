import React from 'react';
import * as ReactNative from 'react-native';
import { APP_FONT_FAMILY } from './typography';

// Sistem yazı tipi ölçeğinin (Android: Ayarlar → Ekran → Yazı tipi boyutu)
// tavanı. Kullanıcı ölçeği %130'a çektiğinde tasarımdaki sabit yükseklikli
// kutulara (tab bar, üst bar, rozet, gün kutucuğu…) sığmayan yazılar
// KIRPILIYORDU — APK ile Expo/iOS arasındaki farkın büyük kısmı buydu, çünkü
// cihaz ölçeği ikisinde aynı değildi. Ölçeği tamamen kapatmıyoruz (erişilebilirlik),
// güvenli bir tavanla sınırlıyoruz.
export const MAX_FONT_SCALE = 1.2;

// ⚠️ BURADA ESKİDEN `numberOfLines` VERİLMİŞ HER YAZIYA OTOMATİK
// `adjustsFontSizeToFit` BASILIYORDU. KALDIRILDI — bir daha geri ekleme.
//
// Gerekçesi ("etiketler sığmayınca küçülsün, kırpılmasın") mantıklıydı ama
// bedeli ANDROID'E ÖZGÜ ve çok büyük: bu prop'un iki platformdaki
// implementasyonu aynı iş değil.
//
//   iOS: UIKit/CoreText küçültmeyi TEK ölçüm pasında hallediyor — pratikte
//   bedava. Uygulamanın iOS'ta hiç kasmamasının sebeplerinden biri bu.
//
//   Android: RN bunu ITERATİF DÖNGÜYLE yapıyor — `StaticLayout` kur, taşıyor
//   mu diye bak, fontu bir kademe küçült, BAŞTAN kur; sığana kadar tekrarla.
//   Yeni Mimari'de bu ölçüm JNI üzerinden senkron bir çağrı, yani JS thread'ini
//   bekletebiliyor.
//
// Prop global olarak basıldığı için maliyet her `numberOfLines`'lı yazıya
// yayılıyordu: `PostCardModern`'da satır başına 3 tane + `BadgeChip`. Teşhis
// rozetinin ölçtüğü blokajların rotaya göre yığılması (Profile 24,5 sn ·
// Home 12,1 sn · PostDetail 3,1 sn / 322 sn pencere) bununla birebir
// örtüşüyor: maliyet o an ekranda kaç tane böyle yazı olduğuyla ölçekleniyor,
// global render dalgasıyla değil. Android görünürlük değişiminde tüm pencereyi
// yeniden ölçtüğü için öne dönüşte hepsi döngüsünü birden koşturuyor —
// "arka plandan dönünce donuyor" şikayetinin bu yoldan gelen payı.
//
// Kırpılma korkusu için asıl savunma zaten YUKARIDAKİ `MAX_FONT_SCALE` tavanı
// ve o bedava. Küçültmeyi gerçekten isteyen iki etiket prop'u KENDİ dosyasında
// elle veriyor — sayfa başlığı (AppHeader.tsx) ve 130 gün sekmeleri
// (Ego130ScheduleScreen.tsx, bkz. oradaki not). Global varsayılan değil.

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
  fontFamily: string | undefined
): React.ComponentType<P> {
  const Wrapped = React.forwardRef<unknown, P>((props: any, ref) => {
    const patched: Record<string, unknown> = {};

    if (props.maxFontSizeMultiplier === undefined && props.allowFontScaling !== false) {
      patched.maxFontSizeMultiplier = MAX_FONT_SCALE;
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
  const wrappedText = withFont(ReactNative.Text, APP_FONT_FAMILY);
  const wrappedTextInput = withFont(ReactNative.TextInput, APP_FONT_FAMILY);
  Object.defineProperty(ReactNative, 'Text', { value: wrappedText, configurable: true, enumerable: true });
  Object.defineProperty(ReactNative, 'TextInput', { value: wrappedTextInput, configurable: true, enumerable: true });
}
