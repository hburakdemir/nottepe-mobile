import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AuthNavigator from './AuthNavigator';
import { withAppShell } from '../components/layout/AppShell';
import MenuDrawerContent from '../components/layout/MenuDrawerContent';
import PushableStack from '../components/layout/PushableStack';
import { DRAWER_WIDTH, EDGE_SWIPE_WIDTH, ROOT_DRAWER_ID } from './drawerConstants';
import { getTabAnimationDirection } from './tabAnimationDirection';
import HomeScreen from '../screens/main/HomeScreen';
import DepartmentsScreen from '../screens/main/DepartmentsScreen';
import AddPostScreen from '../screens/main/AddPostScreen';
import ToolsScreen from '../screens/main/ToolsScreen';
import PostDetailScreen from '../screens/main/PostDetailScreen';
import DepartmentDetailScreen from '../screens/main/DepartmentDetailScreen';
import SavedPostsScreen from '../screens/main/SavedPostsScreen';
import UserProfileScreen from '../screens/main/UserProfileScreen';
import ChecklistsScreen from '../screens/main/ChecklistsScreen';
import AktsCalculatorScreen from '../screens/main/AktsCalculatorScreen';
import ScheduleScreen from '../screens/main/ScheduleScreen';
import NoteRequestsScreen from '../screens/main/NoteRequestsScreen';
import FaqScreen from '../screens/main/FaqScreen';
import FaqDetailScreen from '../screens/main/FaqDetailScreen';
import SuggestionsScreen from '../screens/main/SuggestionsScreen';
import SuggestionDetailScreen from '../screens/main/SuggestionDetailScreen';
import CafeteriaMenuScreen from '../screens/main/CafeteriaMenuScreen';
import Ego130ScheduleScreen from '../screens/main/Ego130ScheduleScreen';
import LeaderboardScreen from '../screens/main/LeaderboardScreen';
import HelpScreen from '../screens/main/HelpScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import KvkkGateModal from '../components/onboarding/KvkkGateModal';
import type { RootDrawerParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<RootDrawerParamList>();

export default function RootNavigator() {
  const { isAuthenticated, loading, user } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthNavigator />;
  }

  const needsOnboardingGate = !!user && (!user.kvkkConsentAt || !user.faculty || !user.department);

  // Web'de Navbar + MobileTabBar, Layout.jsx üzerinden HER rotada (Ana Sayfa,
  // Ekle, Profil, Faq — hepsi) sabit kalıyor. Burada artık ayrı bir
  // Tab.Navigator yok — tek düz bir stack, her ekran `withAppShell` ile
  // AppHeader+WaveTabBar'a sarmalanıyor. Menü artık bu stack'in bir route'u
  // değil — X (Twitter) tarzı, mevcut sayfayı iten gerçek bir Drawer.Navigator
  // (bkz. MenuDrawerContent.tsx + PushableStack.tsx). İtmeyi `drawerType: 'back'`
  // ile kütüphanenin kendisi yapıyor (aşağıdaki nota bkz.), PushableStack sadece
  // köşe yuvarlama + kenar çizgisi + kapatma katmanını ekliyor.
  const mainStack = (
    <Stack.Navigator
      initialRouteName="Home"
      // Native-stack başlığı HER ekranda kapalı: AppShell'in kendi AppHeader'ı
      // zaten sabit duruyordu, native başlık onun ALTINA ikinci bir satır
      // ekleyip üst menüyü aşağı kaydırıyordu. Tek başlık, sabit yükseklik.
      // Sayfa başlığı ve geri butonu bilinçli olarak yok (kullanıcı tercihi) —
      // gönderi/profil ekranlarında geri, sağa kaydırma jestiyle (AppShell).
      screenOptions={{
        animation: 'slide_from_right',
        headerShown: false,
      }}
    >
      {/* Bu 4 ekran WaveTabBar'ın sekmeleri — `options` bilinçli olarak fonksiyon:
          statik obje her seferinde aynı animasyonu dondururdu, fonksiyon ise
          her navigasyonda yeniden çağrılıp WaveTabBar'ın az önce yazdığı
          güncel yönü (getTabAnimationDirection) okuyor. Bar'ın 5. slotu olan
          Profil sekme değil PUSH edilen bir ekran (orada sağa kaydırma geri
          gidiyor), o yüzden burada değil, aşağıda varsayılan animasyonla. */}
      <Stack.Screen
        name="Home"
        component={withAppShell(HomeScreen)}
        options={() => ({ animation: getTabAnimationDirection() })}
      />
      <Stack.Screen
        name="Departments"
        component={withAppShell(DepartmentsScreen)}
        options={() => ({ animation: getTabAnimationDirection() })}
      />
      <Stack.Screen
        name="Tools"
        component={withAppShell(ToolsScreen)}
        options={() => ({ animation: getTabAnimationDirection() })}
      />
      <Stack.Screen
        name="CafeteriaMenu"
        component={withAppShell(CafeteriaMenuScreen)}
        options={() => ({ animation: getTabAnimationDirection() })}
      />
      <Stack.Screen name="AddPost" component={withAppShell(AddPostScreen)} />
      <Stack.Screen name="PostDetail" component={withAppShell(PostDetailScreen)} />
      <Stack.Screen name="DepartmentDetail" component={withAppShell(DepartmentDetailScreen)} />
      <Stack.Screen name="SavedPosts" component={withAppShell(SavedPostsScreen)} />
      <Stack.Screen name="UserProfile" component={withAppShell(UserProfileScreen)} />
      <Stack.Screen name="Checklists" component={withAppShell(ChecklistsScreen)} />
      <Stack.Screen name="AktsCalculator" component={withAppShell(AktsCalculatorScreen)} />
      <Stack.Screen name="Schedule" component={withAppShell(ScheduleScreen)} />
      <Stack.Screen name="NoteRequests" component={withAppShell(NoteRequestsScreen)} />
      <Stack.Screen name="Ego130Schedule" component={withAppShell(Ego130ScheduleScreen)} />
      <Stack.Screen name="Faq" component={withAppShell(FaqScreen)} />
      <Stack.Screen name="FaqDetail" component={withAppShell(FaqDetailScreen)} />
      <Stack.Screen name="Suggestions" component={withAppShell(SuggestionsScreen)} />
      <Stack.Screen name="SuggestionDetail" component={withAppShell(SuggestionDetailScreen)} />
      <Stack.Screen name="Leaderboard" component={withAppShell(LeaderboardScreen)} />
      <Stack.Screen name="Help" component={withAppShell(HelpScreen)} />
      <Stack.Screen name="Notifications" component={withAppShell(NotificationsScreen)} />
      <Stack.Screen name="Profile" component={withAppShell(ProfileScreen)} />
    </Stack.Navigator>
  );

  // PushableStack, itilen içeriğin sol-üst/sol-alt köşesini yuvarlarken küçük
  // bir "çentik" açığa çıkarıyor — o çentiğin arkasında bizim renklendirdiğimiz
  // hiçbir View yoksa Android'in varsayılan (beyaz) pencere arka planı görünüyor.
  // Bu kök View, Drawer.Navigator'ın ardında her zaman temaya uygun bir zemin
  // sağlayarak o çentiği (ve benzer boşlukları) doğru renkte tutuyor.
  const rootBg = theme === 'dark' ? '#222831' : '#fff';

  return (
    <View style={{ flex: 1, backgroundColor: rootBg }}>
      {/* Menü panelinin kendi kutusu (react-native-drawer-layout) durum çubuğu
          şeridine kadar uzanmıyor — o şeritte hiçbir şey boyanmadığı için
          PushableStack'in üst-sol köşe yuvarlaması altındaki "çentik" hep
          rootBg'nin DEĞİL, Android'in kendi (temaya uymayan) zeminin görünmesine
          yol açıyordu. Menü genişliği kadar, durum çubuğu + köşe payı kadar
          yükseklikte sabit bir dolgu koyup o boşluğu kapatıyoruz. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: DRAWER_WIDTH,
          height: insets.top + 40,
          backgroundColor: rootBg,
        }}
      />
      <Drawer.Navigator
        id={ROOT_DRAWER_ID as never}
        screenOptions={{
          headerShown: false,
          // `front` iken react-native-drawer-layout, parmağın başlangıç x'i
          // panel genişliğinin sağındaysa paneli anında o kadar ileri fırlatan
          // bir "touchDistance" düzeltmesi uyguluyordu (Drawer.native.js ~232)
          // — menü parmağı takip etmiyor, kendini sağa atıyor gibi hissettiren
          // şey buydu ve ekranın ortasından açmayı imkânsız kılıyordu. `back`
          // tipinde o düzeltme hiç çalışmıyor: panel sabit durur, İÇERİK
          // parmakla birebir sağa itilir — zaten istediğimiz X (Twitter)
          // görünümü de bu. İtmeyi artık kütüphane yapıyor, PushableStack
          // sadece köşe yuvarlama/kenar çizgisi/kapatma katmanı olarak kaldı.
          drawerType: 'back',
          drawerPosition: 'left',
          overlayColor: 'transparent',
          // @react-navigation/drawer `drawerType: 'front'` iken kütüphane KENDİ
          // varsayılan köşe yuvarlamasını (16dp, sağ köşeler) drawer paneline
          // otomatik uyguluyor — biz PushableStack ile içeriği kendi yuvarlamamızla
          // önde gösterdiğimiz için bu ikinci/çakışan yuvarlama, panelin sağ
          // köşelerinde arkadaki (temaya uymayan gri) yüzeyi açığa çıkarıyordu.
          // 0'a sıfırlayıp tek yuvarlama kaynağını PushableStack'te bırakıyoruz.
          drawerStyle: {
            width: DRAWER_WIDTH,
            backgroundColor: 'transparent',
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
          },
          // Başlangıç değeri; odaklanan ekrana göre AppShell güncelliyor
          // (ana sayfada tam ekran genişliği, gönderi/profilde jest tamamen
          // kapalı — bkz. AppShell.tsx ve drawerConstants.ts).
          swipeEdgeWidth: EDGE_SWIPE_WIDTH,
        }}
        drawerContent={(props) => <MenuDrawerContent {...props} />}
      >
        <Drawer.Screen name="Main">{() => <PushableStack>{mainStack}</PushableStack>}</Drawer.Screen>
      </Drawer.Navigator>
      {needsOnboardingGate && <KvkkGateModal />}
    </View>
  );
}
