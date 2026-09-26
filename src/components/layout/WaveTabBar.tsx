import React, { useEffect } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { Home, Library, UtensilsCrossed, Wrench, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useMyAvatar } from '../../hooks/useMyAvatar';
import AvatarDisplay, { type AvatarData } from '../avatar/AvatarDisplay';
import DeerIcon from '../icons/DeerIcon';
import { TAB_ROUTE_NAMES, navigateApp } from '../../navigation/navigateApp';
import { useMetrics } from '../../theme/metrics';
import { emitTabReselect } from '../../lib/tabReselect';

// Onaylanan "E · Instagram tarzı buzlu cam" mockup'ının RN karşılığı — kenarlardan
// boşluklu, yüzen tam bir buzlu-cam hap (bar'ın kendi blur+arka planı+border+
// gölgesi var), etiketsiz; aktif sekme daha kalın çizgi + teal renk + arkasındaki
// yumuşak teal kapsülle belli oluyor. Bildirimler ve Profil artık burada değil
// (AppHeader'daki zil/avatar) — "Ekle" en sağda.
//
// Web'de Navbar/MobileTabBar her rotada (detay sayfaları dahil) sabit kalıyor —
// burada da öyle. Bar iki yerde çiziliyor:
//  1. MainTabsScreen'de Tab.Navigator'ın `tabBar`'ı olarak — sahnelerin
//     KARDEŞİ olduğu için sekme geçiş animasyonu boyunca ekranda sabit kalır.
//  2. AppShell'de, push edilen ekranların (gönderi/profil/araç sayfaları)
//     altında.
// Aktif sekme her iki durumda da en yakın navigator'ın odaklı route adından
// çıkarılıyor (5 route'tan biri değilse hiçbiri aktif görünmez).
//
// "Ekle" buradan çıkıp AppHeader'daki + butonuna taşındı; yerine en sık gidilen
// iki hedef geldi: Yemek Listesi ve (en sağda, ikon yerine kullanıcının kendi
// avatarıyla) Profil.
const TAB_ROUTES = TAB_ROUTE_NAMES;

const PROFILE_ROUTE = 'Profile';

// TEK BİR SEKME YUVASI — AYRI VE MEMOİZE.
//
// Eskiden beş yuva da `WaveTabBar`ın gövdesinde satır içi `map` ile
// çiziliyordu. Bunun bedeli şuydu: bir sekmeye dokunulduğunda `activeRouteName`
// değişiyor, WaveTabBar baştan render oluyor ve BEŞ yuva birden yeniden
// kuruluyordu — profil yuvasındaki avatar dahil. O avatar piksel-sanat bir SVG,
// yani her dokunuşta onlarca native SVG düğümü sökülüp yeniden kuruluyordu.
// Testçilerin "sayfa geçişlerinde tabbar donuyor" dediği şey buydu.
// (Düğüm sayısı 1.0.15'te ortalama 24,5'ten 6,8'e indi — bkz. avatarPack.ts —
// ama bu memo yine şart: maliyet düştü, sıfırlanmadı.)
//
// Artık her yuva kendi prop'larına bakıyor: bir geçişte yalnızca İKİ yuvanın
// `isFocused`'ı değişiyor (eskisi false olur, yenisi true), kalan üçü prop
// olarak aynı kaldığı için hiç çizilmiyor. Avatar da ayrıca memoize
// (AvatarDisplay + AvatarSVG), dolayısıyla profil yuvası odak değiştirse bile
// SVG yeniden kurulmuyor — yalnızca çevresindeki halkanın kalınlığı değişiyor.
//
// ⚠️ `onPress` çağrı yerinde bağımlılıksız `useCallback` olmak ZORUNDA;
// referansı her render'da değişirse memo hiçbir işe yaramaz.
interface TabSlotProps {
  routeName: (typeof TAB_ROUTES)[number];
  isFocused: boolean;
  onPress: (routeName: string) => void;
  barHeight: number;
  iconSize: number;
  avatarSize: number;
  activeColor: string;
  inactiveColor: string;
  avatar: AvatarData | null;
}

const TabSlot = React.memo(function TabSlot({
  routeName,
  isFocused,
  onPress,
  barHeight,
  iconSize,
  avatarSize,
  activeColor,
  inactiveColor,
  avatar,
}: TabSlotProps) {
  const Icon = ICONS[routeName];

  const handlePress = React.useCallback(() => {
    // Zaten açık sekmeye basmak gezinme değil: ekran kendisi karar veriyor
    // (Ana sayfa en üste kayıyor, bkz. HomeScreen).
    if (isFocused) {
      emitTabReselect(routeName);
      return;
    }
    onPress(routeName);
  }, [isFocused, onPress, routeName]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={routeName}
      accessibilityState={isFocused ? { selected: true } : {}}
      className="flex-1 items-center justify-center"
      style={{ height: barHeight }}
    >
      {routeName === PROFILE_ROUTE ? (
        // Son slotta ikon yerine kullanıcının kendi avatarı; aktifken diğer
        // sekmelerin kalın çizgisinin karşılığı ince marka halkası.
        <View
          style={{
            width: avatarSize + 4,
            height: avatarSize + 4,
            borderRadius: (avatarSize + 4) / 2,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            // Kalınlık SABİT, yalnızca renk değişiyor. Eskiden
            // `borderWidth: isFocused ? 1.5 : 0` idi; RN'de kenarlık genişliğin
            // İÇİNDE yer aldığı için bu, içerik kutusunu 3px daraltıp avatar
            // alt ağacında (gerekirse ~40 SVG düğümü) yeniden yerleşim
            // tetikliyordu — hem de tam sekme geçişinin ortasında. Renk
            // değişimi yalnızca boyama, yerleşime dokunmuyor.
            borderWidth: 1.5,
            borderColor: isFocused ? activeColor : 'transparent',
          }}
        >
          {avatar ? (
            <AvatarDisplay avatar={avatar} size={avatarSize} showBg={false} />
          ) : (
            <DeerIcon size={avatarSize - 6} color={isFocused ? activeColor : inactiveColor} />
          )}
        </View>
      ) : (
        <Icon size={iconSize} color={isFocused ? activeColor : inactiveColor} strokeWidth={isFocused ? 2.3 : 1.8} />
      )}
    </Pressable>
  );
});

const ICONS: Record<string, LucideIcon> = {
  Home,
  Departments: Library,
  Tools: Wrench,
  CafeteriaMenu: UtensilsCrossed,
};

// Tabletde bar telefon ölçeğinde kalırsa parmak izine göre küçük görünüyordu
// (kullanıcı isteği: "her yer responsive olmalı") — bu yüzden yükseklik/ikon/
// avatar boyutları aşağıda `scale()` ile tabletde ~%15 büyütülüyor; sadece
// kenar boşluğu (`H_MARGIN`) sabit kalıyor, zaten tablette `ContentContainer`
// bar'ı da ortalanmış içerik genişliğine sığdırıyor.
const BASE_BAR_HEIGHT = 50;
const BASE_BAR_RADIUS = 25;
const BASE_CAPSULE_SIZE = 38;
const BASE_CAPSULE_RADIUS = 13;
// 4 yerine 5 sütun var — kenar boşluğu daraltılmasa ikonlar birbirine girerdi.
const H_MARGIN = 20;
const BOTTOM_MARGIN = 10;
const BASE_AVATAR_SIZE = 26;
const BASE_ICON_SIZE = 23;

// Kapsül animasyonunun süresi: taban + geçilen her sütun için ek (bkz.
// `moveCapsuleTo`). Komşu sekmede ~195 ms, en uzun yolda (Profil -> Ana sayfa,
// 4 sütun) ~330 ms. Tavan, hiçbir koşulda ağır hissettirmemesi için.
const CAPSULE_BASE_MS = 150;
// ANDROID'DE KAPSÜL KAYMIYOR, basılan sekmeye ANINDA atlıyor (kullanıcı isteği,
// Play sürümü öncesi: "kayma efekti olmasın hiç, sadece tıklanan yerin rengi
// değişsin"). Aşağıdaki süre/easing ayarları yalnızca iOS'ta geçerli; Android'de
// kapsülün konumu ve opaklığı doğrudan yazılıyor, UI thread'inde hiç animasyon
// çalışmıyor.
const ANIMATE_CAPSULE = Platform.OS === 'ios';
const CAPSULE_PER_COL_MS = 45;
const CAPSULE_MAX_MS = 340;

const COLORS = {
  light: {
    barBg: 'rgba(255,255,255,0.92)',
    barBorder: 'rgba(255,255,255,0.8)',
    capsule: 'rgba(47,87,85,0.16)',
    active: '#2F5755',
    inactive: '#6b7280',
    blurTint: 'light' as const,
  },
  dark: {
    barBg: 'rgba(34,40,49,0.92)',
    barBorder: 'rgba(255,255,255,0.14)',
    capsule: 'rgba(90,150,144,0.3)',
    active: '#5A9690',
    inactive: '#a9b2ba',
    blurTint: 'dark' as const,
  },
};

function WaveTabBarBase({ activeRouteName }: { activeRouteName?: string } = {}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = COLORS[theme];
  const navigation = useNavigation();
  // Aktif sekmenin adı iki montaj yerinde iki ayrı kaynaktan geliyor:
  //
  //  • AppShell (push edilmiş ekranlar) — prop YOK. En yakın navigator'ın
  //    odaklı route'u okunuyor; orada bu kök stack'in tepesindeki ekran demek,
  //    5 sekmeden biri olmadığı için hiçbiri aktif görünmüyor. Doğrusu da bu.
  //
  //  • MainTabsScreen — prop VAR. Bar artık Tab.Navigator'ın `tabBar` yuvasında
  //    DEĞİL, onun KARDEŞİ olarak çiziliyor (gerekçe o dosyada yazılı), yani
  //    `useNavigationState` oradan kök stack'i görür ve hep "MainTabs" derdi —
  //    aktif sekme hiç belli olmazdı. Odaklı sekmenin adı bu yüzden prop'la
  //    geliyor; MainTabsScreen zaten üst bar başlığı için o state'i tutuyor.
  const nearestRouteName = useNavigationState((state) => state.routes[state.index]?.name);
  const currentRouteName = activeRouteName ?? nearestRouteName;
  const activeIndex = TAB_ROUTES.indexOf(currentRouteName as (typeof TAB_ROUTES)[number]);
  const avatar = useMyAvatar();
  const { scale, width: windowWidth } = useMetrics();
  const BAR_HEIGHT = scale(BASE_BAR_HEIGHT);
  const BAR_RADIUS = scale(BASE_BAR_RADIUS);
  const CAPSULE_SIZE = scale(BASE_CAPSULE_SIZE);
  const CAPSULE_RADIUS = scale(BASE_CAPSULE_RADIUS);
  const AVATAR_SIZE = scale(BASE_AVATAR_SIZE);
  const ICON_SIZE = scale(BASE_ICON_SIZE);

  // BAŞLANGIÇ DEĞERİ TAHMİN EDİLİYOR, ama ÖLÇÜM SON SÖZ.
  //
  // Kapsül `barWidth > 0` koşuluna bağlı olduğu için başlangıç 0 iken her mount
  // İKİ render ediyordu: ilk commit'te kapsül yok, `onLayout` → `setBarWidth` →
  // ikinci commit'te var. Bar hem `MainTabsScreen`'de kalıcı hem push edilen her
  // ekranda mount olduğu için bu bedel her gezinmede ödeniyordu.
  //
  // Geometri: dış View `left:0/right:0` (pencere genişliği) + `paddingHorizontal:
  // H_MARGIN`; BlurView'ın `borderWidth: 1`'i Yoga'da çocuğun genişliğinden
  // düşüyor; içteki View'ın `paddingHorizontal: 8`'i `onLayout`'ta da çıkarılıyor.
  // Bar `ContentContainer`'ın DIŞINDA durduğu için tablette de tam pencere
  // genişliği geçerli.
  //
  // Tahmin ölçümle aynı çıkarsa `setBarWidth` aynı değeri yazıyor ve React
  // yeniden render etmiyor — yani ikinci commit kalkıyor. Farklı çıkarsa
  // (hesaptaki bir sapma, döndürme, bölünmüş ekran) ölçüm düzeltiyor, davranış
  // eskisiyle birebir aynı kalıyor.
  const [barWidth, setBarWidth] = React.useState(() =>
    Math.max(windowWidth - 2 * H_MARGIN - 2 - 16, 0)
  );
  const colWidth = barWidth / TAB_ROUTES.length;
  const capsuleX = useSharedValue(0);
  const capsuleOpacity = useSharedValue(0);

  // Geometri bir ref'te tutuluyor ki `moveCapsuleTo` BAĞIMLILIKSIZ kalabilsin —
  // o sabit kalmazsa `handlePress` de değişir ve `TabSlot`'un memo'su düşer
  // (yukarıdaki uyarıya bak).
  const capsuleGeomRef = React.useRef({ colWidth: 0, capsuleSize: 0 });
  useEffect(() => {
    capsuleGeomRef.current = { colWidth, capsuleSize: CAPSULE_SIZE };
  }, [colWidth, CAPSULE_SIZE]);

  // Aynı hedefe iki kere animasyon başlatmamak için: dokunuşta bir kez
  // başlıyor, `activeIndex` arkadan geldiğinde efekt aynı hedefi görüp
  // çıkıyor. Olmasaydı kapsül yolun ortasında yeniden başlardı.
  const lastTargetRef = React.useRef<number | null>(null);

  // KAPSÜL ARTIK DOKUNUŞ ANINDA HAREKET EDİYOR, `activeIndex` BEKLENMİYOR.
  //
  // Eski kurulumda animasyonu yalnızca aşağıdaki efekt başlatıyordu ve o efektin
  // çalışabilmesi için şu zincirin TAMAMININ JS thread'inde bitmesi gerekiyordu:
  // dokunuş → navigate → `screenListeners.state` → `onTabChange` →
  // `setActiveTab` (MainTabsScreen) → MainTabsScreen render → WaveTabBar render
  // → `activeIndex` değişir → efekt → animasyon başlar.
  //
  // Sayfanın kendisi bu zinciri BEKLEMİYOR: `animation: 'none'` olduğu için
  // sahneyi react-native-screens native tarafta anında değiştiriyor. Ama yeni
  // odaklanan sekmenin ilk render'ı (ör. ProfileScreen: 1415 satır, 7 pager
  // sayfası) aynı JS thread'inde sıraya giriyor ve yukarıdaki zinciri kendi
  // arkasına itiyor. Testçi tablosu tam olarak buydu: "önce sayfa geçiyor,
  // ~1 sn sonra tabbar değişiyor."
  //
  // Çözüm animasyonu zincirin BAŞINA almak: `handlePress` dokunuş işlenirken,
  // yani yeni ekran daha render edilmeden çalışıyor. Reanimated animasyonu bir
  // kez başladıktan sonra UI thread'inde sürdüğü için, JS thread'i yeni ekranı
  // çizerken bloke olsa bile kapsül akıcı şekilde kayıyor.
  const moveCapsuleTo = React.useCallback((index: number) => {
    // Hedef opaklık ZATEN yerindeyse animasyon başlatmıyoruz. Eskiden koşulsuzdu
    // ve `AppShell` içindeki her mount'ta (orada `activeIndex` hep -1, bkz.
    // aşağıdaki not) 0'dan 0'a 150 ms'lik, görünür hiçbir etkisi olmayan bir
    // animasyon başlatıyordu — yani push edilen her ekran bedava bir UI thread
    // animasyonu açıyordu.
    //
    // Yarı yolda kesilen animasyonu bozmuyor: o durumda `.value` ara değeri
    // döndürüyor, hedefe eşit olmuyor ve animasyon normalde olduğu gibi
    // bulunduğu yerden devam ediyor.
    const nextOpacity = index === -1 ? 0 : 1;
    if (capsuleOpacity.value !== nextOpacity) {
      capsuleOpacity.value = ANIMATE_CAPSULE ? withTiming(nextOpacity, { duration: 150 }) : nextOpacity;
    }
    const { colWidth: cw, capsuleSize } = capsuleGeomRef.current;
    if (index === -1 || cw === 0) return;

    const target = (index + 0.5) * cw - capsuleSize / 2;
    if (lastTargetRef.current === target) return;
    lastTargetRef.current = target;

    if (!ANIMATE_CAPSULE) {
      capsuleX.value = target;
      return;
    }

    // SÜRE MESAFEYLE ÖLÇEKLENİYOR. Sabit 180 ms, 1 sütunluk geçişte doğruydu
    // ama Profil(4) -> Ana sayfa(0) yolunda yanlıştı: aynı sürede 4 kat mesafe,
    // 60 fps'te ~11 kare, yani kare başına neredeyse bir sütun. Üstüne
    // `Easing.out(cubic)` mesafenin çoğunu ilk karelerde yiyor — ilk üç sütun
    // ~4 karede geçiliyordu. Kapsül ikonların altından "şimşek gibi" geçip
    // duruyor; kullanıcının "tık tık geçiyor, kusursuz kaymıyor" dediği şey bu.
    //
    // (Kullanıcının tarifi "ara ikonların rengi kademe kademe değişiyor"du ama
    // kodda o mümkün değil: `activeIndex` 4'ten 0'a atlıyor, ara slotların
    // `isFocused`'ı hiç true olmuyor ve `TabSlot` memo'su onları hiç yeniden
    // çizmiyor. Görülen şey kapsülün kendisi.)
    //
    // Easing de simetriğe çevrildi: uzun yolda ivmelenip yavaşlayan bir hareket
    // "kayma" gibi okunuyor, öne yığılmış olan ise sıçrama gibi.
    //
    // `withSpring`e DÖNÜLMEYECEK: eski `damping: 17 / stiffness: 180 /
    // mass: 0.8` kritik altı sönümlüydü (ζ ≈ 0.71), hedefi aşıp geri salınıyor
    // ve oturması ~380 ms sürüyordu; sayfa 0 ms'de değiştiği için o kuyruk
    // "bar geriden geliyor" şikâyetini üretmişti.
    //
    // Mesafe, hedefin o anki KONUMA uzaklığından hesaplanıyor (`capsuleX.value`
    // JS tarafından senkron okunabiliyor) — yarı yolda kesilen bir animasyonda
    // da doğru kalıyor.
    const distanceCols = Math.abs(target - capsuleX.value) / cw;
    const duration = Math.min(CAPSULE_BASE_MS + CAPSULE_PER_COL_MS * distanceCols, CAPSULE_MAX_MS);
    capsuleX.value = withTiming(target, { duration, easing: Easing.inOut(Easing.cubic) });
  }, []);

  // Dokunuştan GELMEYEN sekme değişimleri için uzlaştırma yolu: programatik
  // `navigateApp` çağrıları, bildirimden açılma, push edilmiş ekrana girip
  // çıkma (`activeIndex === -1`). Dokunuşla gelindiyse `lastTargetRef` sayesinde
  // burası sessizce çıkıyor.
  useEffect(() => {
    if (barWidth === 0) return;
    moveCapsuleTo(activeIndex);
  }, [activeIndex, barWidth, moveCapsuleTo]);

  const capsuleStyle = useAnimatedStyle(() => ({
    opacity: capsuleOpacity.value,
    transform: [{ translateX: capsuleX.value }],
  }));

  // Yalnızca `navigation`'a bağlı — referansı sabit kalsın ki `TabSlot`'un
  // memo'su tutsun. Sekmeler Tab.Navigator'ın ekranları olduğu için
  // `navigateApp` `MainTabs`e iç içe navigate ediyor; sekme mount'lu kaldığından
  // veri yeniden çekilmiyor. Push edilmiş bir ekrandayken (ör. gönderi detayı)
  // aynı çağrı stack'i MainTabs'e geri sarıyor.
  const handlePress = React.useCallback(
    (routeName: string) => {
      // ÖNCE kapsül, SONRA navigate — sıra önemli. `navigateApp` senkron olarak
      // React Navigation'ın state güncellemesini tetikliyor ve yeni sekmenin
      // render'ı bu thread'i uzun süre meşgul edebiliyor; animasyonu ondan önce
      // başlatınca UI thread'ine devredilmiş oluyor (gerekçe `moveCapsuleTo`
      // üstündeki notta).
      moveCapsuleTo(TAB_ROUTES.indexOf(routeName as (typeof TAB_ROUTES)[number]));
      navigateApp(navigation, routeName);
    },
    [navigation, moveCapsuleTo]
  );

  // Klavye açıkken bar gizleniyor. Sekme sahneleri KeyboardAvoider'ın içinde
  // (bkz. MainTabsScreen.tsx) — bar da onunla birlikte yukarı itilseydi
  // klavyenin hemen üstünde yüzen tuhaf bir hap olarak kalırdı.
  const [keyboardOpen, setKeyboardOpen] = React.useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboardOpen) return null;

  return (
    // Bar'ın kendisi mutlak konumlu: hem Tab.Navigator'ın `tabBar` yuvasında
    // (orada normal akışta olsa sahneleri yukarı iterdi) hem de AppShell'de
    // içeriğin ÜZERİNDE yüzsün diye — tek tanım, iki montaj yeri.
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: Math.max(insets.bottom, BOTTOM_MARGIN),
        paddingHorizontal: H_MARGIN,
      }}
      pointerEvents="box-none"
      // ⚠️ `collapsable={false}` — SÜS DEĞİL, DOKUNUŞ HATASININ ÇÖZÜMÜ.
      //
      // Yeni Mimari'de (Fabric) React Native, "yalnızca yerleşim için var"
      // saydığı görünümleri optimizasyon amacıyla native tarafta HİÇ
      // OLUŞTURMUYOR — buna view flattening (görünüm düzleştirme) deniyor.
      // Bu View tam o profilde: arka planı yok, kenarlığı yok, yalnızca
      // konumlandırma ve dolgu taşıyor.
      //
      // Ama bu View'in bir işi daha var: `pointerEvents="box-none"` ile
      // "ben dokunuş almam, çocuklarım alır" diyor. Düzleştirilip yok
      // edildiğinde o yönlendirme yapacak katman ortadan kalkıyor. Bar
      // ÇİZİLMEYE devam ediyor (BlurView'in kendi `elevation`'ı var, o gerçek
      // bir native görünüm) ama dokunuşlar sekmelere ulaşmıyor — testçilerin
      // "bar duruyor ama basamıyorum" dediği tablo.
      //
      // `collapsable={false}` React Native'in bu optimizasyonu kapatmak için
      // sunduğu resmî yol. Bedeli tek bir fazladan native görünüm.
      //
      // Bu teşhis, `enableFreeze(false)` denemesi işe YARAMADIKTAN sonra
      // kuruldu: donma dondurmayla değil, dokunuş hedefiyle ilgiliymiş.
      collapsable={false}
    >
      {/* Bar'ın kendisi yüzen bir buzlu-cam hap: gerçek arka plan bulanıklığı
          (BlurView) + yarı saydam dolgu + ince border + gölge. İçinde, aktif
          sekmenin arkasında ayrı, daha yumuşak bir teal kapsül kayarak geziyor. */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 45 : 65}
        tint={c.blurTint}
        style={{
          height: BAR_HEIGHT,
          borderRadius: BAR_RADIUS,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: c.barBorder,
          backgroundColor: c.barBg,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        }}
      >
        <View style={{ flex: 1, paddingHorizontal: 8 }} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width - 16)}>
          {barWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: (BAR_HEIGHT - CAPSULE_SIZE) / 2,
                  left: 8,
                  width: CAPSULE_SIZE,
                  height: CAPSULE_SIZE,
                  borderRadius: CAPSULE_RADIUS,
                  backgroundColor: c.capsule,
                },
                capsuleStyle,
              ]}
            />
          )}

          <View className="flex-1 flex-row items-center">
            {TAB_ROUTES.map((routeName, index) => (
              <TabSlot
                key={routeName}
                routeName={routeName}
                isFocused={index === activeIndex}
                onPress={handlePress}
                barHeight={BAR_HEIGHT}
                iconSize={ICON_SIZE}
                avatarSize={AVATAR_SIZE}
                activeColor={c.active}
                inactiveColor={c.inactive}
                avatar={avatar}
              />
            ))}
          </View>
        </View>
      </BlurView>
    </View>
  );
}

// AppHeader ile aynı gerekçe: bar `MainTabsScreen`'de kalıcı, ayrıca push edilen
// her ekranda `AppShell` içinde. Tek prop'u ilkel (`activeRouteName`), memo
// tutuyor — ebeveyn render'ında beş yuva ve profil avatarı yeniden kurulmuyor.
export default React.memo(WaveTabBarBase);
