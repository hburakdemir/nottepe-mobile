import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import Ego130ScheduleScreen from '../screens/main/Ego130ScheduleScreen';
import { recheckConnectivity } from '../hooks/useIsOffline';

// Çevrimdışıyken (giriş yapılmış OLSUN ya da OLMASIN) gösterilen TEK ekran.
// Uygulama ağacının YERİNE geçmiyor, ÜSTÜNE biniyor: `RootNavigator` bunu
// `StyleSheet.absoluteFill` bir katmanda çiziyor (gerekçe orada — ağacı
// unmount etmek algılamayı yavaşlatmak zorunda bırakıyordu). Bu yüzden
// kendi zemininin OPAK kalması şart: `colors.ground` arkadaki uygulamayı
// tamamen kapatıyor. Eskiden yalnızca giriş EKRANI için vardı; artık
// kilit her iki durumda da buraya düşüyor,
// bu yüzden metin giriş durumuna göre dallanmıyor. Kullanıcı burada başka
// bir yere gidemez, ring saatleri tek içerik. Bağlantı geri gelince
// `RootNavigator` otomatik olarak normal ağaca döner.
export default function OfflineEgoScreen() {
  const { colors } = useTheme();
  // Aşağı çekince bağlantı elle yeniden deneniyor. Başarılıysa bu katman
  // kendiliğinden kalkıyor; değilse kullanıcıya denendiği söyleniyor.
  const [stillOffline, setStillOffline] = useState(false);
  const retry = useCallback(async () => {
    const ok = await recheckConnectivity();
    setStillOffline(!ok);
  }, []);

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
              Bağlantı gelene kadar çevrimdışı çalışan EGO 130 saatlerini görüntüleyebilirsin. İnternet
              geldiyse sayfayı aşağı çek.
            </Text>
            {stillOffline && (
              <Text style={{ color: colors.warn, fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                Hâlâ bağlantı yok, biraz sonra tekrar dene.
              </Text>
            )}
          </View>
        </View>
      </SafeAreaView>
      <Ego130ScheduleScreen onRefresh={retry} />
    </View>
  );
}
