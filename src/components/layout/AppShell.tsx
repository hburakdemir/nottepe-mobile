import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from './AppHeader';
import KeyboardAvoider from './KeyboardAvoider';
import WaveTabBar from './WaveTabBar';
import ContentContainer from './ContentContainer';
import { useDrawerSwipeEnabled } from '../../navigation/drawerConstants';

// Web'de Navbar + MobileTabBar, Layout.jsx üzerinden HER rotada (detay
// sayfaları dahil) sabit kalıyor — burada da her PUSH edilen ekran bu kabukla
// sarmalanıyor. (Sekmelerin kendi kabuğu MainTabsScreen'de: orada AppHeader ve
// WaveTabBar Tab.Navigator'ın DIŞINDA durduğu için sekme geçişinde hiç
// kıpırdamıyorlar.)
//
export default function AppShell({ children }: { children: React.ReactNode }) {
  // AppShell tanım gereği YALNIZCA push edilmiş ekranları sarmalıyor (sekmelerin
  // kabuğu MainTabsScreen'de). Dolayısıyla burada çekmece kaydırması her zaman
  // kapalı: sol kenar tamamen iOS'un native geri jestine bırakılıyor. Ayrım
  // rota adı listesiyle değil mimariden geliyor — bkz. drawerConstants.ts.
  useDrawerSwipeEnabled(false);

  const shell = (
    <View style={{ flex: 1 }}>
      {/* Status bar'ın altındaki güvenli alan şeridi AppHeader'ın kendi arka
          planıyla birebir aynı renk olmalı, yoksa üstte farklı renkte bir
          şerit/dikiş görünür. */}
      <SafeAreaView edges={['top']} className="bg-surface">
        <AppHeader showBack />
      </SafeAreaView>

      <View style={{ flex: 1 }}>
        {/* Klavye açıldığında SAYFA yukarı itiliyor, tab bar itilmiyor: bar
            klavyenin altında kalıyor (bkz. KeyboardAvoider.tsx).
            `ContentContainer` telefonda hiçbir şey değiştirmiyor (tam
            genişlik); tablette/iPad'de içeriği ortalayıp yatayda sınırlıyor —
            bkz. o dosya. */}
        <KeyboardAvoider>
          <ContentContainer>{children}</ContentContainer>
        </KeyboardAvoider>
        {/* Bar kendi içinde mutlak konumlu (bkz. WaveTabBar.tsx): içerik tam
            ekran kaplıyor, kaydırıldığında bar'ın buzlu-cam bölgesinin
            arkasından görünüyor. */}
        <WaveTabBar />
      </View>
    </View>
  );

  return shell;
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
