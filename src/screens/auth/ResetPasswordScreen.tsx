import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertCircle, Eye, EyeOff, Lock } from 'lucide-react-native';
import { passwordApi } from '../../lib/api';
import AuthHeader from '../../components/auth/AuthHeader';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen({ route, navigation }: Props) {
  const { email } = route.params;
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AuthHeader icon={<Lock size={26} color="#2F5755" />} title="Yeni Şifre Belirle" subtitle={`${email} adresine gönderilen kodu girin`} />

      {!!error && (
        <View style={styles.alertError}>
          <AlertCircle size={16} color="#b91c1c" />
          <Text style={styles.alertErrorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.label}>Doğrulama Kodu *</Text>
      <TextInput
        style={styles.codeInput}
        maxLength={6}
        placeholder="000000"
        placeholderTextColor="#d1d5db"
        keyboardType="number-pad"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
      />

      <Text style={styles.label}>Yeni Şifre *</Text>
      <View style={styles.inputRow}>
        <Lock size={18} color="#4f7d7a" />
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#9ca3af"
          secureTextEntry={!showPassword}
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
          {showPassword ? <Eye size={18} color="#6b7280" /> : <EyeOff size={18} color="#6b7280" />}
        </Pressable>
      </View>
      <Text style={styles.hintText}>En az 5 karakter, 1 büyük harf ve 1 noktalama işareti</Text>

      <Text style={styles.label}>Şifre Tekrar *</Text>
      <View style={styles.inputRow}>
        <Lock size={18} color="#4f7d7a" />
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#9ca3af"
          secureTextEntry={!showConfirmPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <Pressable onPress={() => setShowConfirmPassword((v) => !v)} hitSlop={8}>
          {showConfirmPassword ? <Eye size={18} color="#6b7280" /> : <EyeOff size={18} color="#6b7280" />}
        </Pressable>
      </View>

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Şifreyi Değiştir</Text>}
      </Pressable>

      <Pressable style={styles.resendLink} onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.resendLinkText}>Kodu tekrar gönder</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  alertError: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 12, marginBottom: 16 },
  alertErrorText: { color: '#b91c1c', fontSize: 13, flex: 1 },
  label: { fontSize: 13.5, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 14 },
  codeInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 6,
    textAlign: 'center',
    color: '#111827',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#111827' },
  hintText: { fontSize: 11, color: '#9ca3af', marginTop: 5 },
  button: { backgroundColor: '#2F5755', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resendLink: { alignItems: 'center', marginTop: 16 },
  resendLinkText: { color: '#2F5755', fontSize: 13.5, fontWeight: '600' },
});
