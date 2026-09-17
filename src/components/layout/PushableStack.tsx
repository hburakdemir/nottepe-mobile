import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useDrawerProgress } from '@react-navigation/drawer';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';

const AnimatedPath = Animated.createAnimatedComponent(Path);


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

  // Nötr — mavi/renkli bir kenar sayfanın kendi rengi gibi okunuyordu.
  // Koyu temada beyaza, açık temada siyaha çalan düşük alfalı tek bir ton.
  const edgeColor = theme === 'dark' ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.40)';


  const height = useSharedValue(0);

  const [heightPx, setHeightPx] = useState(0);

  // ——— ÇENTİK MASKESİ: KIRPMA YERİNE BOYAMA ———
  //
  // Köşe yuvarlaması eskiden animasyonlu `borderRadius` (`radiusStyle`) +
  // `overflow: 'hidden'` ile yapılıyordu. 1.0.14 ölçümü bunun menü aç/kapadaki
  // "aşama aşama tık tık tık" şikâyetinin BİRİNCİ sebebi olduğunu gösterdi;
  // mekanizma RN 0.81 Android kaynağına kadar izlendi:
  //
  //   animasyonlu borderRadius → BackgroundStyleApplicator.setBorderRadius →
  //   invalidateSelf() → View.invalidate() HER KARE → ReactViewGroup.dispatchDraw
  //   yuvarlak dalına giriyor → clipToPaddingBox HER KARE yeni bir
  //   android.graphics.Path ayırıp canvas.clipPath() çağırıyor.
  //
  // `clipPath` dikdörtgen olmadığı için scissor/hızlı-ret yolunu kullanamıyor,
  // ve o clip'in ALTINDAKİ şey tüm kalıcı mount'lu sekme yığını: beş ekran,
  // dondurulmamış, bütün SVG avatarlarıyla (bkz. MainTabsScreen.tsx
  // `detachInactiveScreens={false}`, `freezeOnBlur: false`).
  //
  // Oysa ebeveyn `translateX`'i normalde BEDAVADIR — renderer çocukların
  // önbellekli display list'lerini yeni matrisle tekrar oynatır. Kare başına
  // invalidate tam olarak o bedava yolu iptal edip her kareyi tam yeniden
  // kompozisyona çeviriyordu.
  //
  // Artık kırpma yok: çentik sayfanın ÜSTÜNE boyanıyor. GÖRÜNTÜ BİREBİR AYNI,
  // çünkü kırpmanın açığa çıkardığı renk de zaten buydu — RootNavigator'ın
  // kök katmanı `menuBg = colors.surface`, buradaki `surfaceColor` ile aynı
  // tema değeri. Kare başına yeniden çizilen alan tüm ekran yerine bu 50px'lik
  // şerit.
  const maskProps = useAnimatedProps(() => {
    const radius = interpolate(progress.value, [0, 1], [0, CORNER_RADIUS]);
    const h = Math.max(height.value, radius * 2);
    // İki alt-yol: üst-sol ve alt-sol çentik. Her biri kare köşe noktasından
    // yaya, yaydan kenara gidip kapanıyor — yani KAPSANAN alan sayfanın DIŞINDA
    // kalan küçük bölge, tam da kırpmanın kestiği yer.
    //
    // Yay parametreleri aşağıdaki çizgi yoluyla BİREBİR AYNI olmak zorunda
    // (aynı yarıçap, aynı bayraklar, aynı yön): ikisi üst üste oturmazsa çizgi
    // maskenin kenarından kayar.
    const d =
      `M ${radius} 0 A ${radius} ${radius} 0 0 0 0 ${radius} L 0 0 Z ` +
      `M 0 ${h} L 0 ${h - radius} A ${radius} ${radius} 0 0 0 ${radius} ${h} Z`;
    return { d };
  });

  const pathProps = useAnimatedProps(() => {
    const radius = interpolate(progress.value, [0, 1], [0, CORNER_RADIUS]);
    const h = Math.max(height.value, radius * 2);
    // ÜST YAY + SOL KENAR + ALT YAY, TEK YOL. Yani itilen sayfanın görünen
    // sol kenarı boyunca kesintisiz bir ayırıcı çizgi.
    //
    // Bu düz segment bir ara kaldırılmıştı: köşe yuvarlaması "düz bir çizgiye
    // çarpıp yok oluyor" diye. TEŞHİS YANLIŞTI — asıl suçlu MenuDrawerContent'in
    // sağ kenarına çizdiği tam yükseklikte gradyan gölge şeridiydi (bkz. orada
    // "PANELİN SAĞ KENARINDA GÖLGE YOK" notu, emülatörde ölçülüp kaldırıldı).
    // O bant gidince ince kenar çizgisi köşeyi bozmuyor, tam tersine köşe
    // yayını sürdürerek sayfanın sınırını belli ediyor.
    //
    // Çizgi burada ŞART: zemin menüyle aynı renk (RootNavigator `menuBg`) ve
    // itilen sayfanın kendi üst barı da `surface` — köşedeki çentiğin renk
    // kontrastı yok, yuvarlamayı görünür kılan tek şey bu yol.
    const d = `M ${radius} 0 A ${radius} ${radius} 0 0 0 0 ${radius} L 0 ${h - radius} A ${radius} ${radius} 0 0 0 ${radius} ${h}`;
    return {
      d,
      stroke: interpolateColor(progress.value, [0, 1], ['transparent', edgeColor]),
    };
  });

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: surfaceColor }]}
      onLayout={(e) => {
        height.value = e.nativeEvent.layout.height;
        setHeightPx(e.nativeEvent.layout.height);
      }}
    >
      {/* İKİ KAPSAYICIDAN DA `radiusStyle` VE `overflow` KALDIRILDI (1.0.15).
          Gerekçenin tamamı yukarıdaki `maskProps` notunda; özeti: animasyonlu
          borderRadius + `overflow: 'hidden'`, kare başına tüm sekme yığınını
          dikdörtgen olmayan bir `clipPath`'ten geçiriyordu.

          İkisi artık düz `View`: animasyonlu stilleri kalmadığı için
          `Animated.View` olmalarının da gereği yok — bu, Reanimated'in kare
          başına commit ettiği hedef sayısından iki tanesini de düşürüyor.

          Opak zemin İKİSİNDE DE duruyor: köşe boyanırken altındaki menü paneli
          içeriğinin sızmaması için (bkz. yukarıdaki `surfaceColor` notu). */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: surfaceColor }]}>
        {children}
        {overlayActive && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => navigation.dispatch(DrawerActions.closeDrawer())}
            accessibilityLabel="Menüyü kapat"
          />
        )}
      </View>
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
            {/* SIRA ÖNEMLİ: maske ALTTA, çizgi ÜSTTE. Maske sayfanın köşesini
                zemin rengiyle kapatıyor, çizgi de o kapanan kenarın üzerinden
                geçiyor. Ters sırada çizgi maskenin altında kalıp yarısı
                kaybolurdu. */}
            <AnimatedPath animatedProps={maskProps} fill={surfaceColor} stroke="none" />
            <AnimatedPath animatedProps={pathProps} fill="none" strokeWidth={1} />
          </Svg>
        </View>
      )}
    </View>
  );
}
