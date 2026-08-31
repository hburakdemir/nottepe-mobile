import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calculator, CalendarDays, ChevronRight, HeartHandshake, HelpCircle, Lightbulb, ListChecks, Trophy, UtensilsCrossed } from 'lucide-react-native';
import type { RootStackParamList } from '../../navigation/types';

const TOOLS = [
  {
    key: 'Checklists' as const,
    icon: ListChecks,
    title: 'Checklistler',
    desc: 'Kayıt dönemi, mezuniyet ve daha fazlası için yapılacaklar listeleri.',
  },
  {
    key: 'AktsCalculator' as const,
    icon: Calculator,
    title: 'AKTS / GANO Hesapla',
    desc: 'Derslerini gir, ortalamanı ve kredi durumunu anında gör.',
  },
  {
    key: 'Schedule' as const,
    icon: CalendarDays,
    title: 'Ders Programı',
    desc: 'Haftalık ders programını oluştur, düzenle.',
  },
  {
    key: 'NoteRequests' as const,
    icon: HeartHandshake,
    title: 'Not İstekleri',
    desc: 'Aradığın notu bulamadın mı? İste, elinde olan karşılasın.',
  },
  {
    key: 'Faq' as const,
    icon: HelpCircle,
    title: 'Sık Sorulan Sorular',
    desc: 'Merak edilenler ve kullanıcı tartışmaları.',
  },
  {
    key: 'Suggestions' as const,
    icon: Lightbulb,
    title: 'Öneriler',
    desc: "Nottepe'yi nasıl daha iyi yapabiliriz?",
  },
  {
    key: 'CafeteriaMenu' as const,
    icon: UtensilsCrossed,
    title: 'Yemek Listesi',
    desc: 'Hacettepe yemekhanesinin günlük ve haftalık menüsü.',
  },
  {
    key: 'Leaderboard' as const,
    icon: Trophy,
    title: 'Liderlik Tablosu',
    desc: 'En yüksek seri, en çok onaylı not ve rozete sahip öğrenciler.',
  },
];

export default function ToolsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Araçlar</Text>
      <View style={{ gap: 12 }}>
        {TOOLS.map(({ key, icon: Icon, title, desc }) => (
          <Pressable key={key} style={styles.card} onPress={() => navigation.navigate(key as any)}>
            <View style={styles.iconWrap}>
              <Icon size={22} color="#2F5755" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardDesc}>{desc}</Text>
            </View>
            <ChevronRight size={18} color="#9ca3af" />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },
  header: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2F575519',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardDesc: { fontSize: 12.5, color: '#6b7280', marginTop: 2, lineHeight: 17 },
});
