import React, { useState } from 'react';
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
import { AlertCircle, Check, Eye, EyeOff, Lock, Mail, Phone, User, UserPlus } from 'lucide-react-native';
import { authAPI } from '../../lib/api';
import AuthHeader from '../../components/auth/AuthHeader';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const PUNCTUATION_RE = /[!@#$%^&*(),.?":{}|<>]/;
const TURKISH_NAME_RE = /^[ abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ruleMinLen = password.length >= 5;
  const ruleUpper = /[A-Z]/.test(password);
  const rulePunct = PUNCTUATION_RE.test(password);

  const validate = (): boolean => {
    const trimmedFullName = fullName.trim();
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFullName || !trimmedUsername || !trimmedEmail || !password || !confirmPassword) {
      setError('Lütfen zorunlu alanları doldurun');
      return false;
    }
    if (!TURKISH_NAME_RE.test(trimmedFullName)) {
      setError('İsim sadece Türkçe harf ve boşluk içerebilir');
      return false;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Geçerli bir email adresi girin');
      return false;
    }
    if (phone.trim() && phone.trim().length !== 11) {
      setError('Telefon numarası 11 haneli olmalıdır (örn: 05551234567)');
      return false;
    }
    if (!ruleMinLen) {
      setError('Şifre en az 5 karakter olmalıdır');
      return false;
    }
    if (!ruleUpper) {
      setError('Şifre en az 1 büyük harf içermelidir');
      return false;
    }
    if (!rulePunct) {
      setError('Şifre en az 1 noktalama işareti içermelidir (!@#$%^&* vb.)');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await authAPI.register({
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        passwordConfirm: confirmPassword,
        phone: phone.trim(),
      });
      navigation.navigate('VerifyEmail', { email: email.trim() });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Kayıt başarısız. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AuthHeader
          icon={<UserPlus size={26} color="#2F5755" />}
          title="Kayıt Ol"
          subtitle="Yeni hesap oluşturun"
          hint="Hacettepe mail adresi zorunlu değildir. İstediğiniz mail adresi ile kayıt olabilirsiniz."
        />

        {!!error && (
          <View style={styles.alertError}>
            <AlertCircle size={17} color="#b91c1c" style={{ marginTop: 1 }} />
            <Text style={styles.alertErrorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.label}>İsim Soyisim *</Text>
        <View style={styles.inputRow}>
          <User size={18} color="#4f7d7a" />
          <TextInput style={styles.input} placeholder="İsim Soyisim" placeholderTextColor="#9ca3af" value={fullName} onChangeText={(t) => { setFullName(t.trimStart()); setError(null); }} />
        </View>

        <Text style={styles.label}>Kullanıcı Adı *</Text>
        <View style={styles.inputRow}>
          <UserPlus size={18} color="#4f7d7a" />
          <TextInput
            style={styles.input}
            placeholder="Kullanıcı Adınız"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(t) => { setUsername(t.trimStart()); setError(null); }}
          />
        </View>

        <Text style={styles.label}>E-posta *</Text>
        <View style={styles.inputRow}>
          <Mail size={18} color="#4f7d7a" />
          <TextInput
            style={styles.input}
            placeholder="ornek@gmail.com"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(t) => { setEmail(t.trimStart()); setError(null); }}
          />
        </View>

        <Text style={styles.label}>Şifre *</Text>
        <View style={styles.inputRow}>
          <Lock size={18} color="#4f7d7a" />
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={(t) => { setPassword(t); setError(null); }}
          />
          <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
            {showPassword ? <Eye size={18} color="#6b7280" /> : <EyeOff size={18} color="#6b7280" />}
          </Pressable>
        </View>
        <View style={styles.ruleBox}>
          <Text style={styles.ruleTitle}>Şifre gereksinimleri</Text>
          {[
            { ok: ruleMinLen, label: 'En az 5 karakter' },
            { ok: ruleUpper, label: 'En az 1 büyük harf (A–Z)' },
            { ok: rulePunct, label: 'En az 1 noktalama işareti (!@#$…)' },
          ].map(({ ok, label }) => (
            <View key={label} style={styles.ruleRow}>
              <View style={[styles.ruleCheck, ok && styles.ruleCheckOk]}>{ok && <Check size={10} color="#fff" strokeWidth={3} />}</View>
              <Text style={[styles.ruleLabel, ok && styles.ruleLabelOk]}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.label}>Şifre Tekrar *</Text>
        <View style={styles.inputRow}>
          <Lock size={18} color="#4f7d7a" />
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
          />
          <Pressable onPress={() => setShowConfirmPassword((v) => !v)} hitSlop={8}>
            {showConfirmPassword ? <Eye size={18} color="#6b7280" /> : <EyeOff size={18} color="#6b7280" />}
          </Pressable>
        </View>

        <Text style={styles.label}>Telefon</Text>
        <View style={styles.inputRow}>
          <Phone size={18} color="#4f7d7a" />
          <TextInput
            style={styles.input}
            placeholder="05551234567"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
            maxLength={11}
            value={phone}
            onChangeText={(t) => { setPhone(t.replace(/\D/g, '').slice(0, 11)); setError(null); }}
          />
        </View>
        <Text style={styles.hintText}>11 haneli (Örn: 05551234567)</Text>

        <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <UserPlus size={18} color="#fff" />
              <Text style={styles.buttonText}>Kayıt Ol</Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>
            Zaten hesabınız var mı? <Text style={styles.linkStrong}>Giriş Yap</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 },
  alertError: { flexDirection: 'row', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 12, marginBottom: 16 },
  alertErrorText: { color: '#b91c1c', fontSize: 13, flex: 1 },
  label: { fontSize: 13.5, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#111827' },
  ruleBox: { marginTop: 10, gap: 5 },
  ruleTitle: { fontSize: 11.5, fontWeight: '600', color: '#4b5563', marginBottom: 2 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleCheck: { width: 15, height: 15, borderRadius: 4, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  ruleCheckOk: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  ruleLabel: { fontSize: 11.5, color: '#9ca3af' },
  ruleLabelOk: { color: '#374151' },
  hintText: { fontSize: 11, color: '#9ca3af', marginTop: 5 },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2F5755',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 22,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  link: { textAlign: 'center', marginTop: 16, color: '#6b7280', fontSize: 13.5 },
  linkStrong: { color: '#2F5755', fontWeight: '700' },
});
