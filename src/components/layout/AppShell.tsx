import React, { useCallback } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from './AppHeader';
import WaveTabBar from './WaveTabBar';
import {
  BACK_SWIPE_DISTANCE,
  BACK_SWIPE_ROUTES,
  BACK_SWIPE_VELOCITY,
  EDGE_SWIPE_WIDTH,
  FULL_WIDTH_SWIPE_ROUTES,
  ROOT_DRAWER_ID,
} from '../../navigation/drawerConstants';

// Web'de Navbar + MobileTabBar, Layout.jsx üzerinden HER rotada (detay
// sayfaları dahil) sabit kalıyor — burada da her ekran bu kabukla sarmalanıyor.
// Push edilen ekranların native başlıkları kapalı (bkz. RootNavigator.tsx), bu
// yüzden AppHeader hiçbir yerde aşağı kaymıyor: ekranda tek başlık var.
//
// Jestler de burada, rotaya göre ayarlanıyor:
//  - Gönderi/profil ekranlarında sağa kaydırma GERİ gider (çekmece jesti kapalı).
//  - Ana sayfa/bölümler/araçlarda menü ekranın her yerinden çekilerek açılır.
//  - Diğer ekranlarda menü yalnızca sol kenar şeridinden açılır.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const routeName = useRoute().name;
  const navigation = useNavigation();
  const isBackSwipeRoute = BACK_SWIPE_ROUTES.includes(routeName);

  // Çekmecenin jest seçenekleri Drawer.Navigator'da tek bir yerde duruyor;
  // odaklanan ekran kendi ihtiyacını üst navigator'a yazıyor. (Drawer'ın tek bir
  // "Main" ekranı var, bu yüzden ekran bazlı screenOptions kullanılamıyor.)
  useFocusEffect(
    useCallback(() => {
      navigation.getParent(ROOT_DRAWER_ID as never)?.setOptions({
        swipeEnabled: !isBackSwipeRoute,
        swipeEdgeWidth: FULL_WIDTH_SWIPE_ROUTES.includes(routeName)
          ? Dimensions.get('window').width
          : EDGE_SWIPE_WIDTH,
      });
    }, [navigation, routeName, isBackSwipeRoute])
  );

  const shell = (
    <View style={{ flex: 1 }}>
      {/* Web'de Navbar viewport'un en tepesine kadar aynı renkte uzanır (sticky,
          boşluk yok) — burada da status bar'ın altındaki güvenli alan şeridi
          AppHeader'ın kendi arka planıyla birebir aynı renk olmalı, yoksa üstte
          farklı renkte bir şerit/dikiş görünür. */}
      <SafeAreaView edges={['top']} className="bg-primary dark:bg-darkbgbutton">
        <AppHeader />
      </SafeAreaView>

      <View style={{ flex: 1 }}>
        {children}

        {/* Tabbar artık içeriği ikiye bölen ayrı bir satır değil — ekranın en
            altında, içeriğin ÜZERİNDE yüzen mutlak konumlu bir katman. İçerik
            tam ekran kaplıyor, kaydırıldığında bar'ın buzlu-cam bölgesinin
            arkasından görünüyor. */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
          <WaveTabBar />
        </View>
      </View>
    </View>
  );

  if (!isBackSwipeRoute) return shell;

  return <BackSwipeContainer>{shell}</BackSwipeContainer>;
}

// native-stack'in `gestureEnabled`'ı yalnızca iOS'ta çalıştığı için geri jesti
// elle yazıldı: sayfa parmağı takip ediyor, eşiği geçince geri gidiyor, geçmezse
// yerine yaylanıyor.
function BackSwipeContainer({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation();
  const translateX = useSharedValue(0);
  const screenWidth = Dimensions.get('window').width;

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    // Geri gidilecek ekran yoksa (örn. stack'in ilk ekranı) sayfa ekran dışında
    // asılı kalmasın — yerine dönsün.
    translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
  }, [navigation, translateX]);

  const pan = Gesture.Pan()
    .activeOffsetX(25)
    .failOffsetY([-15, 15])
    .onChange((event) => {
      translateX.value = Math.max(0, event.translationX);
    })
    .onEnd((event) => {
      if (event.translationX > BACK_SWIPE_DISTANCE || event.velocityX > BACK_SWIPE_VELOCITY) {
        translateX.value = withTiming(screenWidth, { duration: 180 }, () => {
          runOnJS(goBack)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>
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
