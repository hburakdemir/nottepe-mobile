import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { WifiOff, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { navigateWhenReady } from '../navigation/navigationRef';

// Ortak yükleme/hata/boş/çevrimdışı durumu — eskiden 25+ ekranın her biri
// kendi "… yüklenemedi" `<Text>`'ini ya da `Alert.alert('Hata', …)` çağrısını
// elle yazıyordu; hiçbirinde "tekrar dene" yoktu ve çevrimdışı için AYRI bir
// dal hiçbirinde yoktu (bkz. RootNavigator.tsx'teki tam çevrimdışı kilidi —
// bu bileşen, kilidin YAKALAYAMADIĞI durumlar için var: kilit yalnızca
// `expo-network`in `isConnected:false` dediği zaman devreye giriyor; zayıf
// sinyal/DNS/kısıtlı-portal gibi "bağlıyım ama istek hiç bitmiyor" durumlarını
// yakalamıyor).
//
// `kind="loading"` iken 1 saniye sonra HÂLÂ yükleniyorsa (istek bu kadar
// gecikmesi zaten anormal — bkz. api.ts'teki 12sn timeout + react-query'nin
// `retry:1`'i, normalde bu ikisi çok daha hızlı başarı/hataya düşer) ekran
// sessizce dönmeye devam etmek yerine doğrudan "İnternet bağlantınız yok"
// mesajına geçiyor — kullanıcı isteği ("internet gittiğinde loading spinner
// çok uzun dönüyor, 1 saniye dönmeli sonra internet bağlantınız yok demeli").
const LOADING_TO_OFFLINE_MS = 1000;

interface Props {
  kind: 'loading' | 'error' | 'empty' | 'offline';
  icon?: LucideIcon;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** `kind="loading"` için ActivityIndicator rengi — çağıran ekranın kendi vurgu rengi. */
  loadingColor?: string;
}

function OfflineMessage({ compact }: { compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 4, paddingVertical: compact ? 8 : 24, paddingHorizontal: 24 }}>
      <WifiOff size={compact ? 20 : 28} color={colors.warn} style={{ marginBottom: 4 }} />
      <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: '700', textAlign: 'center' }}>İnternet bağlantınız yok</Text>
      <Pressable onPress={() => navigateWhenReady('Ego130Schedule')} hitSlop={8}>
        <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: '600', marginTop: 2, textAlign: 'center' }}>
          Ring seferlerini görmek ister misiniz?
        </Text>
      </Pressable>
    </View>
  );
}

export default function StateView({ kind, icon: Icon, title, message, actionLabel, onAction, loadingColor }: Props) {
  const { colors } = useTheme();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (kind !== 'loading') {
      setLoadingTimedOut(false);
      return;
    }
    const id = setTimeout(() => setLoadingTimedOut(true), LOADING_TO_OFFLINE_MS);
    return () => clearTimeout(id);
  }, [kind]);

  if (kind === 'loading') {
    if (loadingTimedOut) return <OfflineMessage />;
    return (
      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
        <ActivityIndicator size="large" color={loadingColor ?? colors.accent} />
      </View>
    );
  }

  if (kind === 'offline') {
    return <OfflineMessage />;
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
