import { remapProps } from 'nativewind';
import Animated from 'react-native-reanimated';

// NativeWind'e Reanimated bileşenlerini TANITIYORUZ.
//
// SORUN: NativeWind'in `className` derleme-zamanı dönüşümü yalnızca
// 'react-native'den doğrudan import edilen bileşenleri (View, Text,
// ScrollView, FlatList, ...) tanıyor. `Animated.View` / `Animated.ScrollView` /
// `Animated.FlatList` bu listede değil ve — hata vermeden — `className`'i
// SESSİZCE yok sayıyorlardı. Hatanın kötü cinsi: kod doğru görünüyor, uygulama
// çalışıyor, stil hiç uygulanmıyor. Projede iki ayrı yerde bunu açıklayan
// uyarı yorumu birikmişti (ProfileScreen).
//
// ÇÖZÜM: `remapProps`, NativeWind'in üçüncü-parti bileşenler için resmî kayıt
// API'si — `className`'i hesaplanmış stile çevirip `style` prop'una ekliyor.
// Kurulu sürümde (nativewind 4.2.6) var ve bu dosyadan önce projede hiç
// kullanılmamıştı.
//
// SINIR — bunu bilerek dar tutuyoruz: `remapProps` stili DİZİYE ekliyor, yani
// `useAnimatedStyle` çıktısı da taşıyan bir elemanda `[sınıf, animStyle]`
// oluşuyor. Reanimated bunu kaldırmalı ama garanti değil. Bu yüzden projedeki
// kural aynen duruyor: animasyon taşıyan `Animated.View` yalnızca animasyonu
// taşır, görsel sınıflar hemen içindeki düz `View`de kalır ("sar,
// stillendirme" deseni — repoda 10 dosya böyle). Buradaki kayıt, o desenin
// DIŞINDA kalan durumlar için: konumlandırma sınıfları ve
// `contentContainerClassName`.
//
// App.tsx'te global.css'ten hemen sonra, herhangi bir ekran import edilmeden
// önce çalışması gerekiyor.
remapProps(Animated.View, { className: 'style' });
remapProps(Animated.ScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});
remapProps(Animated.FlatList, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});
