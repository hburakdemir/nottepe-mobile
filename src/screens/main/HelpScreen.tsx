import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ChevronDown, ExternalLink, HelpCircle, Mail, Send, Target } from 'lucide-react-native';
import { feedbackAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import helpFaq from '../../data/helpFaq';

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <View className="gap-2.5">
      {helpFaq.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <View key={item.q} className="bg-slate-900 rounded-[14px] border border-slate-700 overflow-hidden">
            <Pressable className="flex-row items-center justify-between gap-2.5 p-3.5" onPress={() => setOpenIndex(isOpen ? -1 : i)}>
              <Text className="flex-1 text-[13.5px] font-semibold text-white">{item.q}</Text>
              <ChevronDown size={18} color="#93c5fd" style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
            </Pressable>
            {isOpen && <Text className="text-[12.5px] text-slate-300 leading-[18px] px-3.5 pb-3.5">{item.a}</Text>}
          </View>
        );
      })}
    </View>
  );
}

function FeedbackForm() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
      return;
    }
    setSending(true);
    try {
      await feedbackAPI.send({ name, email, message });
      Alert.alert('Başarılı', 'Mesajın alındı, en kısa sürede döneceğiz!');
      setMessage('');
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Mesaj gönderilemedi, lütfen tekrar deneyin.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View className="bg-slate-800 rounded-[18px] p-[18px] border border-slate-700">
      <Text className="text-[17px] font-bold text-white">Bize Yazın</Text>
      <Text className="text-xs text-slate-400 mt-1 mb-3.5">Fikir, öneri veya sorun bildirimlerin doğrudan bize ulaşır.</Text>
      <TextInput
        className="bg-slate-900 border border-slate-600 rounded-[10px] px-3.5 py-[11px] text-[13.5px] text-white mb-2.5"
        value={name}
        onChangeText={setName}
        placeholder="Adın"
        placeholderTextColor="#6b7280"
      />
      <TextInput
        className="bg-slate-900 border border-slate-600 rounded-[10px] px-3.5 py-[11px] text-[13.5px] text-white mb-2.5"
        value={email}
        onChangeText={setEmail}
        placeholder="E-posta adresin"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        className="bg-slate-900 border border-slate-600 rounded-[10px] px-3.5 py-[11px] text-[13.5px] text-white mb-2.5 min-h-[90px]"
        style={{ textAlignVertical: 'top' }}
        value={message}
        onChangeText={setMessage}
        placeholder="Mesajın..."
        placeholderTextColor="#6b7280"
        multiline
      />
      <Pressable
        className={`flex-row items-center justify-center gap-2 bg-blue-600 rounded-full py-[13px] mt-1 ${sending ? 'opacity-60' : ''}`}
        onPress={handleSubmit}
        disabled={sending}
      >
        {sending ? <ActivityIndicator color="#fff" /> : <Send size={15} color="#fff" />}
        <Text className="text-white text-[13.5px] font-bold">{sending ? 'Gönderiliyor...' : 'Gönder'}</Text>
      </Pressable>
    </View>
  );
}

export default function HelpScreen() {
  return (
    <ScrollView className="flex-1 bg-slate-900" contentContainerClassName="p-4 pb-10">
      <Text className="text-[26px] font-extrabold text-white mb-4 text-center">Biz Kimiz</Text>

      <View className="bg-slate-800 rounded-[18px] p-4 mb-3.5 border border-slate-700">
        <View className="flex-row items-center gap-2 mb-3">
          <Target size={20} color="#60a5fa" />
          <Text className="text-base font-bold text-white mb-1.5">Misyonumuz</Text>
        </View>
        <Text className="text-[13px] text-slate-300 leading-[19px]">
          Bu platformu yapma amacımız Hacettepe Üniversitesi öğrencilerinin notlara kolayca ulaşabilmesi ve
          birbirleriyle paylaşabilmesi. Öğrenciler arasında bilgi paylaşımını kolaylaştırmak ve akademik başarıya
          katkıda bulunmak istiyoruz.
        </Text>
      </View>

      <View className="bg-slate-800 rounded-[18px] p-4 mb-3.5 border border-slate-700">
        <View className="flex-row items-center gap-2 mb-3">
          <HelpCircle size={20} color="#60a5fa" />
          <Text className="text-base font-bold text-white mb-1.5">Sık Sorulan Sorular</Text>
        </View>
        <FaqAccordion />
      </View>

      <View className="bg-slate-800 rounded-[18px] p-4 mb-3.5 border border-slate-700">
        <Text className="text-base font-bold text-white mb-1.5">İletişim</Text>
        <Pressable className="flex-row items-center gap-2.5 bg-slate-700 rounded-full px-4 py-3 mt-2" onPress={() => Linking.openURL('mailto:burakd279@gmail.com')}>
          <Mail size={16} color="#fff" />
          <Text className="text-white text-[13px] font-semibold">burakd279@gmail.com</Text>
        </Pressable>
        <Pressable className="flex-row items-center gap-2.5 bg-slate-700 rounded-full px-4 py-3 mt-2" onPress={() => Linking.openURL('https://www.linkedin.com/in/hburakdmr')}>
          <ExternalLink size={16} color="#fff" />
          <Text className="text-white text-[13px] font-semibold">LinkedIn — Hakan Burak Demir</Text>
        </Pressable>
        <Pressable className="flex-row items-center gap-2.5 bg-slate-700 rounded-full px-4 py-3 mt-2" onPress={() => Linking.openURL('http://www.instagram.com/hacettepecumhuriyet')}>
          <ExternalLink size={16} color="#fff" />
          <Text className="text-white text-[13px] font-semibold">Instagram — Hacettepe Cumhuriyet</Text>
        </Pressable>
      </View>

      <FeedbackForm />
    </ScrollView>
  );
}
