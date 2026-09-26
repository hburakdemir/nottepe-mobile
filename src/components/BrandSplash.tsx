import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { DARK_VARS, LIGHT_VARS } from '../theme/palette';

// Açılışın iki bekleme anı da (App.tsx'te fontlar, RootNavigator'da oturum
// kontrolü) BU ekranı çiziyor — ikisi farklı görünseydi kullanıcı açılışta
// önce logoyu, sonra bir spinner'ı görüyordu. Tek bileşen = tek kare, geçiş
// fark edilmiyor.
//
// `isDark` dışarıdan geliyor çünkü App.tsx'teki ilk çizim ThemeProvider'ın
// DIŞINDA (sistem temasına bakıyor), RootNavigator'daki ise içinde.
export default function BrandSplash({ isDark }: { isDark: boolean }) {
  const vars = isDark ? DARK_VARS : LIGHT_VARS;
  return (
    <View style={[styles.root, { backgroundColor: vars['--ground'] }]}>
      <View style={styles.center}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} />
        <Text style={[styles.title, { color: vars['--ink'] }]}>Nottepe</Text>
      </View>
      <Text style={[styles.footer, { color: vars['--muted'] }]}>powered for Hacettepe Students</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Uygulama ikonuyla aynı oran (~%22) — ana ekrandaki ikonun devamı gibi dursun.
  logo: { width: 112, height: 112, borderRadius: 26 },
  title: { marginTop: 16, fontSize: 24, fontWeight: '800', letterSpacing: 0.5 },
  // Edge-to-edge: alt gezinme çubuğunun altında kalmasın diye sabit pay
  // (bu ekran SafeAreaProvider'dan önce de çizildiği için inset okunamıyor).
  footer: { marginBottom: 56, fontSize: 13, fontWeight: '500' },
});
