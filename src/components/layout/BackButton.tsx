import React from 'react';
import { Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';

// Tüm ekranlardaki native başlık geri tuşu bilinçli olarak buradan geliyor
// (screenOptions.headerLeft, RootNavigator + AuthNavigator) — sadece "<" ikonu,
// çerçeve/arka plan/daire yok; iOS'un varsayılan "< Başlık" metnini ve
// Android'in ripple dairesini ezip her platformda aynı sade görünümü verir.
export default function BackButton({ tintColor }: { tintColor?: string }) {
  const navigation = useNavigation();
  if (!navigation.canGoBack()) return null;

  return (
    <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Geri" accessibilityRole="button">
      <ChevronLeft size={26} color={tintColor ?? '#111827'} />
    </Pressable>
  );
}
