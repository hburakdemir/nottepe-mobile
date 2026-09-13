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
// `animation: 'shift'` kalıcı (kullanıcı kararı: "kayma animasyonu kalmalı").
// Bir zamanlar bunun bedeli olduğunu yazmıştım — React Navigation #12621,
// "bottom-tabs'te `animation` varken `freezeOnBlur` devre dışı kalır". O BİLGİ
// ARTIK GEÇERSİZ: kurulu @react-navigation/bottom-tabs 7.18.18'de
// BottomTabView, `shouldFreeze`'i yalnızca animasyon SÜRERKEN (`isAnimatingRoute`)
// bastırıyor, animasyon bitince odakta olmayan sekme yine donduruluyor. Yani
// "kayma mı, dondurma mı" diye bir takas yok; ikisi bir arada çalışıyor.
//
// `freezeOnBlur: false` ise BİLEREK: aşağıdaki nota bak.
//
// Sekmelerde react-freeze KAPALI (madde 3'ün teşhisi).
// `App.tsx`'teki `enableFreeze(true)` her Screen'in `freezeOnBlur` VARSAYILANINI
// true yapıyor (react-native-screens Screen.tsx: `freezeOnBlur = freezeEnabled()`).
// Bu, odakta olmayan 4 sekmeyi Suspense ile donduruyor — ve Android'de arka
// plandan/kilit ekranından dönüşte bar'ın görünür ama dokunulamaz kalmasının
// belgelenmiş sebebi tam olarak bu:
//   · react-native-screens#1478 — tekrar adımları birebir testçilerin tarifi:
//     enableFreeze(true) → ekranı kilitle → aç → her şey takılı kalıyor
//   · react-native-screens#2384 — "enableFreeze cause to bottom tab navigator
//     unresponsive": bar görünür kalıyor, dokunuşlar sekmeyi değiştirmiyor
//   · react-native-screens#2150 — Fabric + bottom-tabs: "dokunulabilirlerin
//     hepsi donuyor, ANİMASYONLAR ÇALIŞMAYA DEVAM EDİYOR" — "bar duruyor ama
//     tepki vermiyor" tablosunun aynısı
// `enableFreeze(true)` genel olarak AÇIK kalıyor (push edilen stack ekranları
// için kazancı gerçek ve orada bu hata belgelenmemiş); yalnızca sekmelerde
// kapatıyoruz. Sekmeler zaten `detachInactiveScreens` varsayılanıyla native
// tarafta ayrılıyor, dolayısıyla kaybedilen şey sadece JS re-render'ı.
const SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'shift',
  freezeOnBlur: false,
  sceneStyle: { backgroundColor: 'transparent' },
} as const;

// Tab.Navigator'ın kendi `tabBar` yuvası BOŞ bırakılıyor; bar aşağıda
// navigator'ın kardeşi olarak çiziliyor. Sebebi aşağıdaki nota yazılı.
const renderNoTabBar = () => null;

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
      tabBar={renderNoTabBar}
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
        {/* Klavye açılınca sekme içeriği yukarı itiliyor (bkz. KeyboardAvoider.tsx). */}
        <KeyboardAvoider>
          <ContentContainer>
            <MainTabs onTabChange={handleTabChange} />
          </ContentContainer>
        </KeyboardAvoider>

        {/* BAR, `KeyboardAvoider`'IN DIŞINDA — ve Tab.Navigator'ın da dışında.
            Buradaki eski yorum "tab bar kendi `tabBar` yuvasında olduğu için
            klavye itmesinden etkilenmiyor" diyordu; YANLIŞTI. `tabBar` yuvası
            Tab.Navigator'ın İÇİ, Tab.Navigator da KeyboardAvoider'ın içindeydi
            — yani bar da itiliyordu. Klavye açıkken bar kendini gizlediği için
            gözle fark edilmiyordu, ta ki KeyboardAvoider Android'de gerçekten
            çalışmaya başlayana kadar: eskiden RN'in kendi KeyboardAvoidingView'ı
            Android'de hiçbir şey yapmıyordu, şimdi keyboard-controller yerleşimi
            Reanimated ile UI thread'inde sürüyor. Arka plandan dönüşte o
            animasyon bayat bir değerde takılı kalırsa bar ESKİ YERİNDE ÇİZİLİR
            ama dokunma alanı başka yerde kalır — "duruyor ama tepki vermiyor"un
            ikinci olası kaynağı tam olarak bu. AppShell bar'ı zaten baştan
            böyle, KeyboardAvoider'ın kardeşi olarak çiziyordu; iki montaj yeri
            artık yapı olarak birebir aynı.
            Bar mutlak konumlu, o yüzden normal akışta yer kaplamıyor; aktif
            sekmeyi kendisi türetemediği için (kök stack'i görür) prop'la
            veriliyor — bkz. WaveTabBar.tsx. */}
        <WaveTabBar activeRouteName={activeTab} />
      </View>
    </View>
  );
}
