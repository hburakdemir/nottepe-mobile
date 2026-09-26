import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertCircle, Check, Eye, EyeOff, Lock, Mail, Phone, User, UserPlus } from 'lucide-react-native';
import { authAPI } from '../../lib/api';
import { useThemeColors } from '../../context/ThemeContext';
import { KeyboardAwareScroll } from '../../components/layout/KeyboardAvoider';
import AuthHeader from '../../components/auth/AuthHeader';
import TermsModal from '../../components/auth/TermsModal';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const PUNCTUATION_RE = /[!@#$%^&*(),.?":{}|<>]/;
const TURKISH_NAME_RE = /^[ abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = 'fullName' | 'username' | 'email' | 'password' | 'confirm' | 'phone' | 'terms';

// Sunucu hata mesajını ilgili alana eşler — kırmızı çerçeve doğru kutuda çıksın.
function fieldFromServerMessage(message: string): Field | null {
  const m = message.toLocaleLowerCase('tr');
  if (m.includes('koşul')) return 'terms';
  if (m.includes('kullanıcı adı')) return 'username';
  if (m.includes('email') || m.includes('e-posta')) return 'email';
  if (m.includes('eşleşmiyor')) return 'confirm';
  if (m.includes('şifre') || m.includes('karakter')) return 'password';
  if (m.includes('telefon')) return 'phone';
  if (m.includes('isim')) return 'fullName';
  return null;
}

export default function RegisterScreen({ navigation }: Props) {
  // Renkler StyleSheet'ten çıkarıldı; aşağıdaki stiller sadece ölçü/tipografi.
  const colors = useThemeColors();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<Field | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Kullanım Koşulları onayı — backend kayıtta zorunlu tutuyor (acceptTerms).
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const scrollRef = useRef<React.ElementRef<typeof KeyboardAwareScroll>>(null);

  // Hata kutusu formun EN ÜSTÜNDE. Kullanıcı en alttaki "Kayıt Ol"a basınca
  // hata ekranın dışında kalıyor ve "hiçbir şey olmadı" sanılıyordu — hata
  // her çıktığında sayfa başa kayıyor, hatalı alanın çerçevesi kırmızı oluyor.
  const showError = (message: string, field: Field | null) => {
    setError(message);
    setErrorField(field);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const clearError = () => {
    setError(null);
    setErrorField(null);
  };

  const borderFor = (field: Field) => (errorField === field ? colors.danger : colors.line);

  const ruleMinLen = password.length >= 5;
  const ruleUpper = /[A-Z]/.test(password);
  const rulePunct = PUNCTUATION_RE.test(password);

  const validate = (): boolean => {
    const trimmedFullName = fullName.trim();
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFullName || !trimmedUsername || !trimmedEmail || !password || !confirmPassword) {
      showError('Lütfen zorunlu alanları doldurun', !trimmedFullName ? 'fullName' : !trimmedUsername ? 'username' : !trimmedEmail ? 'email' : !password ? 'password' : 'confirm');
      return false;
    }
    if (!TURKISH_NAME_RE.test(trimmedFullName)) {
      showError('İsim sadece Türkçe harf ve boşluk içerebilir', 'fullName');
      return false;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      showError('Geçerli bir email adresi girin', 'email');
      return false;
    }
    if (phone.trim() && phone.trim().length !== 11) {
      showError('Telefon numarası 11 haneli olmalıdır (örn: 05551234567)', 'phone');
      return false;
    }
    if (!ruleMinLen) {
      showError('Şifre en az 5 karakter olmalıdır', 'password');
      return false;
    }
    if (!ruleUpper) {
      showError('Şifre en az 1 büyük harf içermelidir', 'password');
      return false;
    }
    if (!rulePunct) {
      showError('Şifre en az 1 noktalama işareti içermelidir (!@#$%^&* vb.)', 'password');
      return false;
    }
    if (password !== confirmPassword) {
      showError('Şifreler eşleşmiyor', 'confirm');
      return false;
    }
    if (!acceptTerms) {
      showError("Kayıt olmak için Kullanım Koşulları'nı kabul etmelisin", 'terms');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    clearError();
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
        acceptTerms,
      });
      navigation.navigate('VerifyEmail', { email: email.trim() });
    } catch (err: any) {
      const message: string = err.response?.data?.message || 'Kayıt başarısız. Lütfen tekrar deneyin.';
      showError(message, fieldFromServerMessage(message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // İKİ BİLEŞEN TEKE İNDİ. Eskiden dıştaki KeyboardAvoidingView konteynere
    // dolgu ekliyor, içteki ScrollView ise odaklanan input'u görünür alana HİÇ
    // kaydırmıyordu — uzun kayıt formunun alt alanlarında (telefon, şifre
    // tekrar) kutu klavyenin altında kalıyordu. KeyboardAwareScroll ikisini
    // birden yapıyor (bkz. components/layout/KeyboardAvoider.tsx).
    <KeyboardAwareScroll
      ref={scrollRef}
      style={[styles.container, { backgroundColor: colors.ground }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
        <AuthHeader
          title="Kayıt Ol"
          subtitle="Yeni hesap oluşturun"
          hint="Hacettepe mail adresi zorunlu değildir. İstediğiniz mail adresi ile kayıt olabilirsiniz."
        />

        {!!error && (
          <View style={[styles.alertError, { backgroundColor: colors.dangerSoft, borderColor: colors.dangerLine }]}>
            <AlertCircle size={17} color={colors.danger} style={{ marginTop: 1 }} />
            <Text style={[styles.alertErrorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        <Text style={[styles.label, { color: colors.ink2 }]}>İsim Soyisim *</Text>
        <View style={[styles.inputRow, { borderColor: borderFor('fullName') }]}>
          <User size={18} color={colors.accent} />
          <TextInput
            style={[styles.input, { color: colors.ink }]}
            placeholder="İsim Soyisim"
            placeholderTextColor={colors.muted2}
            value={fullName}
            onChangeText={(t) => {
              setFullName(t.trimStart());
              clearError();
            }}
          />
        </View>

        <Text style={[styles.label, { color: colors.ink2 }]}>Kullanıcı Adı *</Text>
        <View style={[styles.inputRow, { borderColor: borderFor('username') }]}>
          <UserPlus size={18} color={colors.accent} />
          <TextInput
            style={[styles.input, { color: colors.ink }]}
            placeholder="Kullanıcı Adınız"
            placeholderTextColor={colors.muted2}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(t) => {
              setUsername(t.trimStart());
              clearError();
            }}
          />
        </View>

        <Text style={[styles.label, { color: colors.ink2 }]}>E-posta *</Text>
        <View style={[styles.inputRow, { borderColor: borderFor('email') }]}>
          <Mail size={18} color={colors.accent} />
          <TextInput
            style={[styles.input, { color: colors.ink }]}
            placeholder="ornek@gmail.com"
            placeholderTextColor={colors.muted2}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(t) => {
              setEmail(t.trimStart());
              clearError();
            }}
          />
        </View>

        <Text style={[styles.label, { color: colors.ink2 }]}>Şifre *</Text>
        <View style={[styles.inputRow, { borderColor: borderFor('password') }]}>
          <Lock size={18} color={colors.accent} />
          <TextInput
            style={[styles.input, { color: colors.ink }]}
            placeholder="••••••••"
            placeholderTextColor={colors.muted2}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              clearError();
            }}
          />
          <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
            {showPassword ? <Eye size={18} color={colors.muted} /> : <EyeOff size={18} color={colors.muted} />}
          </Pressable>
        </View>
        <View style={styles.ruleBox}>
          <Text style={[styles.ruleTitle, { color: colors.muted }]}>Şifre gereksinimleri</Text>
          {[
            { ok: ruleMinLen, label: 'En az 5 karakter' },
            { ok: ruleUpper, label: 'En az 1 büyük harf (A–Z)' },
            { ok: rulePunct, label: 'En az 1 noktalama işareti (!@#$…)' },
          ].map(({ ok, label }) => (
            <View key={label} style={styles.ruleRow}>
              {/* Sağlanan kural yeşil dolu kutu; sağlanmayan boş + soluk etiket. */}
              <View style={[styles.ruleCheck, { borderColor: ok ? colors.success : colors.line }, ok && { backgroundColor: colors.success }]}>
                {ok && <Check size={10} color="#fff" strokeWidth={3} />}
              </View>
              <Text style={[styles.ruleLabel, { color: ok ? colors.ink2 : colors.muted2 }]}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.ink2 }]}>Şifre Tekrar *</Text>
        <View style={[styles.inputRow, { borderColor: borderFor('confirm') }]}>
          <Lock size={18} color={colors.accent} />
          <TextInput
            style={[styles.input, { color: colors.ink }]}
            placeholder="••••••••"
            placeholderTextColor={colors.muted2}
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={(t) => {
              setConfirmPassword(t);
              clearError();
            }}
          />
          <Pressable onPress={() => setShowConfirmPassword((v) => !v)} hitSlop={8}>
            {showConfirmPassword ? <Eye size={18} color={colors.muted} /> : <EyeOff size={18} color={colors.muted} />}
          </Pressable>
        </View>

        <Text style={[styles.label, { color: colors.ink2 }]}>Telefon</Text>
        <View style={[styles.inputRow, { borderColor: borderFor('phone') }]}>
          <Phone size={18} color={colors.accent} />
          <TextInput
            style={[styles.input, { color: colors.ink }]}
            placeholder="05551234567"
            placeholderTextColor={colors.muted2}
            keyboardType="number-pad"
            maxLength={11}
            value={phone}
            onChangeText={(t) => {
              setPhone(t.replace(/\D/g, '').slice(0, 11));
              clearError();
            }}
          />
        </View>
        <Text style={[styles.hintText, { color: colors.muted2 }]}>11 haneli (Örn: 05551234567)</Text>

        <View style={styles.termsRow}>
          <Pressable
            onPress={() => {
              setAcceptTerms((v) => !v);
              clearError();
            }}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptTerms }}
            accessibilityLabel="Kullanım Koşulları'nı kabul ediyorum"
            style={[
              styles.termsBox,
              { borderColor: errorField === 'terms' ? colors.danger : acceptTerms ? colors.success : colors.line },
              acceptTerms && { backgroundColor: colors.success },
            ]}
          >
            {acceptTerms && <Check size={13} color="#fff" strokeWidth={3} />}
          </Pressable>
          <Text style={[styles.termsText, { color: colors.ink2 }]}>
            <Text style={[styles.linkStrong, { color: colors.accent }]} onPress={() => setTermsOpen(true)}>
              Kullanım Koşulları
            </Text>
            'nı okudum ve kabul ediyorum. Uygunsuz içeriğe ve kullanıcılara tolerans gösterilmediğini biliyorum.
          </Text>
        </View>

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
          <Text style={[styles.link, { color: colors.muted }]}>
            Zaten hesabınız var mı? <Text style={[styles.linkStrong, { color: colors.accent }]}>Giriş Yap</Text>
          </Text>
        </Pressable>
        <TermsModal visible={termsOpen} onClose={() => setTermsOpen(false)} />
    </KeyboardAwareScroll>
  );
}

// Renk taşıyan değerler kullanım yerinde (useThemeColors) — burada sadece
// ölçü/tipografi. Tek istisna marka butonu ve üstündeki beyaz yazı.
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 },
  alertError: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  alertErrorText: { fontSize: 13, flex: 1 },
  label: { fontSize: 13.5, fontWeight: '600', marginBottom: 8, marginTop: 14 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 13, fontSize: 15 },
  ruleBox: { marginTop: 10, gap: 5 },
  ruleTitle: { fontSize: 11.5, fontWeight: '600', marginBottom: 2 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleCheck: {
    width: 15,
    height: 15,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleLabel: { fontSize: 11.5 },
  hintText: { fontSize: 11, marginTop: 5 },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 20 },
  termsBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  termsText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
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
  link: { textAlign: 'center', marginTop: 16, fontSize: 13.5 },
  linkStrong: { fontWeight: '700' },
});
