import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated';
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
const CORNER_RADIUS = 50;

export default function PushableStack({ children }: { children: React.ReactNode }) {
  const progress = useDrawerProgress();
  const navigation = useNavigation();
  const { theme } = useTheme();
  // İtilen sayfanın OPAK bir zemini olmalı: köşe yuvarlaması sırasında
  // altındaki menü paneli içeriğinin sızmaması için.
  const surfaceColor = theme === 'dark' ? '#222831' : '#fff';
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

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        radiusStyle,
        {
          backgroundColor: surfaceColor,
          borderLeftWidth: StyleSheet.hairlineWidth,
          borderLeftColor: theme === 'dark' ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.40)',
        },
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, radiusStyle, { overflow: 'hidden', backgroundColor: surfaceColor }]}>
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
