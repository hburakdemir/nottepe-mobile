import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

interface Props {
  title: string;
  subtitle?: string;
  hint?: string;
}

// Üstte eskiden ekrana göre değişen bir lucide ikonu (LogIn/UserPlus/Mail/Lock)
// vardı; artık tüm giriş ekranlarında marka logosu (kullanıcı isteği) —
// BrandSplash ile aynı ikon ve köşe oranı, açılıştan girişe geçiş kesintisiz.
export default function AuthHeader({ title, subtitle, hint }: Props) {
  return (
    <View style={styles.container}>
      <Image source={require('../../../assets/icon.png')} style={styles.logo} accessibilityLabel="Nottepe" />
      <Text className="text-ink" style={styles.title}>
        {title}
      </Text>
      {!!subtitle && (
        <Text className="text-muted" style={styles.subtitle}>
          {subtitle}
        </Text>
      )}
      {!!hint && (
        <Text className="text-muted" style={styles.hint}>
          {hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 72, height: 72, borderRadius: 16, marginBottom: 14 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13.5, marginTop: 8, textAlign: 'center' },
  hint: { fontSize: 11.5, marginTop: 8, textAlign: 'center', paddingHorizontal: 10 },
});
