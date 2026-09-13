import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, GraduationCap, ShieldCheck } from 'lucide-react-native';
import { onboardingGateAPI, departmentFollowAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { API_BASE } from '../../lib/config';
import { departmentOptions, facultyOptions, type DepartmentOption } from '../../utils/departmentOptions';
import OptionSheet from '../layout/OptionSheet';
import { FOLLOWED_DEPARTMENTS_KEY } from '../layout/MenuDrawerContent';

interface Option {
  value: string;
  label: string;
}

// Alan etiketi + seçim kutusu; seçim listesini uygulamanın ortak
// OptionSheet'i açıyor (bkz. components/layout/OptionSheet.tsx) — bu dosyada
// kendi arama kutulu sayfası vardı, artık her yerdekiyle aynı.
function SearchableSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  const selected = options.find((o) => o.value === value) || null;

  return (
    <View style={{ marginBottom: 14 }}>
      <Text className="text-ink2" style={styles.fieldLabel}>
        {label}
      </Text>
      <Pressable className="border-line" style={styles.selectBox} onPress={() => setOpen(true)}>
        <Text className={selected ? 'text-ink' : 'text-muted'} style={styles.selectText} numberOfLines={1}>
          {selected?.label || placeholder}
        </Text>
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>

      <OptionSheet
        visible={open}
        title={label}
        options={options}
        value={value}
        searchPlaceholder={placeholder}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

// Site açılışında zorunlu, kapatılamaz KVKK + fakülte/bölüm kapısı — web'deki
// KvkkGateModal.jsx'in portu. RootNavigator, user.kvkkConsentAt/faculty/department
// tamamlanana kadar bunu her ekranın üstünde gösterir.
export default function KvkkGateModal() {
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const brandIconColor = isDark ? '#5A9690' : '#2F5755';

  const hasValidPrefill = !!(user?.faculty && user?.department && user.department !== 'Fakülte Notu');
  const [selectedFaculty, setSelectedFaculty] = useState(hasValidPrefill ? user!.faculty! : '');
  const [selectedDepartment, setSelectedDepartment] = useState(hasValidPrefill ? user!.department! : '');
  const [departmentValue, setDepartmentValue] = useState(hasValidPrefill ? `${user!.faculty}::${user!.department}` : '');
  const [kvkkChecked, setKvkkChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleDepartmentChange = (value: string) => {
    const match = departmentOptions.find((o: DepartmentOption) => o.value === value);
    if (!match) return;
    setDepartmentValue(value);
    setSelectedFaculty(match.faculty);
    setSelectedDepartment(match.department);
  };

  const handleFacultyChange = (faculty: string) => {
    if (faculty === selectedFaculty) return;
    setSelectedFaculty(faculty);
    setSelectedDepartment('');
    setDepartmentValue('');
  };

  const canSubmit = !!selectedFaculty && !!selectedDepartment && kvkkChecked && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await onboardingGateAPI.complete({
        faculty: selectedFaculty,
        department: selectedDepartment,
        kvkkConsent: true,
      });
      updateUser(res.data.user);
      departmentFollowAPI
        .follow(selectedFaculty, selectedDepartment)
        // Menüdeki "Takip Ettiğim Bölümler" listesi 5 dk cache'li
        // (bkz. MenuDrawerContent) — onboarding'de eklenen ilk bölüm menüye
        // girerken görünsün diye anahtar geçersiz kılınıyor.
        .then(() => queryClient.invalidateQueries({ queryKey: FOLLOWED_DEPARTMENTS_KEY }))
        .catch(() => {});
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Bir şeyler ters gitti, tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View className="bg-surface" style={styles.sheet}>
          <View className="bg-accent-soft" style={styles.iconCircle}>
            <GraduationCap size={22} color={brandIconColor} />
          </View>
          <Text className="text-ink" style={styles.title}>
            Hoş geldin! Devam etmeden önce
          </Text>
          <Text className="text-muted" style={styles.subtitle}>
            Nottepe'yi kullanmaya başlamak için bölümünü seç ve KVKK Aydınlatma Metni'ni onayla. Bu adım yalnızca bir kez sorulur.
          </Text>

          <SearchableSelect
            label="Bölüm"
            placeholder="Bölüm ara..."
            options={departmentOptions}
            value={departmentValue}
            onChange={handleDepartmentChange}
          />
          <SearchableSelect
            label="Fakülte"
            placeholder="Fakülte ara..."
            options={facultyOptions}
            value={selectedFaculty}
            onChange={handleFacultyChange}
          />

          <View className="bg-inset" style={styles.divider} />

          <Pressable style={styles.kvkkRow} onPress={() => setKvkkChecked((v) => !v)}>
            <View className={kvkkChecked ? undefined : 'border-line'} style={[styles.checkbox, kvkkChecked && styles.checkboxChecked]} />
            <Text className="text-ink2" style={styles.kvkkText}>
              <Text className="text-accent" style={styles.kvkkLink} onPress={() => Linking.openURL(`${API_BASE}/kvkk`)}>
                KVKK Aydınlatma Metni
              </Text>
              'ni okudum, kişisel verilerimin belirtilen kapsamda işlenmesini kabul ediyorum.
            </Text>
          </Pressable>

          <Pressable style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
            <ShieldCheck size={16} color="#fff" />
            <Text style={styles.submitBtnText}>{submitting ? 'Kaydediliyor...' : 'Onayla ve Devam Et'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 18, padding: 22, maxHeight: '90%' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 12.5, lineHeight: 18, marginBottom: 18 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectText: { fontSize: 14, flex: 1 },
  selectPlaceholder: { fontSize: 14, flex: 1 },
  divider: { height: 1, marginVertical: 8 },
  kvkkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, marginTop: 1 },
  checkboxChecked: { backgroundColor: '#2F5755', borderColor: '#2F5755' },
  kvkkText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  kvkkLink: { fontWeight: '700', textDecorationLine: 'underline' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2F5755',
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 18,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
