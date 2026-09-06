import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import Ego130ScheduleScreen from '../screens/main/Ego130ScheduleScreen';

// Çevrimdışıyken (giriş yapılmış OLSUN ya da OLMASIN) düşülen TEK ekran —
// bkz. RootNavigator.tsx'teki erken `return`. Eskiden yalnızca giriş
// EKRANI için vardı; artık tam kilit her iki durumda da buraya düşüyor,
// bu yüzden metin giriş durumuna göre dallanmıyor. `OfflineBanner`daki "Ring
// seferlerini görmek ister misin?" butonu burada işe yaramaz — hedef aldığı
// `RootStackParamList` (bkz. navigateWhenReady) bu ekranla birlikte mount
// değil; zaten kullanıcı burada başka bir yere gidemez, ring saatleri zaten
// tek içerik. Bağlantı geri gelince `RootNavigator` otomatik olarak normal
// ağaca döner.
export default function OfflineEgoScreen() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 9,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          <WifiOff size={16} color={colors.warn} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700' }}>İnternet bağlantınız yok</Text>
            <Text style={{ color: colors.ink2, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
              Bağlantı gelene kadar çevrimdışı çalışan EGO 130 saatlerini görüntüleyebilirsin.
            </Text>
          </View>
        </View>
      </SafeAreaView>
      <Ego130ScheduleScreen />
    </View>
  );
}
