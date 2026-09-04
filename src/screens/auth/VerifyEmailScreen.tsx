import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Mail } from 'lucide-react-native';
import { authAPI } from '../../lib/api';
import { useThemeColors } from '../../context/ThemeContext';
import AuthHeader from '../../components/auth/AuthHeader';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen({ route, navigation }: Props) {
  const { email } = route.params;
  // Renkler StyleSheet'ten çıkarıldı; aşağıdaki stiller sadece ölçü/tipografi.
  const colors = useThemeColors();
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
    <View style={[styles.container, { backgroundColor: colors.ground }]}>
      <AuthHeader
        icon={<Mail size={26} color={colors.accent} />}
        title="Email Doğrulama"
        subtitle={`${email} adresine gönderilen 6 haneli kodu girin`}
      />

      <TextInput
        style={[styles.codeInput, { borderColor: colors.line, color: colors.ink }]}
        maxLength={6}
        placeholder="000000"
        placeholderTextColor={colors.line}
        keyboardType="number-pad"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
      />

      {!!error && (
        <View style={[styles.alertError, { backgroundColor: colors.dangerSoft, borderColor: colors.dangerLine }]}>
          <Text style={[styles.alertErrorText, { color: colors.danger }]}>{error}</Text>
        </View>
      )}
      {!!success && (
        <View style={[styles.alertSuccess, { backgroundColor: colors.successSoft, borderColor: colors.successLine }]}>
          <Text style={[styles.alertSuccessText, { color: colors.success }]}>{success}</Text>
        </View>
      )}

      <Pressable
        style={[styles.button, code.length !== 6 && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={loading || code.length !== 6}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Doğrula</Text>}
      </Pressable>

      <Pressable style={styles.resendLink} onPress={handleResend} disabled={resendLoading}>
        <Text style={[styles.resendLinkText, { color: colors.accent }]}>{resendLoading ? 'Gönderiliyor...' : 'Kodu tekrar gönder'}</Text>
      </Pressable>
    </View>
  );
}

// Renkler kullanım yerinde (useThemeColors) — burada sadece ölçü/tipografi.
// Tek istisna marka butonu ve üstündeki beyaz yazı.
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  codeInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 16,
    fontSize: 26,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 16,
  },
  alertError: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 14 },
  alertErrorText: { fontSize: 13 },
  alertSuccess: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 14 },
  alertSuccessText: { fontSize: 13 },
  button: { backgroundColor: '#2F5755', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resendLink: { alignItems: 'center', marginTop: 18 },
  resendLinkText: { fontSize: 13.5, fontWeight: '600' },
});
