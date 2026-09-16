import React, { Suspense, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useIsOffline } from '../hooks/useIsOffline';
import OfflineEgoScreen from '../components/OfflineEgoScreen';
import AuthNavigator from './AuthNavigator';
import { withAppShell } from '../components/layout/AppShell';
import MenuDrawerContent from '../components/layout/MenuDrawerContent';
import PushableStack from '../components/layout/PushableStack';
import MainTabsScreen from './MainTabsScreen';
import { EDGE_SWIPE_WIDTH, ROOT_DRAWER_ID, useDrawerWidth } from './drawerConstants';
import { STACK_ANIMATION } from './stackAnimation';
import AddPostScreen from '../screens/main/AddPostScreen';
import PostDetailScreen from '../screens/main/PostDetailScreen';
import DepartmentDetailScreen from '../screens/main/DepartmentDetailScreen';
import SavedPostsScreen from '../screens/main/SavedPostsScreen';
import UserProfileScreen from '../screens/main/UserProfileScreen';
import ChecklistsScreen from '../screens/main/ChecklistsScreen';
import AktsCalculatorScreen from '../screens/main/AktsCalculatorScreen';
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

// `ScheduleScreen` BİLEREK TEMBEL YÜKLENİYOR (tek istisna; diğer 17 ekran
// normal import). Sebep: o ekran `react-native-view-shot` kullanıyor ve o
// paketin spec'i `TurboModuleRegistry.getEnforcing` çağırıyor — native modül
// yoksa modül IMPORT EDİLİRKEN fırlatıyor. Bu dosya ScheduleScreen'i en üstte
// import ettiği için, view-shot'ın bulunmadığı ortamlarda (ör. Expo Go)
// uygulama daha açılış anında çöküyordu. `React.lazy` ile paket ancak kullanıcı
// Program ekranına girdiğinde çözümleniyor; böylece geliştirme sırasında EAS
// build harcamadan Expo Go üzerinden test edilebiliyor (Program ekranının
// görsel dışa aktarımı orada çalışmaz, gerçek derlemede çalışır).
// Yan fayda: açılışta bir modül daha az yükleniyor.
const ScheduleScreenLazy = React.lazy(() => import('../screens/main/ScheduleScreen'));

function ScheduleScreenSuspended() {
  // Fallback BİLEREK boş: bu bekleme ağ değil, JS modülünün çözülmesi — yerelde
  // milisaniyeler sürüyor. Çark koymak, ekran zaten açılmışken bir an dönüp
  // kaybolan bir göstergeye dönüşüyordu. Modül gelir gelmez ScheduleScreen
  // kendi iskeletini çiziyor (bkz. o dosyadaki `isLoading` dalı).
  return (
    <Suspense fallback={<View style={{ flex: 1 }} />}>
      <ScheduleScreenLazy />
    </Suspense>
  );
}

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
const Schedule = withAppShell(ScheduleScreenSuspended);
const NoteRequests = withAppShell(NoteRequestsScreen);
const Ego130Schedule = withAppShell(Ego130ScheduleScreen);
const Faq = withAppShell(FaqScreen);
const FaqDetail = withAppShell(FaqDetailScreen);
const Suggestions = withAppShell(SuggestionsScreen);
const SuggestionDetail = withAppShell(SuggestionDetailScreen);
const Leaderboard = withAppShell(LeaderboardScreen);
const Help = withAppShell(HelpScreen);
const Notifications = withAppShell(NotificationsScreen);

export default function RootNavigator() {
  const { isAuthenticated, loading, user } = useAuth();
  const { colors } = useTheme();
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
          // iOS'ta `default` OLMAK ZORUNDA — sebebi uzun ve kritik,
          // bkz. stackAnimation.ts. Kısaca: özel bir animasyon seçmek iOS'ta
          // kenardan geri kaydırmayı öldürüyor VE push edilmiş ekranlarda sol
          // kenara yakın butonların dokunuşlarını iptal ettiriyordu.
          animation: STACK_ANIMATION,
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

  // ÇEVRİMDIŞI KİLİDİ AĞACI DEĞİŞTİRMİYOR, ÜSTÜNE BİNİYOR.
  //
  // Eskiden burada `if (isOffline) return <OfflineEgoScreen />` vardı: kilit
  // devreye girdiğinde Drawer + Stack + Tab ağacının TAMAMI unmount oluyordu.
  // Bedeli iki yönlüydü. (1) `useIsOffline`'da 1,5 sn'lik bir debounce tutmak
  // ZORUNDAYDIK, çünkü ham okuma gerçek cihazda titriyor ve her titremede
  // uygulama yıkılıp yeniden kuruluyordu — algılama 3,5 saniyeye çıkıyordu.
  // (2) ASIL SORUN: Android ekran kapalıyken Wi-Fi'yi uykuya alıyor, dönüşte
  // yeniden ilişkilendirme 1-3 sn sürüyor ve o pencerede gelen `false` kilidi
  // bindirip tüm ağacı unmount ediyordu. Kullanıcı öne dönünce her ekran
  // sıfırdan kuruluyor, her sorgu yeniden çekiliyor, bütün avatarlar yeniden
  // çiziliyordu — "arka plana gir-çık yapınca donuyor" şikâyetinin yolu bu.
  //
  // Katman olarak çizince giriş/çıkış ucuzluyor: ağaç ayakta kalıyor, yalnızca
  // üstüne opak bir ekran biniyor. Böylece debounce 300 ms'ye, yoklama 750
  // ms'ye inebildi (bkz. useIsOffline.ts) ve algılama saniyenin altına düştü.
  //
  // Kullanıcının eski şikâyeti ("internet yoksa notlar yüklenemedi profiller
  // yüklenemedi olmamalı") ağaç ayakta kaldığı için geri dönebilirdi; onu
  // react-query'nin `onlineManager`'ı kapatıyor (bkz. useIsOffline.ts):
  // çevrimdışıyken sorgular DURAKLIYOR, istek atmıyor, hata ekranı üretmiyor.
  //
  // ⚠️ Sarmalayıcının arka planı YOK ve olmamalı: saydam kaldığı için
  // PushableStack'in köşe çentiğini boyamıyor (aşağıdaki `menuBg` notuna bak).
  const withOfflineOverlay = (node: React.ReactNode) => (
    <View style={{ flex: 1 }}>
      {node}
      {isOffline && (
        <View style={StyleSheet.absoluteFill}>
          <OfflineEgoScreen />
        </View>
      )}
    </View>
  );

  // Açılışta oturum kontrolü — depodan token okunuyor.
  if (loading) {
    return withOfflineOverlay(
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ground }}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  // Kilit giriş yapılmış/yapılmamış AYRIMI GÖZETMİYOR: katman her iki durumun
  // da üstüne biniyor, yani giriş ekranında da çevrimdışıyken EGO 130
  // görünüyor. Kullanıcı isteği buydu: "internet yokken uygulama açıldığında
  // direkt 130 sayfasına yönlendirme yapmalı."
  if (!isAuthenticated) {
    return withOfflineOverlay(<AuthNavigator />);
  }

  const needsOnboardingGate = !!user && (!user.kvkkConsentAt || !user.faculty || !user.department);

  // İTİLEN SAYFANIN ARKASINDA KALAN HER ŞEY MENÜNÜN ZEMİNİYLE AYNI RENK.
  //
  // PushableStack açılırken sol köşelerini yuvarlıyor; yuvarlamanın açtığı
  // "çentik" saydam kalıyor ve arkasındaki İLK OPAK katman ne ise onu
  // gösteriyor. Bu ağaçta o katman tek: aşağıdaki kök View. Rengi menü
  // panelinin rengiyle birebir aynı (MenuDrawerContent kökü `bg-surface`),
  // yani çentik menünün devamı gibi görünüyor ve köşe yuvarlaması kendini
  // yalnızca PushableStack'in kenar çizgisiyle belli ediyor.
  //
  // ⚠️ BU AĞACA İKİNCİ BİR OPAK KATMAN EKLEME. Daha önce burada üç ayrı zemin
  // vardı: kök View, üstte/altta tam genişlikte iki dolgu şeridi ve —asıl
  // sorun— PushableStack'in HEMEN ARKASINDA `flex: 1` opak bir View. O View
  // kırpılmadığı için çentiği de boyuyordu; itilen sayfanın sol kenarında
  // yukarıdan aşağı DÜZ bir çizgi oluşuyor ve köşe yuvarlamasını tamamen yok
  // ediyordu. Şeritler de gereksizdi: kök View zaten tüm ekranı aynı renkle
  // boyuyor. Zemin TEK katman kalmalı ve menüyle aynı renk olmalı.
  const menuBg = colors.surface;

  return withOfflineOverlay(
    <View style={{ flex: 1, backgroundColor: menuBg }}>
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
          // Şerit genişliği sabit. Jestin AÇIK/KAPALI olması ise ekrandan
          // geliyor: `MainTabsScreen` açıyor, `AppShell` (yani push edilmiş her
          // ekran) kapatıyor — bkz. drawerConstants.ts `useDrawerSwipeEnabled`.
          // Push edilmiş ekranlarda sol kenar tamamen iOS'un native geri
          // jestine ait olsun diye.
          swipeEdgeWidth: EDGE_SWIPE_WIDTH,
        }}
        drawerContent={(props) => <MenuDrawerContent {...props} />}
      >
        <Drawer.Screen name="Main">
          {() => (
            // BU VIEW'A ARKA PLAN VERME — sadece düzen (flex) için burada.
            // Opak bir zemin verilirse köşe çentiği de boyanır ve yuvarlama
            // düz bir kenara döner; çentik kasten saydam bırakılıp arkadaki
            // kök `menuBg` katmanının görünmesi sağlanıyor.
            <View style={{ flex: 1 }}>
              <PushableStack>{mainStack}</PushableStack>
            </View>
          )}
        </Drawer.Screen>
      </Drawer.Navigator>
      {/* Eskiden burada `isOffline &&` ile üstte bir OfflineBanner belirirdi.
          Artık çevrimdışı durumu bu ağaçta hiç ele alınmıyor: tam kilit
          `withOfflineOverlay` ile bu ağacın ÜSTÜNE biniyor (bkz. yukarısı) ve
          tüm giriş durumlarında geçerli. `OfflineBanner` bileşeni silinmedi:
          onun "İnternet bağlantınız yok / Ring seferlerini görmek ister
          misiniz?" metni ve ikonu artık StateView.tsx'in offline durumunda
          yeniden kullanılıyor. */}
      {/* `!isOffline` ŞART. Bu bir RN `Modal`, yani native olarak AYRI bir
          pencerede, çevrimdışı katmanının bile ÜSTÜNDE çiziliyor — katman onu
          kapatamaz. Kilit eskiden tüm ağacı unmount ettiği için bu modal
          çevrimdışıyken hiç mount olmuyordu; katmana geçişle mount olabilir
          hâle geldi. Çevrimdışıyken göstermek anlamsız: KVKK onayı ve
          fakülte/bölüm kaydı sunucuya yazılıyor, istekler de duraklatılmış
          durumda (bkz. useIsOffline.ts `onlineManager`) — kullanıcı formu
          doldurup hiçbir şey olmadığını görürdü. */}
      {needsOnboardingGate && !isOffline && <KvkkGateModal />}
    </View>
  );
}
