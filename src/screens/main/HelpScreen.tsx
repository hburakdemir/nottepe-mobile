import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, ExternalLink, HelpCircle, Mail, Send, Target } from 'lucide-react-native';
import { feedbackAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import helpFaq from '../../data/helpFaq';

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <View style={{ gap: 10 }}>
      {helpFaq.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <View key={item.q} style={styles.faqCard}>
            <Pressable style={styles.faqHeader} onPress={() => setOpenIndex(isOpen ? -1 : i)}>
              <Text style={styles.faqQuestion}>{item.q}</Text>
              <ChevronDown size={18} color="#93c5fd" style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
            </Pressable>
            {isOpen && <Text style={styles.faqAnswer}>{item.a}</Text>}
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
    <View style={styles.feedbackCard}>
      <Text style={styles.feedbackTitle}>Bize Yazın</Text>
      <Text style={styles.feedbackSubtitle}>Fikir, öneri veya sorun bildirimlerin doğrudan bize ulaşır.</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Adın" placeholderTextColor="#6b7280" />
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="E-posta adresin"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={[styles.input, styles.textArea]}
        value={message}
        onChangeText={setMessage}
        placeholder="Mesajın..."
        placeholderTextColor="#6b7280"
        multiline
      />
      <Pressable style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={handleSubmit} disabled={sending}>
        {sending ? <ActivityIndicator color="#fff" /> : <Send size={15} color="#fff" />}
        <Text style={styles.sendBtnText}>{sending ? 'Gönderiliyor...' : 'Gönder'}</Text>
      </Pressable>
    </View>
  );
}

export default function HelpScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Biz Kimiz</Text>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Target size={20} color="#60a5fa" />
          <Text style={styles.cardTitle}>Misyonumuz</Text>
        </View>
        <Text style={styles.cardText}>
          Bu platformu yapma amacımız Hacettepe Üniversitesi öğrencilerinin notlara kolayca ulaşabilmesi ve
          birbirleriyle paylaşabilmesi. Öğrenciler arasında bilgi paylaşımını kolaylaştırmak ve akademik başarıya
          katkıda bulunmak istiyoruz.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <HelpCircle size={20} color="#60a5fa" />
          <Text style={styles.cardTitle}>Sık Sorulan Sorular</Text>
        </View>
        <FaqAccordion />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>İletişim</Text>
        <Pressable style={styles.contactRow} onPress={() => Linking.openURL('mailto:burakd279@gmail.com')}>
          <Mail size={16} color="#fff" />
          <Text style={styles.contactText}>burakd279@gmail.com</Text>
        </Pressable>
        <Pressable style={styles.contactRow} onPress={() => Linking.openURL('https://www.linkedin.com/in/hburakdmr')}>
          <ExternalLink size={16} color="#fff" />
          <Text style={styles.contactText}>LinkedIn — Hakan Burak Demir</Text>
        </Pressable>
        <Pressable style={styles.contactRow} onPress={() => Linking.openURL('http://www.instagram.com/hacettepecumhuriyet')}>
          <ExternalLink size={16} color="#fff" />
          <Text style={styles.contactText}>Instagram — Hacettepe Cumhuriyet</Text>
        </Pressable>
      </View>

      <FeedbackForm />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 16, textAlign: 'center' },
  card: { backgroundColor: '#1e293b', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6 },
  cardText: { fontSize: 13, color: '#cbd5e1', lineHeight: 19 },
  faqCard: { backgroundColor: '#0f172a', borderRadius: 14, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 14 },
  faqQuestion: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#fff' },
  faqAnswer: { fontSize: 12.5, color: '#cbd5e1', lineHeight: 18, paddingHorizontal: 14, paddingBottom: 14 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#334155',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  contactText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  feedbackCard: { backgroundColor: '#1e293b', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#334155' },
  feedbackTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  feedbackSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 4, marginBottom: 14 },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13.5,
    color: '#fff',
    marginBottom: 10,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    borderRadius: 100,
    paddingVertical: 13,
    marginTop: 4,
  },
  sendBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
});
