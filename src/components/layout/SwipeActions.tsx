import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { LucideIcon } from 'lucide-react-native';

export interface SwipeAction {
  key: string;
  icon: LucideIcon;
  label: string;
  /** Butonun dolgu rengi — ikon ve yazı her zaman beyaz çiziliyor. */
  color: string;
  onPress: () => void;
}

const ACTION_WIDTH = 76;
const OPEN_THRESHOLD = 0.4;
// Sona gelince parmak "duvara çarpmış" gibi hissettirmesin diye hafif bir
// lastik payı — üst sınır tam `width` değil, biraz ötesi.
const RUBBER_BAND = 1.15;

// Tek bir aksiyon butonu: BÜYÜKLÜĞÜ kaydırma mesafesine bağlı (kullanıcı
// isteği — eskiden şerit sabit boyutta gelip yalnız opaklığı değişiyordu,
// "az kaydırınca az az gözükmeli, büyüyerek gelmeli" istendi). Her buton
// kendi payına düşen aralıkta (`index*ACTION_WIDTH` → `(index+1)*ACTION_WIDTH`)
// 0'dan 1'e büyüyor — soldaki (ekranın kenarına en yakın) buton önce, sağdaki
// parmak daha ileri gidince büyümeye başlıyor. `translateX` tek paylaşılan
// değer olduğu için açılış (spring/timing ile) ve kapanış TAMAMEN simetrik:
// aynı interpolasyon ekrana geri sarılırken küçülmeyi de otomatik veriyor.
function SwipeActionButton({
  action,
  index,
  translateX,
  onPress,
}: {
  action: SwipeAction;
  index: number;
  translateX: SharedValue<number>;
  onPress: () => void;
}) {
  const { icon: Icon, label, color } = action;
  const rangeStart = index * ACTION_WIDTH;
  const rangeEnd = rangeStart + ACTION_WIDTH;

  // Arka plan rengi de büyümeye dahil — yalnız ikon/yazı değil, TÜM buton
  // (rengiyle birlikte) ufacık başlayıp tam boyuta büyüyor. `opacity` ayrıca
  // gerekli: `scale` küçükken View'ın kendisi hâlâ tam boyutta yer kaplar,
  // saydamlık olmadan yarı büyümüş bir buton hep "orada duruyormuş" gibi
  // görünürdü.
  const style = useAnimatedStyle(() => {
    const progress = interpolate(translateX.value, [rangeStart, rangeEnd], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: progress,
      transform: [{ scale: interpolate(progress, [0, 1], [0.3, 1], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View style={{ width: ACTION_WIDTH, overflow: 'hidden' }}>
      <Animated.View style={[{ flex: 1, backgroundColor: color, alignItems: 'center', justifyContent: 'center', gap: 4 }, style]}>
        <Pressable className="items-center justify-center gap-1" onPress={onPress} accessibilityLabel={label} hitSlop={4}>
          <Icon size={19} color="#fff" />
          <Text className="text-white text-[11px] font-semibold" numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// Satırı sağa çekince SOLDAN açılan aksiyon şeridi (kullanıcı isteği:
// "sağa kaydırınca okunmadı ve sil ikonları çıkmalı yan yana").
//
// NEDEN KÜTÜPHANE DEĞİL: önce `react-native-gesture-handler/ReanimatedSwipeable`
// kullanıldı; görünüm doğruydu ama BUTONLAR DOKUNMA ALMIYORDU. Sebep, o
// bileşenin aksiyonları satırın ALTINA (z-sırasında önce) koyup satırı
// `translateX` ile kaydırması: Fabric'te dokunma hedeflemesi satırın
// kaydırılmamış yerleşim dikdörtgenini kullandığı için satır, açığa çıkan
// aksiyon alanının üstünü kapatıyor ve dokunuşları yutuyor. Burada aksiyon
// katmanı satırın ÜSTÜNDE (z-sırasında sonra) duruyor — dokunuşlar doğrudan
// butonlara gidiyor.
//
// İKİNCİ DÜZELTME (bu revizyon): `GestureDetector` eskiden yalnızca satırı
// sarıyordu — açıldıktan sonra parmak butonların ÜZERİNDEN sürüklenince pan
// hiç tetiklenmiyordu (butonlar `Pressable`, RN'in kendi dokunma sistemini
// kullanıyor, pan'e hiç ulaşmıyordu), kapatmak için satırın dar, butonsuz
// şeridinden çekmek gerekiyordu. `GestureDetector` artık aksiyon katmanı DAHİL
// tüm bileşeni sarıyor: RNGH bir sürükleme başladığını (`activeOffsetX` eşiği
// aşılınca) algılayınca alttaki `Pressable`nin dokunuşunu iptal edip pan'i
// devralıyor, kısa bir dokunuş ise değişmeden butona gidiyor.
//
// Aksiyon katmanı artık HER ZAMAN mount'lu (eskiden yalnızca `open` iken
// render ediliyordu, bu da butonların sürüklerken değil ancak bırakınca "pat"
// diye belirmesine yol açıyordu) — görünürlüğü ve boyutunu `translateX`'e bağlı
// her butonun kendi büyüme animasyonu belirliyor, kapalıyken `pointerEvents="none"`
// ile dokunuşu yutmuyor.
//
// Çekmece jesti bu ekranda bilerek kapalı (bkz. drawerConstants
// NO_DRAWER_SWIPE_ROUTES); açık olsaydı sağa çekiş menüyü açardı.
export default function SwipeActions({ actions, children }: { actions: SwipeAction[]; children: React.ReactNode }) {
  const width = ACTION_WIDTH * actions.length;
  const translateX = useSharedValue(0);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    translateX.value = withTiming(0, { duration: 160 });
    setOpen(false);
  }, [translateX]);

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .onChange((event) => {
      const next = translateX.value + event.changeX;
      translateX.value = Math.min(width * RUBBER_BAND, Math.max(0, next));
    })
    .onEnd(() => {
      const shouldOpen = translateX.value > width * OPEN_THRESHOLD;
      translateX.value = withSpring(shouldOpen ? width : 0, { damping: 20, stiffness: 220 });
      runOnJS(setOpen)(shouldOpen);
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <View style={{ overflow: 'hidden', borderRadius: 12 }}>
        {/* Satır ÖNCE (z-sırasında altta) — kendi (opak) arka planıyla
            kapalıyken aksiyon katmanının tamamını örtüyor. */}
        <Animated.View style={rowStyle}>{children}</Animated.View>

        {/* Aksiyon katmanı SONRA (z-sırasında üstte): açığa çıkan alandaki
            dokunuşlar, satırın (Fabric'te yanlış raporlanan, kaydırılmamış)
            hit-test dikdörtgeni ne derse desin doğrudan buraya geliyor. */}
        <Animated.View
          pointerEvents={open ? 'auto' : 'none'}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width, flexDirection: 'row' }}
        >
          {actions.map((action, index) => (
            <SwipeActionButton
              key={action.key}
              action={action}
              index={index}
              translateX={translateX}
              onPress={() => {
                close();
                action.onPress();
              }}
            />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
