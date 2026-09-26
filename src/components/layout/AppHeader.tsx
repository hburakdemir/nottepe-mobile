import React from 'react';
import { Image, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useDrawerStatus } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, ChevronLeft, Plus } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useActiveRouteName, useActiveRouteParam } from '../../navigation/useActiveRouteName';
import { routeTitle } from '../../navigation/routeTitles';
import { useMyAvatar } from '../../hooks/useMyAvatar';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';
import { useUnreadAnnouncements } from '../../hooks/useUnreadAnnouncements';
import AvatarDisplay from '../../components/avatar/AvatarDisplay';
import DeerIcon from '../icons/DeerIcon';
import type { RootStackParamList } from '../../navigation/types';

// Web'in Navbar.jsx'i `shadow-sm border-b border-gray-200` kullanıyor (satır
// ~202) — NativeWind'in `shadow-sm` class'ı yerine (Android'de elevation'ı
// güvenilir çevirmiyor, bkz. projedeki diğer SHADOW_MD sabitleri) Tailwind'in
// shadow-sm değerlerinin (0 1px 2px rgba(0,0,0,.05)) birebir RN karşılığı.
const SHADOW_SM = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
};

// Web'in Navbar'ından bilinçli bir sapma (kullanıcı isteği): solda menü
// avatarı, ortada BULUNULAN SAYFANIN ADI, sağda bildirim zili + yeni not
// ekleme butonu. Bar tek satır ve her ekranda aynı yükseklikte (push edilen
// ekranların native başlıkları kapalı, bkz. RootNavigator.tsx) — başlık o
// yüzden ikinci bir satır açmadan bu barın İÇİNE, mutlak konumlu ortalanmış
// bir katman olarak konuyor (soldaki avatar ve sağdaki iki buton farklı
// genişlikte olduğu için `flex-1` ile ortalamak başlığı hep hafif kaydırırdı).
// `showBack`: PUSH edilen ekranlarda (AppShell) soldaki menü avatarının yerine
// geri oku çizilir; sekmelerde (MainTabsScreen) avatar kalır. Ayrım route adı
// listesiyle değil mimariden geliyor — AppHeader zaten yalnızca bu iki yerden
// render ediliyor ve AppShell tanım gereği yalnızca push edilen ekranları
// sarmalıyor. Push edilen ekranlarda menü artık açılamıyor (kullanıcı kararı):
// kullanıcı geri gelip sekmeye döndüğünde avatar yine orada.
// `brand`: Ana Sayfa'da ortada sayfa adı yerine logo + "Nottepe" (kullanıcı
// isteği) — diğer sekmelerde ve push edilen ekranlarda yazılı başlık kalıyor.
function AppHeaderBase({
  title: titleOverride,
  showBack = false,
  brand = false,
}: { title?: string; showBack?: boolean; brand?: boolean } = {}) {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const avatar = useMyAvatar();
  // Telefonun ana ekranındaki uygulama rozeti (bkz. usePushNotifications.ts)
  // Aktivite + Duyuru TOPLAMINI gösteriyor. Bu zil eskiden yalnız Aktivite
  // sayısını gösteriyordu — ikisi farklı kaynaktan geldiği için ana ekran
  // rozetiyle içerideki zil hiç eşleşmiyordu ("ana ekranda 2 yazıyor, içeride
  // 1" şikayeti). Menüdeki zil/megafon ayrımı (bkz. MenuDrawerContent) kasıtlı
  // kalıyor — orası zaten iki ayrı satır; burası TEK zil olduğu için OS
  // rozetiyle aynı toplamı göstermesi gerekiyor.
  const activityUnread = useUnreadNotifications();
  const announcementsUnread = useUnreadAnnouncements();
  const unreadCount = activityUnread + announcementsUnread;
  // Menü açıkken bu avatar, itilen sayfanın en sol kenarında (görünen dar
  // şeritte) tuhafça görünür kalıyordu — X'te menü açılınca tetikleyici
  // ortadan kayboluyor.
  //
  // BU GİZLEME ESKİDEN REANIMATED'DI VE AVATARIN BASILAMAMASININ SEBEBİ TAM
  // OLARAK OYDU: `useDrawerProgress()` + `useAnimatedStyle` ile YALNIZCA
  // `opacity` animasyonlayan bir `Animated.View` avatarı sarıyordu. Reanimated,
  // animasyonlanan stilde hiçbir LAYOUT prop'u yoksa shadow tree'ye commit
  // atlıyor; içteki Pressable de Fabric'in hit-test ağacında doğru konumunu
  // hiç alamıyor ve dokunuş almıyor. Bu, react-native-drawer-layout'un kendi
  // kaynağında da bir FIXME olarak yazılı (`Drawer.native.tsx`, drawerAnimatedStyle:
  // "Reanimated skips committing to the shadow tree if no layout props are
  // animated / This results in pressables not getting their correct position
  // and can't be pressed") — kütüphane bunu `zIndex`'i de animasyonlayarak
  // aşmak zorunda kalmış.
  //
  // Aynı bardaki zil ve artı butonları (sargısız, aynı Pressable, aynı satır)
  // sorunsuz çalışıyordu: teşhisi kesinleştiren asimetri buydu. Artık düz bir
  // View + düz bir `opacity` var, animasyon yok. Kayıp yalnızca yumuşak solma;
  // çekmece animasyonunun altında fark edilmiyor.
  const isDrawerOpen = useDrawerStatus() === 'open';

  const inkColor = theme === 'dark' ? '#DFD0B8' : '#374151';
  const brandColor = theme === 'dark' ? '#5A9690' : '#2F5755';
  // Üçü de İLKEL değer döndürüyor. Eskiden burada route'un tamamını döndüren
  // tek bir `useActiveRoute()` vardı ve her navigasyon commit'inde bu barı
  // zorla yeniden render ettiriyordu — sebebi useActiveRouteName.ts'te yazılı,
  // özeti: yeni nesne kimliği `Object.is`'i hep bozuyordu.
  const activeRouteName = useActiveRouteName();
  const activeUsername = useActiveRouteParam('username');
  const activeFaculty = useActiveRouteParam('faculty');
  // Bir başkasının profilinde sabit "Profil" yerine kullanıcı adı yazıyor
  // (kullanıcı isteği) — başlık route adından değil parametresinden geliyor.
  //
  // `titleOverride`: sekmelerin başlığı BURADAN türetilemiyor. AppHeader,
  // Tab.Navigator'ın DIŞINDA (MainTabsScreen'de) duruyor; oradaki
  // `useNavigationState` stack'in durumunu veriyor ve odaklı route hep
  // "MainTabs" çıkıyor — iç içe sekme durumu üst navigator'ın state'ine
  // güvenilir biçimde yansımıyor. Bu yüzden sekme adını MainTabsScreen kendi
  // `screenListeners`'ıyla izleyip başlığı hazır veriyor.
  const derivedTitle =
    activeRouteName === 'UserProfile' && activeUsername !== undefined
      ? activeUsername
      : activeRouteName === 'DepartmentDetail' && activeFaculty !== undefined
        ? activeFaculty
        : routeTitle(activeRouteName);
  const title = titleOverride ?? derivedTitle;

  return (
    <View className="bg-surface border-b border-line-soft" style={SHADOW_SM}>
      <View className="h-16 flex-row items-center px-4">
        {brand ? (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center px-20">
            {/* Logodaki N kelimenin ilk harfi — yazı bitişik "ottepe"; altında
                sayfanın adı. */}
            <View className="flex-row items-center">
              <Image source={require('../../../assets/icon.png')} style={{ width: 30, height: 30, borderRadius: 6 }} />
              <Text className="text-ink text-[25px] font-extrabold" style={{ marginLeft: 1, letterSpacing: 0.2 }}>
                ottepe
              </Text>
            </View>
            {!!title && <Text className="text-ink text-[14px] font-bold mt-0.5">{title}</Text>}
          </View>
        ) : !!title && (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center px-20">
            <Text className="text-ink text-[16px] font-bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {title}
              
            </Text>
          </View>
        )}

        {showBack ? (
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityLabel="Geri"
            className="w-9 h-9 -ml-2 rounded-full items-center justify-center"
          >
            <ChevronLeft size={26} color={inkColor} />
          </Pressable>
        ) : (
          <View style={{ opacity: isDrawerOpen ? 0 : 1 }} pointerEvents={isDrawerOpen ? 'none' : 'auto'}>
            <Pressable
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              hitSlop={8}
              accessibilityLabel="Menü"
              className="w-9 h-9 rounded-full overflow-hidden items-center justify-center bg-accent-soft"
            >
              {avatar ? <AvatarDisplay avatar={avatar} size={34} showBg={false} /> : <DeerIcon size={20} color={brandColor} />}
            </Pressable>
          </View>
        )}

        <View className="flex-1" />

        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => navigation.navigate('Notifications', { initialTab: 'aktivite' })}
            hitSlop={8}
            // `w-9 h-9 items-center justify-center` (eskiden yalnız `p-2`):
            // Pressable padding'e göre SIKI sarıyordu, yani zil ikonu kutunun
            // köşesine bitişikti — rozeti köşede DIŞARI (`-top -right`) taşısak
            // bile aradaki boşluk ~2px'de kalıyor, iki haneli sayıda rozet zilin
            // kubbesine biniyordu ("rozette sayı varken zil ikonu bozuluyor"
            // şikayeti). Sabit boyutlu, ortalanmış bir kutu zili küçültüp
            // ortalıyor, köşelerde gerçek boşluk bırakıyor — MenuDrawerContent'teki
            // zil/megafon rozetleriyle aynı desen.
            className="w-9 h-9 rounded-full items-center justify-center"
            accessibilityLabel="Bildirimler"
          >
            <Bell size={22} color={inkColor} />
            {/* Okunmamış bildirim sayısı zilin ÜSTÜNDE (kullanıcı isteği).
                Aktivite + Duyuru toplamı — ana ekrandaki uygulama rozetiyle
                (bkz. hooks/usePushNotifications.ts) aynı sayı. */}
            {unreadCount > 0 && (
              // İki haneli sayılarda (artık Aktivite+Duyuru TOPLAMI gösterildiği
              // için çok daha sık) rozet genişliği zilin kendi genişliğine
              // yaklaşıyor — sadece köşeye kaydırmak (-top/-right) yetmiyordu,
              // rozet yine kubbenin çoğunu yutuyordu (bkz. uiautomator bounds
              // karşılaştırması: rozet [918,971], ikon [919,963] — neredeyse tam
              // örtüşme). Daha dar dolgu + daha küçük yazı + daha büyük dışa
              // taşma bunu gerçek bir köşe rozetine indiriyor.
              <View className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-[3px] rounded-full bg-red-500 items-center justify-center border-2 border-surface">
                <Text className="text-white text-[9px] font-bold" numberOfLines={1}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>

          {/* Ekleme artık tab bar'da değil (orası Yemek Listesi + profil avatarına
              ayrıldı, bkz. WaveTabBar.tsx) — zilin sağında. */}
          <Pressable onPress={() => navigation.navigate('AddPost')} hitSlop={8} className="p-2 rounded-full" accessibilityLabel="Not ekle">
            <Plus size={24} color={inkColor} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Bu bar İKİ yerde duruyor: `MainTabsScreen`'de kalıcı olarak ve push edilen her
// ekranda `AppShell` içinde. Prop'ları ilkel (`title`, `showBack`, `brand`), dolayısıyla
// memo gerçekten tutuyor — ebeveyn başka bir sebeple render olduğunda (ör.
// `MainTabsScreen`'in `setActiveTab`'i) bar ve altındaki avatar yeniden
// kurulmuyor.
//
// `AppShell`, `ContentContainer` ve `KeyboardAvoider` BİLEREK memo'lanmadı:
// üçü de `children` alıyor ve o element ebeveynin her render'ında yeniden
// oluşuyor, yani memo hiçbir zaman tutmaz — işe yaramaz bir karşılaştırma
// eklemek sonraki okuyucuyu yanıltır.
export default React.memo(AppHeaderBase);
