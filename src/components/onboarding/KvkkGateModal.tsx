import React, { useState } from 'react';
import { Alert, FlatList, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, GraduationCap, ShieldCheck, X } from 'lucide-react-native';
import { onboardingGateAPI, departmentFollowAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../lib/config';
import { departmentOptions, facultyOptions, type DepartmentOption } from '../../utils/departmentOptions';

interface Option {
  value: string;
  label: string;
}

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
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value) || null;
  const filtered = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options;

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        style={styles.selectBox}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
      >
        <Text style={selected ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
          {selected?.label || placeholder}
        </Text>
        <ChevronDown size={16} color="#6b7280" />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeaderRow}>
              <Text style={styles.pickerTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <X size={20} color="#6b7280" />
              </Pressable>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder={placeholder}
              placeholderTextColor="#9ca3af"
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            <FlatList
              data={filtered.slice(0, 200)}
              keyExtractor={(item) => item.value}
              style={{ maxHeight: 380 }}
              ListEmptyComponent={<Text style={styles.emptyText}>Sonuç bulunamadı</Text>}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerOption}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, item.value === value && styles.pickerOptionTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Site açılışında zorunlu, kapatılamaz KVKK + fakülte/bölüm kapısı — web'deki
// KvkkGateModal.jsx'in portu. RootNavigator, user.kvkkConsentAt/faculty/department
// tamamlanana kadar bunu her ekranın üstünde gösterir.
export default function KvkkGateModal() {
  const { user, updateUser } = useAuth();

  const hasValidPrefill = !!(user?.faculty && user?.department && user.department !== 'Fakülte Notu');
  const [selectedFaculty, setSelectedFaculty] = useState(hasValidPrefill ? user!.faculty! : '');
  const [selectedDepartment, setSelectedDepartment] = useState(hasValidPrefill ? user!.department! : '');
  const [departmentValue, setDepartmentValue] = useState(
    hasValidPrefill ? `${user!.faculty}::${user!.department}` : ''
  );
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
      departmentFollowAPI.follow(selectedFaculty, selectedDepartment).catch(() => {});
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Bir şeyler ters gitti, tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.iconCircle}>
            <GraduationCap size={22} color="#2F5755" />
          </View>
          <Text style={styles.title}>Hoş geldin! Devam etmeden önce</Text>
          <Text style={styles.subtitle}>
            Nottepe'yi kullanmaya başlamak için bölümünü seç ve KVKK Aydınlatma Metni'ni onayla. Bu adım yalnızca bir
            kez sorulur.
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

          <View style={styles.divider} />

          <Pressable style={styles.kvkkRow} onPress={() => setKvkkChecked((v) => !v)}>
            <View style={[styles.checkbox, kvkkChecked && styles.checkboxChecked]} />
            <Text style={styles.kvkkText}>
              <Text style={styles.kvkkLink} onPress={() => Linking.openURL(`${API_BASE}/kvkk`)}>
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
  sheet: { backgroundColor: '#fff', borderRadius: 18, padding: 22, maxHeight: '90%' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2F575519', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 12.5, color: '#6b7280', lineHeight: 18, marginBottom: 18 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: '#374151', marginBottom: 6 },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectText: { fontSize: 14, color: '#111827', flex: 1 },
  selectPlaceholder: { fontSize: 14, color: '#9ca3af', flex: 1 },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 8 },
  kvkkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: '#d1d5db', marginTop: 1 },
  checkboxChecked: { backgroundColor: '#2F5755', borderColor: '#2F5755' },
  kvkkText: { flex: 1, fontSize: 12.5, color: '#374151', lineHeight: 18 },
  kvkkLink: { color: '#2F5755', fontWeight: '700', textDecorationLine: 'underline' },
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
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '75%' },
  pickerHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: { textAlign: 'center', color: '#9ca3af', fontSize: 13, paddingVertical: 16 },
  pickerOption: { paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  pickerOptionText: { fontSize: 14, color: '#374151' },
  pickerOptionTextActive: { color: '#2F5755', fontWeight: '700' },
});
