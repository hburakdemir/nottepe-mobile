import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

// Ortak yükleme/hata/boş durumu — eskiden 25+ ekranın her biri kendi
// "… yüklenemedi" `<Text>`'ini ya da `Alert.alert('Hata', …)` çağrısını elle
// yazıyordu; hiçbirinde "tekrar dene" yoktu.
//
// Yükleme durumu yalnızca spinner. Eskiden 1 saniye sonra kendiliğinden bir
// çevrimdışı mesajına (EGO 130 ring saatlerine yönlendiren) geçiyordu; bağlantı
// yerindeyken de yavaş isteklerde çıktığı için kullanıcı isteğiyle kaldırıldı.
// Geri eklemeyin.

interface Props {
  kind: 'loading' | 'error' | 'empty';
  icon?: LucideIcon;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** `kind="loading"` için ActivityIndicator rengi — çağıran ekranın kendi vurgu rengi. */
  loadingColor?: string;
}

export default function StateView({ kind, icon: Icon, title, message, actionLabel, onAction, loadingColor }: Props) {
  const { colors } = useTheme();

  if (kind === 'loading') {
    return (
      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
        <ActivityIndicator size="large" color={loadingColor ?? colors.accent} />
      </View>
    );
  }

  // error / empty: aynı düzen, yalnızca "tekrar dene" yalnızca hata için var.
  return (
    <View style={{ alignItems: 'center', gap: 6, paddingVertical: 40, paddingHorizontal: 24 }}>
      {Icon && <Icon size={36} color={colors.muted2} style={{ marginBottom: 2 }} />}
      {!!title && <Text style={{ color: colors.ink2, fontSize: 14, fontWeight: '700', textAlign: 'center' }}>{title}</Text>}
      {!!message && (
        <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center' }}>{message}</Text>
      )}
      {kind === 'error' && !!onAction && (
        <Pressable
          onPress={onAction}
          style={{
            marginTop: 8,
            backgroundColor: colors.accent,
            borderRadius: 10,
            paddingHorizontal: 18,
            paddingVertical: 9,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{actionLabel ?? 'Tekrar dene'}</Text>
        </Pressable>
      )}
      {kind === 'empty' && !!actionLabel && !!onAction && (
        <Pressable
          onPress={onAction}
          style={{
            marginTop: 8,
            backgroundColor: colors.accent,
            borderRadius: 10,
            paddingHorizontal: 18,
            paddingVertical: 9,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
