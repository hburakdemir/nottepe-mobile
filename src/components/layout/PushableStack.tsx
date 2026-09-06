import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolate, interpolateColor, runOnJS, useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated';
import { useDrawerProgress } from '@react-navigation/drawer';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';

// X (Twitter) tarzı "itme" efekti. İTMENİN KENDİSİ ARTIK BU DOSYADA DEĞİL:
// Drawer.Navigator `drawerType: 'back'` kullanıyor (bkz. RootNavigator.tsx),
// yani react-native-drawer-layout içeriği parmakla birebir sağa itiyor. Daha
// önce `front` + burada elle translateX vardı; kütüphanenin `front`'a özel
// "touchDistance" düzeltmesi, parmak panel genişliğinin sağından başladığında
// meüyü anında ileri fırlattığı için jest parmağı takip etmiyordu.
//
// Geriye kalan iş: itilen sayfanın görünen SOL kenarını yuvarlamak, opak bir
// zemin vermek (altındaki menü sızmasın), ince ayırıcı çizgiyi çizmek ve menü
// açıkken sayfaya dokununca kapatmak. X'te sayfa KÜÇÜLMÜYOR, sadece kayıyor.
//
// GÖLGE ŞU AN BİLİNÇLİ OLARAK YOK. Önce Android `elevation` + iOS `shadow*`
// ikilisi, sonra SVG ile çizilen bir gradyan şerit denendi; ikisi de itilen
// sayfanın solundaki koyu bandı değiştirmedi. Bant başka bir katmandan
// geliyor — kaynağı bulunana kadar buradan hiç gölge çizmiyoruz ki teşhis
// tek değişkenli kalsın.
// Olculer Claude mobil uygulamasinin referans ekran goruntulerinden cikarildi
// (946x2048; ekran genisligi 393dp kabul edilerek olceklendi):
//  - Kose yaricapi: kose egrisi y=0'da x=895'ten baslayip y=125'te duz kenara
//    (x=776) oturuyor → yatay sapma 119px = ekran genisliginin %12.6 ≈ 50dp.
//    Egriye R=119px'lik daire fit edildi, sapma her noktada ~3px (JPEG+antialias).
//  - Ayirici: itilen sayfanin sol kenarinda 1 FIZIKSEL piksellik bir cizgi.
//    Koyu temada acik (17→51, yani %14 beyaz), acik temada koyu (243→210,
//    yani %14 siyah). Ayrimi asil yapan sey bu cizgi — golge degil.
// Dışa aktarılıyor: RootNavigator.tsx'teki durum-çubuğu yaması, bu köşe
// yarıçapı kadar öteye taşıp köşe eğrisinin ötesine geçmeli (bkz. orada).
export const PUSHABLE_STACK_CORNER_RADIUS = 50;
const CORNER_RADIUS = PUSHABLE_STACK_CORNER_RADIUS;

export default function PushableStack({ children }: { children: React.ReactNode }) {
  const progress = useDrawerProgress();
  const navigation = useNavigation();
  const { theme, colors } = useTheme();
  // İtilen sayfanın OPAK bir zemini olmalı: köşe yuvarlaması sırasında
  // altındaki menü paneli içeriğinin sızmaması için.
  const surfaceColor = colors.surface;
  const [overlayActive, setOverlayActive] = useState(false);

  useAnimatedReaction(
    () => progress.value > 0.01,
    (active, prevActive) => {
      if (active !== prevActive) runOnJS(setOverlayActive)(active);
    }
  );

  const radiusStyle = useAnimatedStyle(() => {
    const radius = interpolate(progress.value, [0, 1], [0, CORNER_RADIUS]);
    return { borderTopLeftRadius: radius, borderBottomLeftRadius: radius };
  });

  const edgeColor = theme === 'dark' ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.40)';

  // Ayırıcı çizgi ESKİDEN ayrı, düz kenarlı bir `View`di (sabit
  // `left:0,top:0,bottom:0`) — köşe yuvarlamasını hiç TAŞIMIYORDU, üstündeki
  // katmanda da `overflow:'hidden'` yoktu. Sonuç: sayfanın köşeleri
  // yuvarlanırken çizgi tepeden tabana DÜMDÜZ inip köşede kesişmiyordu
  // ("iOS'ta menü drawer açılınca köşeleri yuvarlanıyor ama hep bir düz çizgi
  // oluyor" şikâyeti buydu). Artık ayrı bir View yok — çizgi, zaten
  // `radiusStyle` + `overflow:'hidden'` taşıyan İÇ katmanın kendi
  // `borderLeftWidth`'i: kenarlık köşe eğrisini otomatik takip ediyor ve
  // eğrinin bittiği yerde sonlanıyor. Kapalıyken (`progress===0`) renk
  // saydam, ayrı bir opaklık katmanına gerek kalmadı.
  const innerStyle = useAnimatedStyle(() => ({
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: interpolateColor(progress.value, [0, 1], ['transparent', edgeColor]),
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, radiusStyle, { backgroundColor: surfaceColor }]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, radiusStyle, innerStyle, { overflow: 'hidden', backgroundColor: surfaceColor }]}
      >
        {children}
        {overlayActive && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => navigation.dispatch(DrawerActions.closeDrawer())}
            accessibilityLabel="Menüyü kapat"
          />
        )}
      </Animated.View>
    </Animated.View>
  );
}
