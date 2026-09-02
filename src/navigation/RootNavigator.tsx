import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AuthNavigator from './AuthNavigator';
import { withAppShell } from '../components/layout/AppShell';
import BackButton from '../components/layout/BackButton';
import MenuDrawerContent from '../components/layout/MenuDrawerContent';
import PushableStack from '../components/layout/PushableStack';
import { DRAWER_WIDTH } from './drawerConstants';
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

  // Push edilen ekranların (Bildirimler, Faq vb.) native başlığı web'de hiç yok
  // — mobile-özel bir eklenti. AppHeader'ın koyu markasıyla tutarlı olsun diye
  // varsayılan beyaz native-stack başlığı yerine tema token'larıyla eşleniyor.
  const headerBg = theme === 'dark' ? '#222831' : '#FFFFFF';
  const headerTint = theme === 'dark' ? '#DFD0B8' : '#111827';

  // Web'de Navbar + MobileTabBar, Layout.jsx üzerinden HER rotada (Ana Sayfa,
  // Ekle, Profil, Faq — hepsi) sabit kalıyor. Burada artık ayrı bir
  // Tab.Navigator yok — tek düz bir stack, her ekran `withAppShell` ile
  // AppHeader+WaveTabBar'a sarmalanıyor. Menü artık bu stack'in bir route'u
  // değil — X (Twitter) tarzı, mevcut sayfayı iten gerçek bir Drawer.Navigator
  // (bkz. MenuDrawerContent.tsx + PushableStack.tsx). `drawerType: 'front'`
  // içeriğe hiç dokunmuyor, itme/küçülme/köşe/gölge kartını PushableStack elle
  // sürüyor — react-navigation'ın `back`/`slide` tipleri kendi sabit
  // translateX'ini dayattığı için bu özel kart efektine izin vermiyordu.
  const mainStack = (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        animation: 'slide_from_right',
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: headerTint,
        headerShadowVisible: false,
        headerLeft: (props) => <BackButton tintColor={props.tintColor} />,
      }}
    >
      {/* Bu 4 ekran WaveTabBar'ın sekmeleri — `options` bilinçli olarak fonksiyon:
          statik obje her seferinde aynı animasyonu dondururdu, fonksiyon ise
          her navigasyonda yeniden çağrılıp WaveTabBar'ın az önce yazdığı
          güncel yönü (getTabAnimationDirection) okuyor. */}
      <Stack.Screen
        name="Home"
        component={withAppShell(HomeScreen)}
        options={() => ({ headerShown: false, animation: getTabAnimationDirection() })}
      />
      <Stack.Screen
        name="Departments"
        component={withAppShell(DepartmentsScreen)}
        options={() => ({ headerShown: false, animation: getTabAnimationDirection() })}
      />
      <Stack.Screen
        name="Tools"
        component={withAppShell(ToolsScreen)}
        options={() => ({ headerShown: false, animation: getTabAnimationDirection() })}
      />
      <Stack.Screen
        name="AddPost"
        component={withAppShell(AddPostScreen)}
        options={() => ({ headerShown: false, animation: getTabAnimationDirection() })}
      />
      <Stack.Screen name="PostDetail" component={withAppShell(PostDetailScreen)} options={{ title: 'Gönderi' }} />
      <Stack.Screen
        name="DepartmentDetail"
        component={withAppShell(DepartmentDetailScreen)}
        options={({ route }) => ({ title: route.params.department })}
      />
      <Stack.Screen name="SavedPosts" component={withAppShell(SavedPostsScreen)} options={{ title: 'Kaydedilenler' }} />
      <Stack.Screen
        name="UserProfile"
        component={withAppShell(UserProfileScreen)}
        options={({ route }) => ({ title: `@${route.params.username}` })}
      />
      <Stack.Screen name="Checklists" component={withAppShell(ChecklistsScreen)} options={{ title: 'Checklistler' }} />
      <Stack.Screen
        name="AktsCalculator"
        component={withAppShell(AktsCalculatorScreen)}
        options={{ title: 'AKTS / GANO Hesapla' }}
      />
      <Stack.Screen name="Schedule" component={withAppShell(ScheduleScreen)} options={{ title: 'Ders Programı' }} />
      <Stack.Screen name="NoteRequests" component={withAppShell(NoteRequestsScreen)} options={{ title: 'Not İstekleri' }} />
      <Stack.Screen name="Faq" component={withAppShell(FaqScreen)} options={{ title: 'Sık Sorulan Sorular' }} />
      <Stack.Screen name="FaqDetail" component={withAppShell(FaqDetailScreen)} options={{ title: 'Soru' }} />
      <Stack.Screen name="Suggestions" component={withAppShell(SuggestionsScreen)} options={{ title: 'Öneriler' }} />
      <Stack.Screen name="SuggestionDetail" component={withAppShell(SuggestionDetailScreen)} options={{ title: 'Öneri' }} />
      <Stack.Screen name="CafeteriaMenu" component={withAppShell(CafeteriaMenuScreen)} options={{ title: 'Yemek Listesi' }} />
      <Stack.Screen name="Leaderboard" component={withAppShell(LeaderboardScreen)} options={{ title: 'Liderlik Tablosu' }} />
      <Stack.Screen name="Help" component={withAppShell(HelpScreen)} options={{ title: 'Yardım' }} />
      <Stack.Screen name="Notifications" component={withAppShell(NotificationsScreen)} options={{ title: 'Bildirimler' }} />
      <Stack.Screen name="Profile" component={withAppShell(ProfileScreen)} options={{ title: 'Profil' }} />
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
        screenOptions={{
          headerShown: false,
          drawerType: 'front',
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
          swipeEdgeWidth: 56,
        }}
        drawerContent={(props) => <MenuDrawerContent {...props} />}
      >
        <Drawer.Screen name="Main">{() => <PushableStack>{mainStack}</PushableStack>}</Drawer.Screen>
      </Drawer.Navigator>
      {needsOnboardingGate && <KvkkGateModal />}
    </View>
  );
}
