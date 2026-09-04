import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertCircle, ArrowLeft, Mail } from 'lucide-react-native';
import { passwordApi } from '../../lib/api';
import { useThemeColors } from '../../context/ThemeContext';
import AuthHeader from '../../components/auth/AuthHeader';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ navigation }: Props) {
  // Renkler StyleSheet'ten çıkarıldı; aşağıdaki stiller sadece ölçü/tipografi.
  const colors = useThemeColors();
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
    <View style={[styles.container, { backgroundColor: colors.ground }]}>
      <AuthHeader
        icon={<Mail size={26} color={colors.accent} />}
        title="Şifremi Unuttum"
        subtitle="Email adresinize şifre sıfırlama kodu göndereceğiz"
      />

      {!!error && (
        <View style={[styles.alertError, { backgroundColor: colors.dangerSoft, borderColor: colors.dangerLine }]}>
          <AlertCircle size={16} color={colors.danger} />
          <Text style={[styles.alertErrorText, { color: colors.danger }]}>{error}</Text>
        </View>
      )}

      <Text style={[styles.label, { color: colors.ink2 }]}>E-posta Adresi</Text>
      <View style={[styles.inputRow, { borderColor: colors.line }]}>
        <Mail size={18} color={colors.accent} />
        <TextInput
          style={[styles.input, { color: colors.ink }]}
          placeholder="ornek@gmail.com"
          placeholderTextColor={colors.muted2}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setError('');
          }}
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
        <ArrowLeft size={14} color={colors.accent} />
        <Text style={[styles.backLinkText, { color: colors.accent }]}>Giriş sayfasına dön</Text>
      </Pressable>
    </View>
  );
}

// Renkler kullanım yerinde (useThemeColors) — burada sadece ölçü/tipografi.
// Tek istisna marka butonu ve üstündeki beyaz yazı.
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  alertError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  alertErrorText: { fontSize: 13, flex: 1 },
  label: { fontSize: 13.5, fontWeight: '600', marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  input: { flex: 1, paddingVertical: 13, fontSize: 15 },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2F5755',
    borderRadius: 10,
    paddingVertical: 14,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 },
  backLinkText: { fontSize: 13.5, fontWeight: '600' },
});
