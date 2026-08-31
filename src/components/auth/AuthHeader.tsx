import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  hint?: string;
}

export default function AuthHeader({ icon, title, subtitle, hint }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: 28 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2F575519',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13.5, color: '#6b7280', marginTop: 8, textAlign: 'center' },
  hint: { fontSize: 11.5, color: '#9ca3af', marginTop: 8, textAlign: 'center', paddingHorizontal: 10 },
});
