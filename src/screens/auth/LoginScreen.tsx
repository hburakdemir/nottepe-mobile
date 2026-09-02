import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertCircle, Eye, EyeOff, Lock, LogIn, Send, User } from 'lucide-react-native';
import { authAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import AuthHeader from '../../components/auth/AuthHeader';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) {
      setError('Kullanıcı adı ve şifre gereklidir.');
      return;
    }
    setError(null);
    setEmailNotVerified(false);
    setSubmitting(true);
    const result = await login({ username, password });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Giriş yapılamadı.');
      if (result.error?.includes('email adresinizi doğrulayın')) {
        setEmailNotVerified(true);
        if (result.email) setUserEmail(result.email);
      }
    }
  };

  const handleResendAndVerify = async () => {
    if (!userEmail) {
      setError('Email adresi bulunamadı. Lütfen tekrar giriş yapmayı deneyin.');
      return;
    }
    setResendLoading(true);
    setError(null);
    try {
      await authAPI.resendCode(userEmail);
      navigation.navigate('VerifyEmail', { email: userEmail });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Kod gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AuthHeader icon={<LogIn size={26} color="#2F5755" />} title="Giriş Yap" subtitle="Hesabınıza giriş yapın" />

        {!!error && (
          <View style={styles.alertError}>
            <AlertCircle size={17} color="#b91c1c" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertErrorText}>{error}</Text>
              {emailNotVerified && (
                <Pressable style={styles.resendBtn} onPress={handleResendAndVerify} disabled={resendLoading}>
                  <Send size={14} color="#fff" />
                  <Text style={styles.resendBtnText}>{resendLoading ? 'Gönderiliyor...' : 'Doğrulama Kodu Gönder'}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        <Text style={styles.label}>Kullanıcı Adı</Text>
        <View style={styles.inputRow}>
          <User size={18} color="#4f7d7a" />
          <TextInput
            style={styles.input}
            placeholder="kullanıcı adınız"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
            onChangeText={(t) => {
              setUsername(t);
              setError(null);
              setEmailNotVerified(false);
            }}
          />
        </View>

        <Text style={styles.label}>Şifre</Text>
        <View style={styles.inputRow}>
          <Lock size={18} color="#4f7d7a" />
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="•••••••"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError(null);
              setEmailNotVerified(false);
            }}
          />
          <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
            {showPassword ? <Eye size={18} color="#6b7280" /> : <EyeOff size={18} color="#6b7280" />}
          </Pressable>
        </View>

        <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <LogIn size={18} color="#fff" />
              <Text style={styles.buttonText}>Giriş Yap</Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.forgotLink} onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={styles.forgotLinkText}>Şifremi unuttum</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Register')}>
          <Text style={styles.link}>
            Hesabınız yok mu? <Text style={styles.linkStrong}>Kayıt Ol</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  alertError: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  alertErrorText: { color: '#b91c1c', fontSize: 13, flex: 1 },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2F5755',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 10,
  },
  resendBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  label: { fontSize: 13.5, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#111827' },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2F5755',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 6,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  forgotLink: { alignItems: 'flex-end', marginTop: 14 },
  forgotLinkText: { color: '#2F5755', fontSize: 13, fontWeight: '600' },
  link: { textAlign: 'center', marginTop: 16, color: '#6b7280', fontSize: 13.5 },
  linkStrong: { color: '#2F5755', fontWeight: '700' },
});
