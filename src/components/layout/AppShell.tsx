import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppHeader from './AppHeader';
import WaveTabBar from './WaveTabBar';
import type { RootStackParamList } from '../../navigation/types';

// Web'de Navbar + MobileTabBar, Layout.jsx üzerinden HER rotada (detay
// sayfaları dahil) sabit kalıyor — artık burada da ayrı bir Tab.Navigator yok,
// RootNavigator'daki her ekran bu kabukla sarmalanıyor (Menu hariç — o kendi
// transparentModal panel tasarımını koruyor, bkz. RootNavigator.tsx).
const EDGE_WIDTH = 56;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const openMenu = () => navigation.navigate('Menu');

  // Sağ kenardan sola kaydırınca Menu açılıyor — Android'in kendi sistem
  // geri/ana-ekran kenar jestiyle çakışmaması için dar değil, 56px'lik makul
  // bir şerit kullanıyoruz (gerçek cihazda test edilmeli, bkz. proje notları).
  const edgeSwipe = Gesture.Pan()
    .activeOffsetX(-10)
    .failOffsetY([-20, 20])
    .onEnd((e) => {
      if (e.translationX < -40 && e.velocityX < -200) {
        runOnJS(openMenu)();
      }
    });

  return (
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
        <GestureDetector gesture={edgeSwipe}>
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: EDGE_WIDTH }} />
        </GestureDetector>

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
