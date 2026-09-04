import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertCircle, Eye, EyeOff, Lock } from 'lucide-react-native';
import { passwordApi } from '../../lib/api';
import { useThemeColors } from '../../context/ThemeContext';
import AuthHeader from '../../components/auth/AuthHeader';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen({ route, navigation }: Props) {
  const { email } = route.params;
  // Renkler StyleSheet'ten çıkarıldı; aşağıdaki stiller sadece ölçü/tipografi.
  const colors = useThemeColors();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    if (!code || code.length !== 6) {
      setError('6 haneli kodu girin.');
      return false;
    }
    if (newPassword.length < 5) {
      setError('Şifre en az 5 karakter olmalıdır');
      return false;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError('Şifre en az 1 büyük harf içermelidir');
      return false;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      setError('Şifre en az 1 noktalama işareti içermelidir (!@#$%^&* vb.)');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await passwordApi.resetPassword(email, code, newPassword);
      Alert.alert('Başarılı', 'Şifreniz başarıyla değiştirildi. Giriş yapabilirsiniz.');
      navigation.navigate('Login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Kod hatalı veya süresi dolmuş. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={[styles.container, { backgroundColor: colors.ground }]} contentContainerStyle={styles.content}>
      <AuthHeader
        icon={<Lock size={26} color={colors.accent} />}
        title="Yeni Şifre Belirle"
        subtitle={`${email} adresine gönderilen kodu girin`}
      />

      {!!error && (
        <View style={[styles.alertError, { backgroundColor: colors.dangerSoft, borderColor: colors.dangerLine }]}>
          <AlertCircle size={16} color={colors.danger} />
          <Text style={[styles.alertErrorText, { color: colors.danger }]}>{error}</Text>
        </View>
      )}

      <Text style={[styles.label, { color: colors.ink2 }]}>Doğrulama Kodu *</Text>
      <TextInput
        style={[styles.codeInput, { borderColor: colors.line, color: colors.ink }]}
        maxLength={6}
        placeholder="000000"
        placeholderTextColor={colors.line}
        keyboardType="number-pad"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
      />

      <Text style={[styles.label, { color: colors.ink2 }]}>Yeni Şifre *</Text>
      <View style={[styles.inputRow, { borderColor: colors.line }]}>
        <Lock size={18} color={colors.accent} />
        <TextInput
          style={[styles.input, { color: colors.ink }]}
          placeholder="••••••••"
          placeholderTextColor={colors.muted2}
          secureTextEntry={!showPassword}
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
          {showPassword ? <Eye size={18} color={colors.muted} /> : <EyeOff size={18} color={colors.muted} />}
        </Pressable>
      </View>
      <Text style={[styles.hintText, { color: colors.muted2 }]}>En az 5 karakter, 1 büyük harf ve 1 noktalama işareti</Text>

      <Text style={[styles.label, { color: colors.ink2 }]}>Şifre Tekrar *</Text>
      <View style={[styles.inputRow, { borderColor: colors.line }]}>
        <Lock size={18} color={colors.accent} />
        <TextInput
          style={[styles.input, { color: colors.ink }]}
          placeholder="••••••••"
          placeholderTextColor={colors.muted2}
          secureTextEntry={!showConfirmPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <Pressable onPress={() => setShowConfirmPassword((v) => !v)} hitSlop={8}>
          {showConfirmPassword ? <Eye size={18} color={colors.muted} /> : <EyeOff size={18} color={colors.muted} />}
        </Pressable>
      </View>

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Şifreyi Değiştir</Text>}
      </Pressable>

      <Pressable style={styles.resendLink} onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={[styles.resendLinkText, { color: colors.accent }]}>Kodu tekrar gönder</Text>
      </Pressable>
    </ScrollView>
  );
}

// Renkler kullanım yerinde (useThemeColors) — burada sadece ölçü/tipografi.
// Tek istisna marka butonu ve üstündeki beyaz yazı.
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
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
  label: { fontSize: 13.5, fontWeight: '600', marginBottom: 8, marginTop: 14 },
  codeInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 6,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 13, fontSize: 15 },
  hintText: { fontSize: 11, marginTop: 5 },
  button: { backgroundColor: '#2F5755', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resendLink: { alignItems: 'center', marginTop: 16 },
  resendLinkText: { fontSize: 13.5, fontWeight: '600' },
});
