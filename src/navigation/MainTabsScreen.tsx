import React, { useState } from 'react';
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

// WaveTabBar'ın 5 sekmesi. ESKİDEN bunlar da düz stack route'larıydı ve geçiş
// `StackActions.replace` ile yapılıyordu: her dokunuşta hedef ekran SIFIRDAN
// mount oluyor, bütün istekleri yeniden atıyordu — kullanıcının gördüğü
// "sayfa refresh oluyor" tam olarak buydu. Tab.Navigator sekmeleri mount'lu
// tuttuğu için artık geçiş veri tazelemeden oluyor.
//
// `animation: 'shift'`: giren/çıkan sahne yön farkına göre ±50px kayıyor
// (bkz. bottom-tabs SceneStyleInterpolators.forShift) — "kayarak geçmeli".
//
// Bar'ı Tab.Navigator'ın `tabBar`'ı olarak veriyoruz: bottom-tabs onu
// sahnelerin İÇİNDE değil KARDEŞİ olarak çizdiği için geçiş animasyonundan
// etkilenmiyor, ekranda sabit duruyor. AppHeader da aynı sebeple
// Tab.Navigator'ın dışında, bu sarmalayıcının içinde.
export default function MainTabsScreen() {
  // Üst bardaki sayfa adı için: Tab.Navigator'ın odaklı ekranı. AppHeader bunu
  // kendisi türetemiyor (bkz. AppHeader.tsx'teki not), navigator kendi state
  // olayından bildiriyor.
  const [activeTab, setActiveTab] = useState<keyof MainTabParamList>('Home');

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
          <Tab.Navigator
            initialRouteName="Home"
            screenListeners={{
              state: (e) => {
                const state = (e.data as { state?: { index: number; routes: { name: string }[] } })?.state;
                const name = state?.routes[state.index]?.name;
                if (name) setActiveTab(name as keyof MainTabParamList);
              },
            }}
            screenOptions={{
              headerShown: false,
              animation: 'shift',
              sceneStyle: { backgroundColor: 'transparent' },
            }}
            tabBar={() => <WaveTabBar />}
          >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Departments" component={DepartmentsScreen} />
            <Tab.Screen name="Tools" component={ToolsScreen} />
            <Tab.Screen name="CafeteriaMenu" component={CafeteriaMenuScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
          </Tab.Navigator>
          </ContentContainer>
        </KeyboardAvoider>
      </View>
    </View>
  );
}
