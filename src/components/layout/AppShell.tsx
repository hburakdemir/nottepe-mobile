import React, { useCallback } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from './AppHeader';
import KeyboardAvoider from './KeyboardAvoider';
import WaveTabBar from './WaveTabBar';
import { BACK_SWIPE_DISTANCE, BACK_SWIPE_ROUTES, BACK_SWIPE_VELOCITY } from '../../navigation/drawerConstants';

// Web'de Navbar + MobileTabBar, Layout.jsx üzerinden HER rotada (detay
// sayfaları dahil) sabit kalıyor — burada da her PUSH edilen ekran bu kabukla
// sarmalanıyor. (Sekmelerin kendi kabuğu MainTabsScreen'de: orada AppHeader ve
// WaveTabBar Tab.Navigator'ın DIŞINDA durduğu için sekme geçişinde hiç
// kıpırdamıyorlar.)
//
// Çekmecenin jest ayarları artık burada değil, RootNavigator'daki
// DrawerSwipeSync'te — tek yerde, o an odaklı ekrana bakarak.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const routeName = useRoute().name;
  const isBackSwipeRoute = BACK_SWIPE_ROUTES.includes(routeName);

  const shell = (
    <View style={{ flex: 1 }}>
      {/* Status bar'ın altındaki güvenli alan şeridi AppHeader'ın kendi arka
          planıyla birebir aynı renk olmalı, yoksa üstte farklı renkte bir
          şerit/dikiş görünür. */}
      <SafeAreaView edges={['top']} className="bg-surface">
        <AppHeader />
      </SafeAreaView>

      <View style={{ flex: 1 }}>
        {/* Klavye açıldığında SAYFA yukarı itiliyor, tab bar itilmiyor: bar
            klavyenin altında kalıyor (bkz. KeyboardAvoider.tsx). */}
        <KeyboardAvoider>{children}</KeyboardAvoider>
        {/* Bar kendi içinde mutlak konumlu (bkz. WaveTabBar.tsx): içerik tam
            ekran kaplıyor, kaydırıldığında bar'ın buzlu-cam bölgesinin
            arkasından görünüyor. */}
        <WaveTabBar />
      </View>
    </View>
  );

  if (!isBackSwipeRoute) return shell;

  return <BackSwipeContainer>{shell}</BackSwipeContainer>;
}

// native-stack'in `gestureEnabled`'ı yalnızca iOS'ta çalıştığı için geri jesti
// elle yazıldı.
//
// ÖNEMLİ: Burada sayfayı parmakla SAĞA ÖTELEMİYORUZ. Öteleme denendi ve şu
// hatayı veriyordu: react-native-screens, stack'te alttaki ekranı üstteki
// görünürken pasifleştiriyor; JS tarafında ötelediğimizde kütüphane bir geçiş
// yaşandığını bilmediği için altta ekran değil BOŞ zemin kalıyordu — kullanıcı
// "önce boş bi sayfa render oluyor sonra kayıyor" diye tarif etti. Artık jest
// eşiği geçer geçmez doğrudan `goBack()` çağrılıyor: geçişi native stack kendi
// yapıyor, yani geri gelirken gerçekten bir önceki sayfa görünüyor.
function BackSwipeContainer({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation();
  // Eşik aşıldıktan sonra parmak hareket ettikçe her karede tekrar
  // tetiklenmesin diye kilit — worklet tarafında tutuluyor ki runOnJS bir kez
  // çağrılsın.
  const fired = useSharedValue(false);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const pan = Gesture.Pan()
    .activeOffsetX(25)
    .failOffsetY([-15, 15])
    .onBegin(() => {
      fired.value = false;
    })
    .onChange((event) => {
      if (fired.value) return;
      if (event.translationX > BACK_SWIPE_DISTANCE || event.velocityX > BACK_SWIPE_VELOCITY) {
        fired.value = true;
        runOnJS(goBack)();
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}

// Stack.Screen'lere `component={withAppShell(SomeScreen)}` olarak veriliyor —
// her ekranı elle <AppShell><X/></AppShell> diye sarmalamak yerine tek satır.
export function withAppShell<P extends object>(Screen: React.ComponentType<P>) {
  function Wrapped(props: P) {
    return (
      <AppShell>
        <Screen {...props} />
      </AppShell>
    );
  }
  Wrapped.displayName = `withAppShell(${Screen.displayName || Screen.name || 'Screen'})`;
  return Wrapped;
}
