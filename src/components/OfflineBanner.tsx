import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { navigateWhenReady } from '../navigation/navigationRef';

// Çevrimdışıyken artık tüm uygulamanın yerini almıyoruz (bkz. RootNavigator) —
// hangi ekrandaysa onun üstüne sabit bir şerit biniyor. Sunucudan veri isteyen
// ekranlar yine de kendi hata/spinner durumlarını gösterebilir; bu şerit sadece
// bağlantı yokluğunu bildirip EGO 130'un (tek çevrimdışı-güvenli ekran, bkz.
// Ego130ScheduleScreen.tsx başındaki not) tek dokunuşla ulaşılabilir olmasını
// sağlıyor.
export default function OfflineBanner() {
  const { colors } = useTheme();

  return (
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
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700' }}>İnternete bağlı değilsiniz</Text>
          <Pressable onPress={() => navigateWhenReady('Ego130Schedule')} hitSlop={6}>
            <Text style={{ color: colors.accent, fontSize: 12, lineHeight: 17, marginTop: 2, fontWeight: '600' }}>
              Ring seferlerini görmek ister misin?
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
