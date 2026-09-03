import React, { useEffect } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackActions, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Home, Library, UtensilsCrossed, Wrench, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useMyAvatar } from '../../hooks/useMyAvatar';
import AvatarDisplay from '../avatar/AvatarDisplay';
import DeerIcon from '../icons/DeerIcon';
import { setTabAnimationDirection } from '../../navigation/tabAnimationDirection';
import type { RootStackParamList } from '../../navigation/types';

// Onaylanan "E · Instagram tarzı buzlu cam" mockup'ının RN karşılığı — kenarlardan
// boşluklu, yüzen tam bir buzlu-cam hap (bar'ın kendi blur+arka planı+border+
// gölgesi var), etiketsiz; aktif sekme daha kalın çizgi + teal renk + arkasındaki
// yumuşak teal kapsülle belli oluyor. Bildirimler ve Profil artık burada değil
// (AppHeader'daki zil/avatar) — "Ekle" en sağda.
//
// Web'de Navbar/MobileTabBar her rotada (detay sayfaları dahil) sabit kalıyor —
// burada da artık gerçek bir Tab.Navigator yok; AppShell (bkz. o dosya) bu bar'ı
// RootStack'teki HER ekranın altına sabit monte ediyor, aktif sekme geçerli
// route adına göre belirleniyor (5 route'tan biri değilse hiçbiri aktif görünmez).
//
// "Ekle" buradan çıkıp AppHeader'daki + butonuna taşındı; yerine en sık gidilen
// iki hedef geldi: Yemek Listesi ve (en sağda, ikon yerine kullanıcının kendi
// avatarıyla) Profil.
const TAB_ROUTES = ['Home', 'Departments', 'Tools', 'CafeteriaMenu', 'Profile'] as const;

const PROFILE_ROUTE = 'Profile';

const ICONS: Record<string, LucideIcon> = {
  Home,
  Departments: Library,
  Tools: Wrench,
  CafeteriaMenu: UtensilsCrossed,
};

const BAR_HEIGHT = 50;
const BAR_RADIUS = 25;
const CAPSULE_SIZE = 38;
const CAPSULE_RADIUS = 13;
// 4 yerine 5 sütun var — kenar boşluğu daraltılmasa ikonlar birbirine girerdi.
const H_MARGIN = 20;
const BOTTOM_MARGIN = 10;
const AVATAR_SIZE = 26;

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

export default function WaveTabBar() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = COLORS[theme];
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const currentRouteName = useRoute().name;
  const activeIndex = TAB_ROUTES.indexOf(currentRouteName as (typeof TAB_ROUTES)[number]);
  const avatar = useMyAvatar();

  const [barWidth, setBarWidth] = React.useState(0);
  const colWidth = barWidth / TAB_ROUTES.length;
  const capsuleX = useSharedValue(0);
  const capsuleOpacity = useSharedValue(0);

  useEffect(() => {
    if (barWidth === 0) return;
    capsuleOpacity.value = withTiming(activeIndex === -1 ? 0 : 1, { duration: 150 });
    if (activeIndex !== -1) {
      capsuleX.value = withSpring((activeIndex + 0.5) * colWidth - CAPSULE_SIZE / 2, {
        damping: 17,
        stiffness: 180,
        mass: 0.8,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, barWidth]);

  const capsuleStyle = useAnimatedStyle(() => ({
    opacity: capsuleOpacity.value,
    transform: [{ translateX: capsuleX.value }],
  }));

  return (
    <View style={{ paddingBottom: Math.max(insets.bottom, BOTTOM_MARGIN), paddingHorizontal: H_MARGIN }} pointerEvents="box-none">
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
        <View
          style={{ flex: 1, paddingHorizontal: 8 }}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width - 16)}
        >
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
            {TAB_ROUTES.map((routeName, index) => {
              const isFocused = index === activeIndex;
              const Icon = ICONS[routeName];

              const onPress = () => {
                if (isFocused) return;

                // Profil, sekme değil PUSH edilen bir ekran: orada sağa kaydırma
                // geri gitmeli (bkz. AppShell.tsx BACK_SWIPE_ROUTES) — `replace`
                // olsaydı geri dönülecek ekran kalmazdı.
                if (routeName === PROFILE_ROUTE) {
                  navigation.navigate('Profile');
                  return;
                }

                // Hangi yönde kayacağı, hedef sekmenin şu anki aktif sekmeye göre
                // solda mı sağda mı olduğuna bakılarak belirleniyor — sağdaki bir
                // sekmeden soldakine geçerken sayfa soldan, tersinde sağdan kayar
                // (bkz. tabAnimationDirection.ts, RootNavigator'daki sekme options'ı).
                setTabAnimationDirection(index < activeIndex ? 'slide_from_left' : 'slide_from_right');
                // `navigate` bu route stack'te zaten varsa (örn. daha önce ziyaret
                // edilmiş bir sekme) push değil POP yapıyor — o zaman yeni animasyon
                // hiç oynamıyor, çünkü giren ekran zaten mount'lu, sadece üsttekiler
                // kapanıyor. `replace` her sekme geçişinde taze bir instance mount
                // ediyor, yön animasyonu her seferinde garantili çalışıyor; ayrıca alt
                // tab'ların stack'te sonsuza kadar birikmesini de engelliyor.
                navigation.dispatch(StackActions.replace(routeName));
              };

              return (
                <Pressable
                  key={routeName}
                  onPress={onPress}
                  accessibilityRole="button"
                  accessibilityLabel={routeName}
                  accessibilityState={isFocused ? { selected: true } : {}}
                  className="flex-1 items-center justify-center"
                  style={{ height: BAR_HEIGHT }}
                >
                  {routeName === PROFILE_ROUTE ? (
                    // Son slotta ikon yerine kullanıcının kendi avatarı; aktifken
                    // diğer sekmelerin kalın çizgisinin karşılığı ince marka halkası.
                    <View
                      style={{
                        width: AVATAR_SIZE + 4,
                        height: AVATAR_SIZE + 4,
                        borderRadius: (AVATAR_SIZE + 4) / 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        borderWidth: isFocused ? 1.5 : 0,
                        borderColor: c.active,
                      }}
                    >
                      {avatar ? (
                        <AvatarDisplay avatar={avatar} size={AVATAR_SIZE} showBg={false} />
                      ) : (
                        <DeerIcon size={AVATAR_SIZE - 6} color={isFocused ? c.active : c.inactive} />
                      )}
                    </View>
                  ) : (
                    <Icon
                      size={23}
                      color={isFocused ? c.active : c.inactive}
                      strokeWidth={isFocused ? 2.3 : 1.8}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </BlurView>
    </View>
  );
}
