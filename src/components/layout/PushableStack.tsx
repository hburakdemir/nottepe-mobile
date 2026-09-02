import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated';
import { useDrawerProgress } from '@react-navigation/drawer';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { DRAWER_WIDTH } from '../../navigation/drawerConstants';
import { useTheme } from '../../context/ThemeContext';

// X (Twitter) tarzı "itme" efekti: Drawer.Navigator `drawerType: 'front'` ile
// içeriğe hiç dokunmuyor (bkz. RootNavigator.tsx) — itme + köşe yuvarlama +
// gölgeyi burada `useDrawerProgress()`'in verdiği 0..1 SharedValue'suyla elle
// sürüyoruz. X'te sayfa KÜÇÜLMÜYOR — sadece tam boyutunda sağa kayıyor (sağ
// tarafı zaten ekran dışına taşıyor, görünmüyor), sadece görünen SOL kenar
// köşeleri yuvarlanıyor. Şeffaf kenar boşluğu olmadığı için (ölçekleme yok)
// translateX hedefi doğrudan DRAWER_WIDTH — telafi matematiğine gerek yok.
//
// Gölge X'in gerçek görünümüyle birebir olacak şekilde AYARLANDI (referans
// ekran görüntüsü incelendi): X'te gölge hafif — dramatik bir blur değil,
// sadece görünen sol-üst köşenin yuvarlanmasıyla + hafif bir tonla belli
// oluyor. Bu yüzden değerler bilinçli olarak düşük tutuluyor.
export default function PushableStack({ children }: { children: React.ReactNode }) {
  const progress = useDrawerProgress();
  const navigation = useNavigation();
  const { theme } = useTheme();
  // Android'de `elevation` gölgesi, üstüne uygulandığı View'ın OPAK bir
  // backgroundColor'ı yoksa güvenilir şekilde render olmuyor (silüeti
  // hesaplayamıyor) — dıştaki gölge View'ı şeffaftı, bu yüzden X'teki gibi
  // belirgin bir "kart önde" gölgesi hiç görünmüyordu. İçteki ve dıştaki
  // View'a da temaya uygun opak arka plan veriyoruz (sabit '#fff' yerine).
  const surfaceColor = theme === 'dark' ? '#222831' : '#fff';
  const [overlayActive, setOverlayActive] = useState(false);

  useAnimatedReaction(
    () => progress.value > 0.01,
    (active, prevActive) => {
      if (active !== prevActive) runOnJS(setOverlayActive)(active);
    }
  );

  const radiusStyle = useAnimatedStyle(() => {
    const radius = interpolate(progress.value, [0, 1], [0, 28]);
    return { borderTopLeftRadius: radius, borderBottomLeftRadius: radius };
  });

  const shadowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(progress.value, [0, 1], [0, 0.35]),
    elevation: interpolate(progress.value, [0, 1], [0, 24]),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, DRAWER_WIDTH]) }],
  }));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        shadowStyle,
        radiusStyle,
        // `drawerType: 'front'` menü panelini DOĞASI GEREĞİ içeriğin ÖNÜNDE
        // (üstünde) render ediyor (bkz. dosya başı notu) — biz tam tersini
        // istiyoruz (itilen sayfa menünün önünde). Android'de dizilim sırasından
        // bağımsız olarak `elevation`, iOS/genel RN'de `zIndex` kazanıyor; yüksek
        // tutmazsak gölge (ve içerik) menü panelinin ARKASINDA kalıp görünmüyor.
        { shadowColor: '#000', shadowOffset: { width: -3, height: 0 }, shadowRadius: 12, zIndex: 100, backgroundColor: surfaceColor },
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, radiusStyle, { overflow: 'hidden', backgroundColor: surfaceColor }]}>
        {children}
        {overlayActive && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => navigation.dispatch(DrawerActions.closeDrawer())}
            accessibilityLabel="Menüyü kapat"
          />
        )}
      </Animated.View>
    </Animated.View>
  );
}
