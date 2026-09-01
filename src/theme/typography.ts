// Uygulama genelindeki tek font tanımı. Test etmek için sadece bu satırı değiştir,
// tüm ekranlardaki Text/TextInput otomatik güncellenir (bkz. applyGlobalFont.ts).
//
// undefined = platformun sistem fontu (Android: Roboto, iOS: San Francisco) —
// web'in kullandığı sistem font yığınına (`Segoe UI`, -apple-system, Roboto, ...)
// en yakın karşılık, mevcut görünümü değiştirmez.
//
// Denemek için örnekler:
//   Android yerleşik: 'sans-serif', 'sans-serif-medium', 'sans-serif-condensed', 'serif', 'monospace'
//   iOS yerleşik: 'Avenir', 'Georgia', 'Helvetica Neue'
//   Özel font: önce `npx expo install expo-font @expo-google-fonts/<isim>` ile fontu kur,
//   App.tsx'te useFonts ile yükle, sonra buraya o fontun adını yaz.
export const APP_FONT_FAMILY: string | undefined = undefined;
