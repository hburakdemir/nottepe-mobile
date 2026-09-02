import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from './AppHeader';
import WaveTabBar from './WaveTabBar';

// Web'de Navbar + MobileTabBar, Layout.jsx üzerinden HER rotada (detay
// sayfaları dahil) sabit kalıyor — burada da her ekran bu kabukla sarmalanıyor.
// Menü artık RootNavigator'daki bir Drawer.Navigator (bkz. o dosya) — soldan
// kenar kaydırma jesti de Drawer'ın kendi `swipeEdgeWidth`'i tarafından
// karşılanıyor, burada özel bir GestureDetector'a gerek kalmadı.
export default function AppShell({ children }: { children: React.ReactNode }) {
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
