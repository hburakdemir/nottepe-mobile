import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useDrawerProgress } from '@react-navigation/drawer';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';

const AnimatedPath = Animated.createAnimatedComponent(Path);

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

  // Ayırıcı çizgi ESKİDEN İÇ katmanın `borderLeftWidth`'iydi — fikir "kenarlık
  // köşe eğrisini otomatik takip eder" idi ama iOS'ta ASİMETRİK köşe yarıçapı
  // (yalnızca sol iki köşe yuvarlak, sağ ikisi 0) + kenarlık kombinasyonunda
  // RN'in native kenarlık çizimi köşede DÜZGÜN kavis çizmiyor: köşe KIRPMA
  // (clip/overflow:hidden, ayrı bir çizim yolu) doğru yuvarlanıyor ama
  // kenarlığın kendisi köşede küt/düz bir kesim bırakıyordu — "köşeler
  // yuvarlanıyor ama hep bir düz çizgi de oluyor" şikâyeti tam olarak buydu ve
  // yalnızca iOS'ta görülüyordu (Android'in kenarlık çizim yolu asimetrik
  // yarıçapı doğru işliyor).
  //
  // Artık çizgi native `border` DEĞİL: aynı köşe yarıçapını (`radius`,
  // View'daki köşe kırpmasıyla BİREBİR aynı değer) izleyen bir SVG yolu
  // (`react-native-svg`) — üst kenardan köşe yayına, düz dikeye, alt köşe
  // yayına. SVG kendi çizim motorunu kullandığı için platformdan bağımsız,
  // her zaman View'ın kırptığı köşeyle piksel piksel örtüşüyor.
  const height = useSharedValue(0);
  // Svg'nin kendi `width`/`viewBox`'ı sabit sayısal piksel istiyor — reanimated
  // shared value'yu doğrudan JSX prop'una veremeyiz, bu yüzden aynı ölçüm
  // React state'ine de yazılıyor.
  const [heightPx, setHeightPx] = useState(0);

  const pathProps = useAnimatedProps(() => {
    const radius = interpolate(progress.value, [0, 1], [0, CORNER_RADIUS]);
    const h = Math.max(height.value, radius * 2);
    const d = `M ${radius} 0 A ${radius} ${radius} 0 0 0 0 ${radius} L 0 ${h - radius} A ${radius} ${radius} 0 0 0 ${radius} ${h}`;
    return {
      d,
      stroke: interpolateColor(progress.value, [0, 1], ['transparent', edgeColor]),
    };
  });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, radiusStyle, { backgroundColor: surfaceColor }]}
      onLayout={(e) => {
        height.value = e.nativeEvent.layout.height;
        setHeightPx(e.nativeEvent.layout.height);
      }}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          radiusStyle,
          // Köşe kırpması yalnızca çekmece hareket hâlinde/açıkken gerekli
          // (kapalıyken yarıçap zaten 0). Sürekli 'hidden' tutmak her ekran
          // için sürekli bir offscreen/composite katmanı zorluyordu — bu da
          // özellikle tablette geçiş sırasında GPU'yu gereksiz yere zorlayıp
          // ısınma/flash'a katkı sağlıyordu (bkz. plan Öncelik 2.2).
          { overflow: overlayActive ? 'hidden' : 'visible', backgroundColor: surfaceColor },
        ]}
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
      {/* ⚠️ BU KATMAN UYGULAMANIN SOL KENARINI ÖLDÜRMÜŞTÜ — bir daha
          `pointerEvents="none"`in tek başına yeteceğini varsayma.

          Bu Svg `left:0`, genişliği köşe yarıçapı (50dp) ve yüksekliği TÜM
          EKRAN; üstelik dış katmanın SON çocuğu olduğu için her şeyin üstünde
          duruyor. `pointerEvents="none"` yazılıydı ama iOS'ta HİÇBİR ETKİSİ
          YOK: react-native-svg kendi `hitTest:`'ini yazıyor
          (apple/Elements/RNSVGSvgView.mm) ve o override, UIKit'in standart
          `hitTest:`'inin ilk satırı olan `userInteractionEnabled` kontrolünü
          atlayıp `return isPointInside ? self : nil;` diyor — yani sınırları
          içindeki HER dokunuşu yutuyor.

          Sonuç: ekranın sol 50 pikselindeki her şey ölüydü. Menü avatarı,
          geri oku, Duyurular'daki en soldaki "Tümü" çipi (sağdakiler
          çalışıyordu), kartların sol kenarı... Ve iOS'un native geri-kaydırma
          jesti, çünkü RNScreens'in kenar tanıyıcıları `RNSScreenStackView`'a
          bağlı ve bu Svg onun ATASI değil, üstündeki bir kardeşi — sol
          kenardaki dokunuş o tanıyıcılara hiç ulaşmıyordu. Çekmecenin kendi
          kaydırması ise çalışıyordu, çünkü onun jesti bu Svg'nin ATASINA
          bağlı. Android'de sorun yok (RNSVGSvgViewAndroid normal bir ViewGroup).

          İki katmanlı koruma:
          1) Svg, `pointerEvents="none"` olan DÜZ BİR RN View'ın içinde. Düz
             View'ın hit-test'i RN'in kendi implementasyonu, `pointerEvents`e
             uyuyor: dokunuş daha içeri inmeden eleniyor.
          2) Ayrıca yalnızca çekmece hareket hâlindeyken mount ediliyor.
             Kapalıyken zaten görünmüyordu (yarıçap 0, çizgi `transparent`),
             yani görsel kayıp yok — ama sol kenar artık kapalıyken FİZİKSEL
             OLARAK boş. */}
      {heightPx > 0 && overlayActive && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
          <Svg width={CORNER_RADIUS} height={heightPx} viewBox={`0 0 ${CORNER_RADIUS} ${heightPx}`}>
            <AnimatedPath animatedProps={pathProps} fill="none" strokeWidth={StyleSheet.hairlineWidth} />
          </Svg>
        </View>
      )}
    </Animated.View>
  );
}
