import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Dimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useIsOffline } from '../hooks/useIsOffline';
import OfflineEgoScreen from '../components/OfflineEgoScreen';
import AuthNavigator from './AuthNavigator';
import { withAppShell } from '../components/layout/AppShell';
import MenuDrawerContent from '../components/layout/MenuDrawerContent';
import PushableStack, { PUSHABLE_STACK_CORNER_RADIUS } from '../components/layout/PushableStack';
import MainTabsScreen from './MainTabsScreen';
import { useActiveRouteName } from './useActiveRouteName';
import {
  BACK_SWIPE_ROUTES,
  EDGE_SWIPE_WIDTH,
  FULL_WIDTH_SWIPE_ROUTES,
  NO_DRAWER_SWIPE_ROUTES,
  ROOT_DRAWER_ID,
  useDrawerWidth,
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

// ÖNEMLİ: `withAppShell(...)` MODÜL kapsamında, bir kez çağrılıyor.
//
// Eskiden bu çağrılar aşağıdaki `mainStack` JSX'inin İÇİNDEYDİ; yani
// RootNavigator her render olduğunda her ekran için YENİ bir bileşen kimliği
// üretiliyordu. React Navigation `component` prop'unun değiştiğini görüp o an
// açık olan ekranı unmount edip yeniden mount ediyordu: gönderi detayı kendini
// baştan çekiyor, yorum taslağı ve kaydırma konumu siliniyor, kullanıcı bunu
// "sürekli refresh atıyor" diye görüyordu. RootNavigator ise sık render oluyor
// (auth context, tema, safe-area, çevrimdışı durumu). Sarmalayıcılar artık
// sabit; ekranlar yalnızca gerçekten değiştiklerinde yeniden mount ediliyor.
const AddPost = withAppShell(AddPostScreen);
const PostDetail = withAppShell(PostDetailScreen);
const DepartmentDetail = withAppShell(DepartmentDetailScreen);
const SavedPosts = withAppShell(SavedPostsScreen);
const UserProfile = withAppShell(UserProfileScreen);
const Checklists = withAppShell(ChecklistsScreen);
const AktsCalculator = withAppShell(AktsCalculatorScreen);
const Schedule = withAppShell(ScheduleScreen);
const NoteRequests = withAppShell(NoteRequestsScreen);
const Ego130Schedule = withAppShell(Ego130ScheduleScreen);
const Faq = withAppShell(FaqScreen);
const FaqDetail = withAppShell(FaqDetailScreen);
const Suggestions = withAppShell(SuggestionsScreen);
const SuggestionDetail = withAppShell(SuggestionDetailScreen);
const Leaderboard = withAppShell(LeaderboardScreen);
const Help = withAppShell(HelpScreen);
const Notifications = withAppShell(NotificationsScreen);

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
  const drawerWidth = useDrawerWidth();

  // ÖNEMLİ: `useMemo` erken `return`lerden ÖNCE, KOŞULSUZ çağrılıyor —
  // aksi hâlde (eskiden olduğu gibi, `if (!isAuthenticated) return ...`
  // bloğundan SONRA tanımlıydı) giriş/çıkış geçişinde bu render'da hook hiç
  // çağrılmamış olurdu: React'in "Rendered fewer hooks than expected" hatası
  // ya da daha sinsisi, hook sırasının kaymasıyla sessiz bozulma riski —
  // Kurallara Uygunluk (Rules of Hooks) ihlali. Yalnızca `colors.ground`'a
  // bağımlı olduğu için bu taşıma davranışı değiştirmiyor.
  //
  // Stack'in ilk ekranı artık tek tek sekmeler değil, sekmeleri barındıran
  // `MainTabs` (bkz. MainTabsScreen.tsx). Geri kalan her şey onun üstüne PUSH
  // ediliyor ve kendi kabuğunu `withAppShell` ile alıyor. Menü bu stack'in bir
  // route'u değil — X (Twitter) tarzı, mevcut sayfayı iten gerçek bir
  // Drawer.Navigator (bkz. MenuDrawerContent.tsx + PushableStack.tsx).
  // `screenOptions.contentStyle` render'dan render'a yeni bir nesne olduğu
  // için (ve Stack.Navigator'ın children'ı JSX olarak burada durduğu için),
  // bu ağacı `colors.ground` dışında bir şey DEĞİŞMEDEN yeniden yaratmıyoruz —
  // ekran bileşenleri artık modül seviyesinde sabit olsa da, gereksiz
  // yeniden oluşturma navigator'ın kendi iç state'ini (ör. gesture handler'lar)
  // her seferinde sıfırdan kurmasına yol açmasın diye.
  const mainStack = useMemo(
    () => (
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
        <Stack.Screen name="AddPost" component={AddPost} />
        <Stack.Screen name="PostDetail" component={PostDetail} />
        <Stack.Screen name="DepartmentDetail" component={DepartmentDetail} />
        <Stack.Screen name="SavedPosts" component={SavedPosts} />
        <Stack.Screen name="UserProfile" component={UserProfile} />
        <Stack.Screen name="Checklists" component={Checklists} />
        <Stack.Screen name="AktsCalculator" component={AktsCalculator} />
        <Stack.Screen name="Schedule" component={Schedule} />
        <Stack.Screen name="NoteRequests" component={NoteRequests} />
        <Stack.Screen name="Ego130Schedule" component={Ego130Schedule} />
        <Stack.Screen name="Faq" component={Faq} />
        <Stack.Screen name="FaqDetail" component={FaqDetail} />
        <Stack.Screen name="Suggestions" component={Suggestions} />
        <Stack.Screen name="SuggestionDetail" component={SuggestionDetail} />
        <Stack.Screen name="Leaderboard" component={Leaderboard} />
        <Stack.Screen name="Help" component={Help} />
        <Stack.Screen name="Notifications" component={Notifications} />
      </Stack.Navigator>
    ),
    [colors.ground]
  );

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  // TAM ÇEVRİMDIŞI KİLİDİ — giriş yapılmış/yapılmamış farkı ARTIK YOK.
  // Eskiden yalnızca giriş EKRANI çevrimdışıyken EGO 130'a düşüyordu; giriş
  // yapılmışken bir banner beliriyordu ama uygulamanın geri kalanı (notlar,
  // profiller, gönderiler) normal şekilde açılmaya çalışıp "yüklenemedi"
  // yığınına dönüşüyordu — kullanıcı isteği ("internet yoksa notlar
  // yüklenemedi profiller yüklenemedi gönderi yüklenemedi vs olmamalı",
  // "internet yokken uygulama açıldığında direkt 130 sayfasına yönlendirme
  // yapmalı") bunun HER İKİ durumda da olmasını istiyor. `useIsOffline` artık
  // titremeye karşı debounce'lu (bkz. o dosya) — eski gate'in kaldırılma
  // sebebi olan unmount/remount fırtınası ondan ve Faz 1'deki `withAppShell`
  // taşımasından beri artık güvenli. Bağlantı geri geldiğinde `isOffline`
  // `false`'a döndüğü an ağaç otomatik olarak normal hâline dönüyor.
  if (isOffline) {
    return <OfflineEgoScreen />;
  }

  if (!isAuthenticated) {
    return <AuthNavigator />;
  }

  const needsOnboardingGate = !!user && (!user.kvkkConsentAt || !user.faculty || !user.department);

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
          yükseklikte sabit bir dolgu koyup o boşluğu kapatıyoruz.
          Genişlik `DRAWER_WIDTH` DEĞİL, ona köşe yarıçapı eklenmiş hâli:
          tam `DRAWER_WIDTH`'te dursaydı bu yamanın kendi sağ kenarı,
          PushableStack'in köşe eğrisinin biraz ötesinde keskin bir renk
          sınırı olarak görünebilirdi — eğrinin ötesine taşırıyoruz. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: drawerWidth + PUSHABLE_STACK_CORNER_RADIUS,
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
            width: drawerWidth,
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
      {/* Eskiden burada `isOffline &&` ile üstte bir OfflineBanner belirirdi,
          ağaç bozulmadan. Artık `isOffline` bu bileşene hiç ulaşmıyor — yukarıda
          erken `return <OfflineEgoScreen />` var (bkz. yukarısı), yani tam
          kilit tüm giriş durumlarında geçerli. `OfflineBanner` bileşeni silinmedi:
          onun "İnternet bağlantınız yok / Ring seferlerini görmek ister
          misiniz?" metni ve ikonu artık StateView.tsx'in offline durumunda
          yeniden kullanılıyor. */}
      {needsOnboardingGate && <KvkkGateModal />}
    </View>
  );
}
