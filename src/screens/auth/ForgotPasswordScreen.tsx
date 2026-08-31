import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertCircle, ArrowLeft, Mail } from 'lucide-react-native';
import { passwordApi } from '../../lib/api';
import AuthHeader from '../../components/auth/AuthHeader';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!EMAIL_RE.test(email)) {
      setError('Geçerli bir email adresi girin.');
      return;
    }
    setLoading(true);
    try {
      await passwordApi.forgotPassword(email.trim());
      navigation.navigate('ResetPassword', { email: email.trim() });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AuthHeader
        icon={<Mail size={26} color="#2F5755" />}
        title="Şifremi Unuttum"
        subtitle="Email adresinize şifre sıfırlama kodu göndereceğiz"
      />

      {!!error && (
        <View style={styles.alertError}>
          <AlertCircle size={16} color="#b91c1c" />
          <Text style={styles.alertErrorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.label}>E-posta Adresi</Text>
      <View style={styles.inputRow}>
        <Mail size={18} color="#4f7d7a" />
        <TextInput
          style={styles.input}
          placeholder="ornek@gmail.com"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={(t) => { setEmail(t); setError(''); }}
        />
      </View>

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Mail size={18} color="#fff" />
            <Text style={styles.buttonText}>Kod Gönder</Text>
          </>
        )}
      </Pressable>

      <Pressable style={styles.backLink} onPress={() => navigation.navigate('Login')}>
        <ArrowLeft size={14} color="#2F5755" />
        <Text style={styles.backLinkText}>Giriş sayfasına dön</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', paddingHorizontal: 24 },
  alertError: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 12, marginBottom: 16 },
  alertErrorText: { color: '#b91c1c', fontSize: 13, flex: 1 },
  label: { fontSize: 13.5, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, marginBottom: 20 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#111827' },
  button: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#2F5755', borderRadius: 10, paddingVertical: 14 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 },
  backLinkText: { color: '#2F5755', fontSize: 13.5, fontWeight: '600' },
});
