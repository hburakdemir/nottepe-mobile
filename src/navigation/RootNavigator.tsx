import React, { useEffect } from 'react';
import { ActivityIndicator, Dimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useIsOffline } from '../hooks/useIsOffline';
import OfflineBanner from '../components/OfflineBanner';
import OfflineEgoScreen from '../components/OfflineEgoScreen';
import AuthNavigator from './AuthNavigator';
import { withAppShell } from '../components/layout/AppShell';
import MenuDrawerContent from '../components/layout/MenuDrawerContent';
import PushableStack from '../components/layout/PushableStack';
import MainTabsScreen from './MainTabsScreen';
import { useActiveRouteName } from './useActiveRouteName';
import {
  BACK_SWIPE_ROUTES,
  DRAWER_WIDTH,
  EDGE_SWIPE_WIDTH,
  FULL_WIDTH_SWIPE_ROUTES,
  NO_DRAWER_SWIPE_ROUTES,
  ROOT_DRAWER_ID,
} from './drawerConstants';
import AddPostScreen from '../screens/main/AddPostScreen';
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
import Ego130ScheduleScreen from '../screens/main/Ego130ScheduleScreen';
import LeaderboardScreen from '../screens/main/LeaderboardScreen';
import HelpScreen from '../screens/main/HelpScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import KvkkGateModal from '../components/onboarding/KvkkGateModal';
import type { RootDrawerParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<RootDrawerParamList>();

// Çekmecenin jest seçenekleri tek yerde duruyor (Drawer'ın tek bir "Main"
// ekranı var, bu yüzden ekran bazlı screenOptions kullanılamıyor). Eskiden bunu
// her ekranın AppShell'i kendi `useFocusEffect`'inde yapıyordu; sekmeler artık
// AppShell kullanmadığı için burada, o an odaklı ekrana bakarak yapılıyor.
function DrawerSwipeSync() {
  const navigation = useNavigation();
  const routeName = useActiveRouteName();

  useEffect(() => {
    if (!routeName) return;
    navigation.setOptions({
      swipeEnabled: !BACK_SWIPE_ROUTES.includes(routeName) && !NO_DRAWER_SWIPE_ROUTES.includes(routeName),
      swipeEdgeWidth: FULL_WIDTH_SWIPE_ROUTES.includes(routeName) ? Dimensions.get('window').width : EDGE_SWIPE_WIDTH,
    });
  }, [navigation, routeName]);

  return null;
}

export default function RootNavigator() {
  const { isAuthenticated, loading, user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isOffline = useIsOffline();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  if (!isAuthenticated) {
    // Giriş ekranı çevrimdışıyken zaten hiçbir işe yaramıyor (sunucuya
    // bağlanamıyor) — bu durumda tek çevrimdışı-güvenli ekrana (EGO 130)
    // doğrudan düşüyoruz. Girişten SONRAki çevrimdışı durum farklı: orada
    // ağacı tamamen değiştirmek yerine üstte bir banner beliriyor (bkz. altta).
    if (isOffline) {
      return <OfflineEgoScreen />;
    }
    return <AuthNavigator />;
  }

  const needsOnboardingGate = !!user && (!user.kvkkConsentAt || !user.faculty || !user.department);

  // Stack'in ilk ekranı artık tek tek sekmeler değil, sekmeleri barındıran
  // `MainTabs` (bkz. MainTabsScreen.tsx). Geri kalan her şey onun üstüne PUSH
  // ediliyor ve kendi kabuğunu `withAppShell` ile alıyor. Menü bu stack'in bir
  // route'u değil — X (Twitter) tarzı, mevcut sayfayı iten gerçek bir
  // Drawer.Navigator (bkz. MenuDrawerContent.tsx + PushableStack.tsx).
  const mainStack = (
    <Stack.Navigator
      initialRouteName="MainTabs"
      // Native-stack başlığı HER ekranda kapalı: AppHeader zaten sabit duruyor,
      // native başlık onun ALTINA ikinci bir satır ekleyip üst menüyü aşağı
      // kaydırıyordu. Tek başlık, sabit yükseklik. Sayfa adı AppHeader'ın
      // ortasında yazıyor (bkz. routeTitles.ts).
      screenOptions={{
        animation: 'slide_from_right',
        headerShown: false,
        // Ekranların altındaki varsayılan zemin de ana sayfanınkiyle aynı
        // olsun: yüklenirken kendi arka planını boyamayan ekranlarda (sadece
        // spinner gösterenler) arkada farklı bir gri kalmasın.
        contentStyle: { backgroundColor: colors.ground },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabsScreen} />
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
    </Stack.Navigator>
  );

  // PushableStack, itilen içeriğin sol-üst/sol-alt köşesini yuvarlarken küçük
  // bir "çentik" açığa çıkarıyor — o çentiğin arkasında bizim renklendirdiğimiz
  // hiçbir View yoksa Android'in varsayılan (beyaz) pencere arka planı görünüyor.
  // Bu kök View, Drawer.Navigator'ın ardında her zaman temaya uygun bir zemin
  // sağlayarak o çentiği (ve benzer boşlukları) doğru renkte tutuyor.
  const rootBg = colors.surface;

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
          // Başlangıç değeri; odaklanan ekrana göre DrawerSwipeSync güncelliyor.
          swipeEdgeWidth: EDGE_SWIPE_WIDTH,
        }}
        drawerContent={(props) => <MenuDrawerContent {...props} />}
      >
        <Drawer.Screen name="Main">
          {() => (
            <PushableStack>
              <DrawerSwipeSync />
              {mainStack}
            </PushableStack>
          )}
        </Drawer.Screen>
      </Drawer.Navigator>
      {/* Eskiden çevrimdışıyken tüm ağaç OfflineEgoGate ile değiştiriliyordu;
          `expo-network`in isConnected okuması gerçek cihazda ara sıra
          titreştiği için bu, ekranı sık sık tamamen unmount/remount edip
          (home feed'in yarıda kalması, donuk kalan spinner'lar gibi) bambaşka
          hatalara yol açıyordu. Artık ağaç hep aynı kalıyor, sadece üstüne bir
          şerit biniyor — bkz. OfflineBanner.tsx. */}
      {isOffline && (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <OfflineBanner />
        </View>
      )}
      {needsOnboardingGate && <KvkkGateModal />}
    </View>
  );
}
