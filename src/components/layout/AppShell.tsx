import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react-native';
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
// Ekranın üst barı ve sekme çubuğunu geçici olarak gizlemesi için (kampüs
// haritasının tam ekranı). Ekran yeniden mount edilmiyor, yalnızca kabuk
// parçaları kalkıyor — haritanın kamerası ve seçimi korunuyor. Ekran unmount
// olurken `false`a döndürmek ekranın işi.
const ChromeHiddenContext = createContext<((hidden: boolean) => void) | null>(null);
export const useSetAppShellChromeHidden = () => useContext(ChromeHiddenContext);

// Üst bardaki "+" düğmesini ekran açıkken başka bir eyleme bağlamak için.
// Yalnızca AKTS hesaplayıcı kullanıyor ("+" orada belge yükleyiciyi açıyor —
// kullanıcı isteği); öteki ekranlarda "+" yine Not ekle.
export type HeaderAddAction = { label: string; icon: LucideIcon; onPress: () => void };
const HeaderAddContext = createContext<((action: HeaderAddAction | null) => void) | null>(null);
export function useAppShellHeaderAdd(label: string, icon: LucideIcon, onPress: () => void) {
  const set = useContext(HeaderAddContext);
  // Ekranın fonksiyonu her render'da yeni olabilir; kayıt bir kez, çağrı en güncele.
  const fn = useRef(onPress);
  fn.current = onPress;
  useEffect(() => {
    if (!set) return undefined;
    set({ label, icon, onPress: () => fn.current() });
    return () => set(null);
  }, [set, label, icon]);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  // AppShell tanım gereği YALNIZCA push edilmiş ekranları sarmalıyor (sekmelerin
  // kabuğu MainTabsScreen'de). Dolayısıyla burada çekmece kaydırması her zaman
  // kapalı: sol kenar tamamen iOS'un native geri jestine bırakılıyor. Ayrım
  // rota adı listesiyle değil mimariden geliyor — bkz. drawerConstants.ts.
  useDrawerSwipeEnabled(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [addAction, setAddAction] = useState<HeaderAddAction | null>(null);

  const shell = (
    <View style={{ flex: 1 }}>
      {/* Status bar'ın altındaki güvenli alan şeridi AppHeader'ın kendi arka
          planıyla birebir aynı renk olmalı, yoksa üstte farklı renkte bir
          şerit/dikiş görünür. */}
      {/* `display: none`: gizliyken de mount'lu kalsın, açılınca yeniden kurulmasın. */}
      <SafeAreaView edges={['top']} className="bg-surface" style={chromeHidden ? { display: 'none' } : undefined}>
        <AppHeader showBack addAction={addAction} />
      </SafeAreaView>

      <View style={{ flex: 1 }}>
        {/* Klavye açıldığında SAYFA yukarı itiliyor, tab bar itilmiyor: bar
            klavyenin altında kalıyor (bkz. KeyboardAvoider.tsx).
            `ContentContainer` telefonda hiçbir şey değiştirmiyor (tam
            genişlik); tablette/iPad'de içeriği ortalayıp yatayda sınırlıyor —
            bkz. o dosya. */}
        <KeyboardAvoider>
          <ContentContainer>
            <ChromeHiddenContext.Provider value={setChromeHidden}>
              <HeaderAddContext.Provider value={setAddAction}>{children}</HeaderAddContext.Provider>
            </ChromeHiddenContext.Provider>
          </ContentContainer>
        </KeyboardAvoider>
        {/* Bar kendi içinde mutlak konumlu (bkz. WaveTabBar.tsx): içerik tam
            ekran kaplıyor, kaydırıldığında bar'ın buzlu-cam bölgesinin
            arkasından görünüyor. */}
        {!chromeHidden && <WaveTabBar />}
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
