import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { LucideIcon } from 'lucide-react-native';
import { impact, impactMedium } from '../../lib/haptics';

export interface SwipeAction {
  key: string;
  icon: LucideIcon;
  label: string;
  /** Zemin rengi — ikon ve yazı her zaman beyaz çiziliyor. */
  color: string;
  onPress: () => void;
  /**
   * İşlem tamamlanınca satır o yöne ekran dışına kayıp orada kalsın mı
   * (silme gibi satırı listeden düşüren işlemler). Değilse (okundu/okunmadı)
   * satır yerine yaylanıyor.
   */
  dismiss?: boolean;
}

// Kısmi kaydırmada açık kalan aksiyon alanının genişliği.
const ACTION_WIDTH = 76;
// Bu kadarı geçilip bırakılırsa alan açık kalır (dokunarak tetiklenir).
const OPEN_THRESHOLD = 0.4;
// Satır genişliğinin bu oranı geçilirse "tam kaydırma": bırakınca işlem
// dokunmaya gerek kalmadan tamamlanır.
const FULL_SWIPE_RATIO = 0.55;
const SPRING = { damping: 20, stiffness: 220 };

type Side = 'left' | 'right';

// Bir kenarın aksiyon zemini. BÜYÜMESİ çekildiği kenardan (kullanıcı isteği:
// "soldan çekilen soldan, sağdan çekilen sağdan büyüyerek gelmeli"): zemin o
// kenara yapışık, genişliği satırın kaydığı mesafe kadar — satırın arkasından
// uzayarak açılıyor. Eskiden buton ortasından küçükten büyüyordu (scale 0.3→1).
//
// İkon + etiket kenarda sabit durup opaklıkla beliriyor; tam kaydırma eşiği
// geçilince ("armed") parmağın tarafına, satırın kenarına doğru kayıyor —
// bırakınca işlemin tamamlanacağını haber veriyor (iOS Mail'deki gibi).
function ActionLayer({
  side,
  action,
  translateX,
  armed,
  open,
  onPress,
}: {
  side: Side;
  action: SwipeAction;
  translateX: SharedValue<number>;
  armed: SharedValue<number>;
  open: boolean;
  onPress: () => void;
}) {
  const { icon: Icon, label, color } = action;
  const sign = side === 'left' ? 1 : -1;

  const bgStyle = useAnimatedStyle(() => ({
    width: Math.max(0, sign * translateX.value),
  }));

  const contentStyle = useAnimatedStyle(() => {
    const revealed = Math.max(0, sign * translateX.value);
    // Eşik geçilince içerik kenardan, açığa çıkan alanın öbür ucuna kayıyor.
    const shift = armed.value * Math.max(0, revealed - ACTION_WIDTH);
    return {
      opacity: interpolate(revealed, [ACTION_WIDTH * 0.25, ACTION_WIDTH * 0.8], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateX: sign * shift }],
    };
  });

  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      style={[
        { position: 'absolute', top: 0, bottom: 0, backgroundColor: color, overflow: 'hidden' },
        side === 'left' ? { left: 0 } : { right: 0 },
        bgStyle,
      ]}
    >
      <Animated.View
        style={[
          { position: 'absolute', top: 0, bottom: 0, width: ACTION_WIDTH },
          side === 'left' ? { left: 0 } : { right: 0 },
          contentStyle,
        ]}
      >
        <Pressable className="flex-1 items-center justify-center gap-1" onPress={onPress} accessibilityLabel={label} hitSlop={4}>
          <Icon size={19} color="#fff" />
          <Text className="text-white text-[11px] font-semibold" numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// Satır kaydırma aksiyonları: sağa çekince SOLDAN `leftAction`, sola çekince
// SAĞDAN `rightAction` açılıyor (bildirimlerde sol = okundu/okunmadı, sağ = sil).
//
// Üç sonuç var:
//  - kısa çekiş → kapanır;
//  - `OPEN_THRESHOLD` geçilip bırakılırsa → alan açık kalır, dokununca çalışır;
//  - satırın %55'i geçilip bırakılırsa → işlem kendiliğinden tamamlanır
//    (eşik geçilirken titreşim).
//
// NEDEN KÜTÜPHANE DEĞİL: `ReanimatedSwipeable` aksiyonları satırın ALTINA
// koyup satırı `translateX` ile kaydırıyor; Fabric'te dokunma hedeflemesi
// satırın kaydırılmamış dikdörtgenini kullandığı için satır, açığa çıkan
// butonların üstünü kapatıp dokunuşları yutuyordu. Burada aksiyon katmanları
// satırın ÜSTÜNDE (z-sırasında sonra) ve `GestureDetector` hepsini sarıyor:
// açıkken butonun üzerinden sürüklemek de pan'i başlatıyor, kısa dokunuş
// butona gidiyor. Kapalıyken katmanlar `pointerEvents="none"`.
//
// Çekmece jesti bu ekranda kapalı (bkz. RootNavigator/DrawerSwipeSync) —
// açık olsaydı sağa çekiş satır yerine menüyü açardı.
export default function SwipeActions({
  leftAction,
  rightAction,
  children,
}: {
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  children: React.ReactNode;
}) {
  const translateX = useSharedValue(0);
  const rowWidth = useSharedValue(0);
  // 0/1 — tam kaydırma eşiği geçildi mi (içerik konumunu da süren değer).
  const armed = useSharedValue(0);
  const armedFlag = useSharedValue(false);
  const [open, setOpen] = useState<Side | null>(null);

  const hasLeft = !!leftAction;
  const hasRight = !!rightAction;

  const close = useCallback(() => {
    translateX.value = withTiming(0, { duration: 160 });
    setOpen(null);
  }, [translateX]);

  const runAction = useCallback(
    (side: Side) => {
      const action = side === 'left' ? leftAction : rightAction;
      setOpen(null);
      action?.onPress();
    },
    [leftAction, rightAction]
  );

  // Tamamla: `dismiss` ise satır o yöne ekran dışına kayıp kalıyor (liste onu
  // zaten düşürecek), değilse yerine yaylanıyor.
  const complete = useCallback(
    (side: Side) => {
      const action = side === 'left' ? leftAction : rightAction;
      if (!action) return;
      const sign = side === 'left' ? 1 : -1;
      impactMedium();
      if (action.dismiss) {
        translateX.value = withTiming(sign * rowWidth.value, { duration: 180 }, (done) => {
          if (done) runOnJS(runAction)(side);
        });
      } else {
        // Geri yaylanırken eşikten çıkış ikinci kez titretmesin.
        armedFlag.value = false;
        armed.value = withTiming(0, { duration: 140 });
        translateX.value = withSpring(0, SPRING);
        runAction(side);
      }
    },
    [leftAction, rightAction, translateX, rowWidth, runAction, armed, armedFlag]
  );

  // Eşiğe girip çıkarken hafif titreşim + içerik kayması.
  useAnimatedReaction(
    () => rowWidth.value > 0 && Math.abs(translateX.value) > rowWidth.value * FULL_SWIPE_RATIO,
    (isArmed, prev) => {
      if (prev === null || isArmed === prev) return;
      armed.value = withTiming(isArmed ? 1 : 0, { duration: 140 });
      if (armedFlag.value !== isArmed) {
        armedFlag.value = isArmed;
        runOnJS(impact)();
      }
    }
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .onChange((event) => {
      const max = rowWidth.value || ACTION_WIDTH * 4;
      const next = translateX.value + event.changeX;
      translateX.value = Math.min(hasLeft ? max : 0, Math.max(hasRight ? -max : 0, next));
    })
    .onEnd(() => {
      const x = translateX.value;
      const side: Side = x > 0 ? 'left' : 'right';
      const abs = Math.abs(x);
      if (rowWidth.value > 0 && abs > rowWidth.value * FULL_SWIPE_RATIO) {
        runOnJS(complete)(side);
        return;
      }
      const shouldOpen = abs > ACTION_WIDTH * OPEN_THRESHOLD;
      translateX.value = withSpring(shouldOpen ? (x > 0 ? ACTION_WIDTH : -ACTION_WIDTH) : 0, SPRING);
      runOnJS(setOpen)(shouldOpen ? side : null);
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <View style={{ overflow: 'hidden', borderRadius: 12 }} onLayout={(e) => (rowWidth.value = e.nativeEvent.layout.width)}>
        {/* Satır ÖNCE (z-sırasında altta). */}
        <Animated.View style={rowStyle}>{children}</Animated.View>

        {/* Aksiyon katmanları SONRA (z-sırasında üstte) — bkz. yukarıdaki not. */}
        {leftAction && (
          <ActionLayer
            side="left"
            action={leftAction}
            translateX={translateX}
            armed={armed}
            open={open === 'left'}
            onPress={() => {
              if (leftAction.dismiss) complete('left');
              else {
                close();
                leftAction.onPress();
              }
            }}
          />
        )}
        {rightAction && (
          <ActionLayer
            side="right"
            action={rightAction}
            translateX={translateX}
            armed={armed}
            open={open === 'right'}
            onPress={() => {
              if (rightAction.dismiss) complete('right');
              else {
                close();
                rightAction.onPress();
              }
            }}
          />
        )}
      </View>
    </GestureDetector>
  );
}
