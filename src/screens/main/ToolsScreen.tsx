import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bus,
  Calculator,
  CalendarDays,
  HeartHandshake,
  HelpCircle,
  Lightbulb,
  ListChecks,
  MessageCircleQuestion,
  Trophy,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import type { RootStackParamList } from '../../navigation/types';

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

// Web'de "Araçlar" iki yerde var: /araclar hub sayfası (6 kart, bkz.
// ToolsHubPage.jsx — kart tasarımının kaynağı burası) ve masaüstü Navbar'ın
// Araçlar dropdown'u (9 link — SSS/Öneriler/Yardım da orada). Mobilde ayrı bir
// dropdown olmadığından ikisi tek ekranda birleşti (9 link), ama kart görseli
// (ikon kutusu üstte, başlık altında, açıklama altında — 24px iç boşluk,
// rounded-xl+shadow-md) hub sayfasınınkiyle birebir aynı.
const TOOLS = [
  {
    key: 'AktsCalculator' as const,
    icon: Calculator,
    title: 'AKTS / GANO Hesaplama',
    desc: "Derslerini gir veya Excel'den aktar; GANO'nu, dönem ortalamalarını, not senaryolarını ve hedef GANO planını hesapla.",
  },
  {
    key: 'CafeteriaMenu' as const,
    icon: UtensilsCrossed,
    title: 'Yemek Listesi',
    desc: 'Hacettepe yemekhanesinin günlük ve haftalık menüsü — kaloriler ve alerjen bilgileriyle birlikte.',
  },
  {
    key: 'Checklists' as const,
    icon: ListChecks,
    title: 'Checklistler',
    desc: 'Kayıt dönemi, mezuniyet ve daha fazlası için hazırlanmış checklistler. İşaretlediklerin hesabında saklanır.',
  },
  {
    key: 'Schedule' as const,
    icon: CalendarDays,
    title: 'Ders Programı',
    desc: 'Haftalık ders programını oluştur; çakışmaları anında gör.',
  },
  {
    key: 'Ego130Schedule' as const,
    icon: Bus,
    title: '130 Ring Saatleri',
    desc: 'Beytepe Metro İstasyonu - Hacettepe Beytepe Kampüsü ring hattının sefer saatleri, internetsizken de çalışır.',
  },
  {
    key: 'NoteRequests' as const,
    icon: HeartHandshake,
    title: 'Not İstekleri',
    desc: 'Aradığın notu bulamadın mı? İstek aç — elinde olan karşılasın. İsteği karşılayanlar rozet kazanır.',
  },
  {
    key: 'Leaderboard' as const,
    icon: Trophy,
    title: 'Liderlik Tablosu',
    desc: 'En yüksek seriye, en çok onaylı nota ve en çok rozete sahip öğrenciler kimler — sıralamada yerini gör.',
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
    key: 'Help' as const,
    icon: MessageCircleQuestion,
    title: 'Yardım ve İletişim',
    desc: 'Biz kimiz, sık sorulanlar ve bize ulaşma yolları.',
  },
];

export default function ToolsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <ScrollView className="flex-1 bg-primary dark:bg-darkbgbutton" contentContainerClassName="p-4 pt-6">
      <View className="flex-row items-center gap-3">
        <Wrench size={32} color={isDark ? '#5A9690' : '#2F5755'} />
        <Text className="text-3xl font-bold text-gray-900 dark:text-darktext">Araçlar</Text>
      </View>
      <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-6">Öğrenci hayatını kolaylaştıran Nottepe araçları</Text>

      <View className="gap-6">
        {TOOLS.map(({ key, icon: Icon, title, desc }) => (
          <Pressable
            key={key}
            className="bg-primary dark:bg-darkbgbutton rounded-xl p-6"
            style={SHADOW_MD}
            onPress={() => navigation.navigate(key as any)}
          >
            <View className="w-12 h-12 rounded-lg bg-brand/10 dark:bg-brand-light/20 items-center justify-center mb-4">
              <Icon size={24} color={isDark ? '#5A9690' : '#2F5755'} />
            </View>
            <Text className="text-lg font-semibold text-gray-900 dark:text-darktext mb-2">{title}</Text>
            <Text className="text-sm text-gray-600 dark:text-gray-400 leading-5">{desc}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
