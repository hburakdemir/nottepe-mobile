import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Mail } from 'lucide-react-native';
import { authAPI } from '../../lib/api';
import AuthHeader from '../../components/auth/AuthHeader';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen({ route, navigation }: Props) {
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const handleVerify = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await authAPI.verifyEmail(email, code);
      Alert.alert('Başarılı', 'Email doğrulandı! Giriş yapabilirsiniz.');
      navigation.navigate('Login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Doğrulama başarısız');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSuccess('');
    setResendLoading(true);
    try {
      const res = await authAPI.resendCode(email);
      setSuccess(res.data?.message || 'Yeni kod gönderildi!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Kod gönderilemedi');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AuthHeader
        icon={<Mail size={26} color="#2F5755" />}
        title="Email Doğrulama"
        subtitle={`${email} adresine gönderilen 6 haneli kodu girin`}
      />

      <TextInput
        style={styles.codeInput}
        maxLength={6}
        placeholder="000000"
        placeholderTextColor="#d1d5db"
        keyboardType="number-pad"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
      />

      {!!error && (
        <View style={styles.alertError}>
          <Text style={styles.alertErrorText}>{error}</Text>
        </View>
      )}
      {!!success && (
        <View style={styles.alertSuccess}>
          <Text style={styles.alertSuccessText}>{success}</Text>
        </View>
      )}

      <Pressable style={[styles.button, code.length !== 6 && styles.buttonDisabled]} onPress={handleVerify} disabled={loading || code.length !== 6}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Doğrula</Text>}
      </Pressable>

      <Pressable style={styles.resendLink} onPress={handleResend} disabled={resendLoading}>
        <Text style={styles.resendLinkText}>{resendLoading ? 'Gönderiliyor...' : 'Kodu tekrar gönder'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', paddingHorizontal: 24 },
  codeInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 16,
    fontSize: 26,
    letterSpacing: 8,
    textAlign: 'center',
    color: '#111827',
    marginBottom: 16,
  },
  alertError: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 12, marginBottom: 14 },
  alertErrorText: { color: '#b91c1c', fontSize: 13 },
  alertSuccess: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 10, padding: 12, marginBottom: 14 },
  alertSuccessText: { color: '#15803d', fontSize: 13 },
  button: { backgroundColor: '#2F5755', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resendLink: { alignItems: 'center', marginTop: 18 },
  resendLinkText: { color: '#2F5755', fontSize: 13.5, fontWeight: '600' },
});
