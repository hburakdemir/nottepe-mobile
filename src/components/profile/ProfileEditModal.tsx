import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AlertCircle, CheckCircle, Eye, EyeOff, Trash2, X } from 'lucide-react-native';
import { profileupdateAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { faculties, departments } from '../../data/departments';
import BadgeChip, { type Badge } from '../BadgeChip';

const SECTION_VISIBILITY_FIELDS: { key: string; label: string }[] = [
  { key: 'saved_posts', label: 'Kaydedilenler' },
  { key: 'my_lists', label: 'Oluşturduğum Checklistler' },
  { key: 'akts', label: 'AKTS Hesaplarım' },
  { key: 'schedule', label: 'Ders Programım' },
  { key: 'follows', label: 'Takip Ettiklerim' },
  { key: 'forums', label: 'Forumlar' },
  { key: 'badges', label: 'Rozetler' },
];

const DEFAULT_SECTION_VISIBILITY: Record<string, boolean> = {
  saved_posts: true,
  my_lists: true,
  akts: true,
  schedule: true,
  follows: true,
  forums: true,
  badges: true,
};

interface Props {
  badges: Badge[];
  onToggleBadgeVisibility: (badge: Badge) => void;
  onClose: () => void;
  onDeleteAccountRequest: () => void;
}

export default function ProfileEditModal({ badges, onToggleBadgeVisibility, onClose, onDeleteAccountRequest }: Props) {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState<'info' | 'visibility'>('info');

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [faculty, setFaculty] = useState(user?.faculty || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isPublic, setIsPublic] = useState(user?.is_public !== false);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({
    ...DEFAULT_SECTION_VISIBILITY,
    ...((user?.profile_section_visibility as Record<string, boolean>) || {}),
  });

  const [showFacultyPicker, setShowFacultyPicker] = useState(false);
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    const updates: Record<string, unknown> = {};
    if (fullName.trim() !== user?.full_name) updates.full_name = fullName.trim();
    if (username.trim() !== user?.username) updates.username = username.trim();
    if (phone.trim() !== (user?.phone || '')) updates.phone = phone.trim();
    if (isPublic !== (user?.is_public !== false)) updates.is_public = isPublic;
    if (faculty && faculty !== (user?.faculty || '')) updates.faculty = faculty;
    if (department && department !== (user?.department || '')) updates.department = department;
    if (bio.trim() !== (user?.bio || '')) updates.bio = bio.trim();

    const currentVisibility = { ...DEFAULT_SECTION_VISIBILITY, ...((user?.profile_section_visibility as Record<string, boolean>) || {}) };
    const visibilityPatch: Record<string, boolean> = {};
    Object.keys(DEFAULT_SECTION_VISIBILITY).forEach((key) => {
      if (visibility[key] !== currentVisibility[key]) visibilityPatch[key] = visibility[key];
    });
    if (Object.keys(visibilityPatch).length > 0) updates.profile_section_visibility = visibilityPatch;

    if (Object.keys(updates).length === 0) {
      setError('Hiçbir değişiklik yapmadınız.');
      setLoading(false);
      return;
    }

    try {
      const res = await profileupdateAPI.updateProfile(updates);
      updateUser(res.data.user);
      setSuccess('Profil başarıyla güncellendi!');
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Güncelleme başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Profili Düzenle</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color="#6b7280" />
            </Pressable>
          </View>

          <View style={styles.tabRow}>
            <Pressable style={[styles.tabBtn, tab === 'info' && styles.tabBtnActive]} onPress={() => setTab('info')}>
              <Text style={[styles.tabBtnText, tab === 'info' && styles.tabBtnTextActive]}>Kişisel Bilgiler</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, tab === 'visibility' && styles.tabBtnActive]} onPress={() => setTab('visibility')}>
              <Text style={[styles.tabBtnText, tab === 'visibility' && styles.tabBtnTextActive]}>Görünürlük</Text>
            </Pressable>
          </View>

          {!!error && (
            <View style={styles.alertError}>
              <AlertCircle size={15} color="#b91c1c" />
              <Text style={styles.alertErrorText}>{error}</Text>
            </View>
          )}
          {!!success && (
            <View style={styles.alertSuccess}>
              <CheckCircle size={15} color="#15803d" />
              <Text style={styles.alertSuccessText}>{success}</Text>
            </View>
          )}

          <ScrollView style={{ marginTop: 8 }}>
            {tab === 'info' ? (
              <>
                <Text style={styles.label}>İsim Soyisim</Text>
                <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="İsim Soyisim" placeholderTextColor="#9ca3af" />

                <Text style={styles.label}>Kullanıcı Adı</Text>
                <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="Kullanıcı Adı" placeholderTextColor="#9ca3af" autoCapitalize="none" />

                <Text style={styles.label}>Telefon</Text>
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="05551234567" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />

                <Text style={styles.label}>Fakülte</Text>
                <Pressable style={styles.selectBox} onPress={() => setShowFacultyPicker(true)}>
                  <Text style={faculty ? styles.selectText : styles.selectPlaceholder}>{faculty || 'Fakülte seçin...'}</Text>
                </Pressable>

                <Text style={styles.label}>Bölüm</Text>
                <Pressable
                  style={[styles.selectBox, !faculty && { opacity: 0.5 }]}
                  onPress={() => faculty && setShowDeptPicker(true)}
                >
                  <Text style={department ? styles.selectText : styles.selectPlaceholder}>{department || 'Bölüm seçin...'}</Text>
                </Pressable>
                <Text style={styles.hint}>Fakülte/bölüm herkese açık profilinde görünür.</Text>

                <Text style={styles.label}>Açıklama</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bio}
                  onChangeText={(t) => setBio(t.slice(0, 300))}
                  placeholder="Kendinden kısaca bahset..."
                  placeholderTextColor="#9ca3af"
                  multiline
                />
                <Text style={styles.hintRight}>{bio.length}/300 — herkese açık profilinde görünür</Text>

                <Text style={styles.label}>Email (Değiştirilemez)</Text>
                <View style={[styles.input, styles.inputDisabled]}>
                  <Text style={{ color: '#9ca3af' }}>{user?.email}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>Profilimi herkese açık yap</Text>
                    <Text style={styles.hint}>Kapatırsan başkaları sadece adını, avatarını ve rozetlerini görür.</Text>
                  </View>
                  <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: '#2F5755' }} />
                </View>

                <Text style={styles.label}>Başkaları profilimde şunları görebilsin</Text>
                <Text style={styles.hint}>Postların her zaman görünür. Gizlediğin bir sekme başkasının profilinde hiç görünmez.</Text>
                <View style={styles.visibilityBox}>
                  {SECTION_VISIBILITY_FIELDS.map(({ key, label }) => (
                    <View key={key} style={styles.visibilityRow}>
                      <Text style={styles.visibilityLabel}>{label}</Text>
                      <Switch
                        value={!!visibility[key]}
                        onValueChange={(v) => setVisibility((prev) => ({ ...prev, [key]: v }))}
                        trackColor={{ true: '#2F5755' }}
                      />
                    </View>
                  ))}
                </View>

                <Text style={styles.label}>Rozetlerim</Text>
                <Text style={styles.hint}>Gizlediğin bir rozet profilinde görünmez. En az bir rozet görünür kalmalı.</Text>
                {badges.length === 0 ? (
                  <Text style={styles.hint}>Henüz rozet yok.</Text>
                ) : (
                  <View style={styles.visibilityBox}>
                    {badges.map((badge) => (
                      <View key={badge.id} style={styles.visibilityRow}>
                        <View style={{ flex: 1, opacity: badge.is_visible ? 1 : 0.4 }}>
                          <BadgeChip badge={badge} />
                        </View>
                        <Pressable onPress={() => onToggleBadgeVisibility(badge)} hitSlop={8}>
                          {badge.is_visible ? <Eye size={16} color="#6b7280" /> : <EyeOff size={16} color="#6b7280" />}
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.dangerZone}>
                  <Text style={styles.dangerLabel}>Tehlikeli Bölge</Text>
                  <Text style={styles.hint}>
                    Hesabını silersen tekrar giriş yapamazsın. Paylaştığın notlar, yorumlar ve listeler "Silinmiş
                    Kullanıcı" adıyla anonim olarak yayında kalmaya devam eder.
                  </Text>
                  <Pressable
                    style={styles.deleteAccountBtn}
                    onPress={() => {
                      onClose();
                      onDeleteAccountRequest();
                    }}
                  >
                    <Trash2 size={14} color="#dc2626" />
                    <Text style={styles.deleteAccountText}>Hesabımı Sil</Text>
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.actionsRow}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelText}>İptal</Text>
            </Pressable>
            <Pressable style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
              <Text style={styles.saveText}>{loading ? 'Güncelleniyor...' : 'Güncelle'}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Modal visible={showFacultyPicker} transparent animationType="slide" onRequestClose={() => setShowFacultyPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowFacultyPicker(false)}>
          <View style={styles.pickerSheet}>
            <ScrollView>
              {faculties.map((f) => (
                <Pressable
                  key={f}
                  style={styles.pickerOption}
                  onPress={() => {
                    setFaculty(f);
                    setDepartment('');
                    setShowFacultyPicker(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{f}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showDeptPicker} transparent animationType="slide" onRequestClose={() => setShowDeptPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowDeptPicker(false)}>
          <View style={styles.pickerSheet}>
            <ScrollView>
              {(departments[faculty] || []).map((d) => (
                <Pressable
                  key={d}
                  style={styles.pickerOption}
                  onPress={() => {
                    setDepartment(d);
                    setShowDeptPicker(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{d}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '90%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginTop: 12 },
  tabBtn: { flex: 1, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', alignItems: 'center' },
  tabBtnActive: { borderBottomColor: '#2F5755' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  tabBtnTextActive: { color: '#2F5755' },
  alertError: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderRadius: 10, padding: 10, marginTop: 12 },
  alertErrorText: { color: '#b91c1c', fontSize: 12.5, flex: 1 },
  alertSuccess: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0fdf4', borderRadius: 10, padding: 10, marginTop: 12 },
  alertSuccessText: { color: '#15803d', fontSize: 12.5, flex: 1 },
  label: { fontSize: 12.5, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827' },
  inputDisabled: { backgroundColor: '#f3f4f6' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontSize: 11, color: '#9ca3af', marginTop: 4, lineHeight: 15 },
  hintRight: { fontSize: 11, color: '#9ca3af', marginTop: 4, textAlign: 'right' },
  selectBox: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  selectText: { fontSize: 14, color: '#111827' },
  selectPlaceholder: { fontSize: 14, color: '#9ca3af' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  switchLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  visibilityBox: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, marginTop: 8, overflow: 'hidden' },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  visibilityLabel: { fontSize: 13, color: '#374151' },
  dangerZone: { marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#fecaca' },
  dangerLabel: { fontSize: 13, fontWeight: '700', color: '#dc2626', marginBottom: 4 },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  deleteAccountText: { fontSize: 12.5, color: '#dc2626', fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cancelText: { color: '#374151', fontSize: 13.5, fontWeight: '600' },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#2F5755' },
  saveText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingVertical: 8 },
  pickerOption: { paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  pickerOptionText: { fontSize: 14.5, color: '#374151' },
});
