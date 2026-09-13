import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AppHeader from '../components/layout/AppHeader';
import KeyboardAvoider from '../components/layout/KeyboardAvoider';
import WaveTabBar from '../components/layout/WaveTabBar';
import ContentContainer from '../components/layout/ContentContainer';
import HomeScreen from '../screens/main/HomeScreen';
import DepartmentsScreen from '../screens/main/DepartmentsScreen';
import ToolsScreen from '../screens/main/ToolsScreen';
import CafeteriaMenuScreen from '../screens/main/CafeteriaMenuScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import { routeTitle } from './routeTitles';
import { useDrawerSwipeEnabled } from './drawerConstants';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

// HEPSİ MODÜL SEVİYESİNDE SABİT.
//
// Bunlar eskiden `<Tab.Navigator>` JSX'inin içinde satır içi duruyordu, yani
// MainTabsScreen her render olduğunda YENİ nesneler/fonksiyonlar üretiliyordu.
// Navigator bu prop'ların değiştiğini görüp kendini yeniden yapılandırıyordu —
// ve bu, sekme geçiş animasyonu SÜRERKEN olduğunda `'shift'` animasyonu baştan
// başlıyordu. Testçilerin "ekran direkt kaymıyor, 2 kere kayıyor" dediği şey
// buydu (bkz. docs/plans/2026-09-13-performans-teshis-ve-plan.md, madde 2).
//
// `animation: 'shift'` KASITLI OLARAK DURUYOR: giren/çıkan sahne yön farkına
// göre ±50px kayıyor, bu açık bir kullanıcı isteğiydi ("kayarak geçmeli").
// Bedeli var — React Navigation'ın açık hatası #12621 yüzünden bottom-tabs'te
// bir `animation` ayarlıyken `freezeOnBlur` devre dışı kalıyor, yani odakta
// olmayan sekmeler de render edilmeye devam ediyor. Kaldırmak 4 ekranı
// dondururdu ama animasyonu öldürürdü; bu takas kullanıcıya sorulmadan
// yapılmamalı.
const SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'shift',
  sceneStyle: { backgroundColor: 'transparent' },
} as const;

// Bar'ı Tab.Navigator'ın `tabBar`'ı olarak veriyoruz: bottom-tabs onu
// sahnelerin İÇİNDE değil KARDEŞİ olarak çizdiği için geçiş animasyonundan
// etkilenmiyor, ekranda sabit duruyor. AppHeader da aynı sebeple
// Tab.Navigator'ın dışında, aşağıdaki sarmalayıcının içinde.
const renderTabBar = () => <WaveTabBar />;

// WaveTabBar'ın 5 sekmesi. ESKİDEN bunlar da düz stack route'larıydı ve geçiş
// `StackActions.replace` ile yapılıyordu: her dokunuşta hedef ekran SIFIRDAN
// mount oluyor, bütün istekleri yeniden atıyordu — kullanıcının gördüğü
// "sayfa refresh oluyor" tam olarak buydu. Tab.Navigator sekmeleri mount'lu
// tuttuğu için artık geçiş veri tazelemeden oluyor.
//
// ⚠️ BU BİLEŞEN `React.memo`'LU VE ÖYLE KALMALI. Üstteki başlık (`activeTab`)
// her sekme değişiminde state güncelliyor; memo olmasaydı o güncelleme tüm
// navigator ağacını yeniden çizer ve yukarıda anlatılan çift animasyonu geri
// getirirdi. `onTabChange` çağrı yerinde bağımlılıksız `useCallback` —
// referansı sabit olmazsa memo hiçbir işe yaramaz.
const MainTabs = React.memo(function MainTabs({ onTabChange }: { onTabChange: (name: keyof MainTabParamList) => void }) {
  const screenListeners = React.useMemo(
    () => ({
      state: (e: { data: unknown }) => {
        const state = (e.data as { state?: { index: number; routes: { name: string }[] } })?.state;
        const name = state?.routes[state.index]?.name;
        if (name) onTabChange(name as keyof MainTabParamList);
      },
    }),
    [onTabChange]
  );

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenListeners={screenListeners}
      screenOptions={SCREEN_OPTIONS}
      tabBar={renderTabBar}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Departments" component={DepartmentsScreen} />
      <Tab.Screen name="Tools" component={ToolsScreen} />
      <Tab.Screen name="CafeteriaMenu" component={CafeteriaMenuScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
});

export default function MainTabsScreen() {
  // Üst bardaki sayfa adı için: Tab.Navigator'ın odaklı ekranı. AppHeader bunu
  // kendisi türetemiyor (bkz. AppHeader.tsx'teki not), navigator kendi state
  // olayından bildiriyor.
  const [activeTab, setActiveTab] = useState<keyof MainTabParamList>('Home');

  // Bağımlılıksız: `setActiveTab`'in kendisi zaten sabit, bu sarmalayıcının da
  // sabit kalması `MainTabs`'in memo'sunun tutmasının ÖN ŞARTI.
  const handleTabChange = useCallback((name: keyof MainTabParamList) => {
    setActiveTab((prev) => (prev === name ? prev : name));
  }, []);

  // Bu ekran stack'in KÖKÜ — geri gidilecek bir ekran yok, dolayısıyla sol
  // kenar boşta: soldan kaydırma menüyü açsın. Push edilmiş ekranlarda AppShell
  // bunu kapatıyor (bkz. drawerConstants.ts `useDrawerSwipeEnabled`).
  useDrawerSwipeEnabled(true);

  return (
    <View style={{ flex: 1 }}>
      {/* Web'de Navbar viewport'un en tepesine kadar aynı renkte uzanır (sticky,
          boşluk yok) — burada da status bar'ın altındaki güvenli alan şeridi
          AppHeader'ın kendi arka planıyla birebir aynı renk olmalı. */}
      <SafeAreaView edges={['top']} className="bg-surface">
        <AppHeader title={routeTitle(activeTab)} />
      </SafeAreaView>

      {/* Sekmelerin zemini uygulamanın ortak zemin rengi (`--ground`, bkz.
          theme/palette.ts): sekme kendi arka planını boyamadan yüklenirken
          bile arkada doğru renk duruyor. */}
      <View className="flex-1 bg-ground">
        {/* Klavye açılınca sekme içeriği yukarı itiliyor (bkz. KeyboardAvoider.tsx).
            Tab bar Tab.Navigator'ın kendi `tabBar` yuvasında olduğu için bu
            itmeden etkilenmiyor — klavyenin altında kalıyor. */}
        <KeyboardAvoider>
          <ContentContainer>
            <MainTabs onTabChange={handleTabChange} />
          </ContentContainer>
        </KeyboardAvoider>
      </View>
    </View>
  );
}
