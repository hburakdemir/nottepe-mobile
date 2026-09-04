import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AlertCircle, CheckCircle, Eye, EyeOff, Trash2, X } from 'lucide-react-native';
import { profileupdateAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { faculties, departments } from '../../data/departments';
import BadgeChip, { type Badge } from '../BadgeChip';
import KeyboardAvoider from '../layout/KeyboardAvoider';
import OptionSheet from '../layout/OptionSheet';

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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const mutedIconColor = isDark ? '#DFD0B8' : '#6b7280';
  const dangerIconColor = isDark ? '#f87171' : '#dc2626';
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
      <KeyboardAvoider>
        <View style={styles.overlay}>
          <View className="bg-surface" style={styles.sheet}>
            <View style={styles.headerRow}>
              <Text className="text-ink" style={styles.title}>
                Profili Düzenle
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={20} color={mutedIconColor} />
              </Pressable>
            </View>

            <View className="border-line-soft" style={styles.tabRow}>
              <Pressable
                className={tab === 'info' ? 'border-accent' : 'border-transparent'}
                style={styles.tabBtn}
                onPress={() => setTab('info')}
              >
                <Text className={tab === 'info' ? 'text-accent' : 'text-muted'} style={styles.tabBtnText}>
                  Kişisel Bilgiler
                </Text>
              </Pressable>
              <Pressable
                className={tab === 'visibility' ? 'border-accent' : 'border-transparent'}
                style={styles.tabBtn}
                onPress={() => setTab('visibility')}
              >
                <Text className={tab === 'visibility' ? 'text-accent' : 'text-muted'} style={styles.tabBtnText}>
                  Görünürlük
                </Text>
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

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {tab === 'info' ? (
                <>
                  <Text className="text-ink2" style={styles.label}>
                    İsim Soyisim
                  </Text>
                  <TextInput
                    className="border-line text-ink"
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="İsim Soyisim"
                    placeholderTextColor="#9ca3af"
                  />

                  <Text className="text-ink2" style={styles.label}>
                    Kullanıcı Adı
                  </Text>
                  <TextInput
                    className="border-line text-ink"
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Kullanıcı Adı"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                  />

                  <Text className="text-ink2" style={styles.label}>
                    Telefon
                  </Text>
                  <TextInput
                    className="border-line text-ink"
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="05551234567"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                  />

                  <Text className="text-ink2" style={styles.label}>
                    Fakülte
                  </Text>
                  <Pressable className="border-line" style={styles.selectBox} onPress={() => setShowFacultyPicker(true)}>
                    <Text className={faculty ? 'text-ink' : 'text-muted'} style={styles.selectText}>
                      {faculty || 'Fakülte seçin...'}
                    </Text>
                  </Pressable>

                  <Text className="text-ink2" style={styles.label}>
                    Bölüm
                  </Text>
                  <Pressable
                    className="border-line"
                    style={[styles.selectBox, !faculty && { opacity: 0.5 }]}
                    onPress={() => faculty && setShowDeptPicker(true)}
                  >
                    <Text className={department ? 'text-ink' : 'text-muted'} style={styles.selectText}>
                      {department || 'Bölüm seçin...'}
                    </Text>
                  </Pressable>
                  <Text className="text-muted" style={styles.hint}>
                    Fakülte/bölüm herkese açık profilinde görünür.
                  </Text>

                  <Text className="text-ink2" style={styles.label}>
                    Açıklama
                  </Text>
                  <TextInput
                    className="border-line text-ink"
                    style={[styles.input, styles.textArea]}
                    value={bio}
                    onChangeText={(t) => setBio(t.slice(0, 300))}
                    placeholder="Kendinden kısaca bahset..."
                    placeholderTextColor="#9ca3af"
                    multiline
                  />
                  <Text className="text-muted" style={styles.hintRight}>
                    {bio.length}/300 — herkese açık profilinde görünür
                  </Text>

                  <Text className="text-ink2" style={styles.label}>
                    Email (Değiştirilemez)
                  </Text>
                  <View className="border-line bg-inset" style={styles.input}>
                    <Text className="text-muted">{user?.email}</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text className="text-ink2" style={styles.switchLabel}>
                        Profilimi herkese açık yap
                      </Text>
                      <Text className="text-muted" style={styles.hint}>
                        Kapatırsan başkaları sadece adını, avatarını ve rozetlerini görür.
                      </Text>
                    </View>
                    <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: '#2F5755' }} />
                  </View>

                  <Text className="text-ink2" style={styles.label}>
                    Başkaları profilimde şunları görebilsin
                  </Text>
                  <Text className="text-muted" style={styles.hint}>
                    Postların her zaman görünür. Gizlediğin bir sekme başkasının profilinde hiç görünmez.
                  </Text>
                  <View className="border-line-soft" style={styles.visibilityBox}>
                    {SECTION_VISIBILITY_FIELDS.map(({ key, label }) => (
                      <View key={key} className="border-line-soft" style={styles.visibilityRow}>
                        <Text className="text-ink2" style={styles.visibilityLabel}>
                          {label}
                        </Text>
                        <Switch
                          value={!!visibility[key]}
                          onValueChange={(v) => setVisibility((prev) => ({ ...prev, [key]: v }))}
                          trackColor={{ true: '#2F5755' }}
                        />
                      </View>
                    ))}
                  </View>

                  <Text className="text-ink2" style={styles.label}>
                    Rozetlerim
                  </Text>
                  <Text className="text-muted" style={styles.hint}>
                    Gizlediğin bir rozet profilinde görünmez. En az bir rozet görünür kalmalı.
                  </Text>
                  {badges.length === 0 ? (
                    <Text className="text-muted" style={styles.hint}>
                      Henüz rozet yok.
                    </Text>
                  ) : (
                    <View className="border-line-soft" style={styles.visibilityBox}>
                      {badges.map((badge) => (
                        <View key={badge.id} className="border-line-soft" style={styles.visibilityRow}>
                          <View style={{ flex: 1, opacity: badge.is_visible ? 1 : 0.4 }}>
                            <BadgeChip badge={badge} />
                          </View>
                          <Pressable onPress={() => onToggleBadgeVisibility(badge)} hitSlop={8}>
                            {badge.is_visible ? <Eye size={16} color={mutedIconColor} /> : <EyeOff size={16} color={mutedIconColor} />}
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.dangerZone}>
                    <Text className="text-danger" style={styles.dangerLabel}>
                      Tehlikeli Bölge
                    </Text>
                    <Text className="text-muted" style={styles.hint}>
                      Hesabını silersen tekrar giriş yapamazsın. Paylaştığın notlar, yorumlar ve listeler "Silinmiş Kullanıcı" adıyla anonim
                      olarak yayında kalmaya devam eder.
                    </Text>
                    <Pressable
                      style={styles.deleteAccountBtn}
                      onPress={() => {
                        onClose();
                        onDeleteAccountRequest();
                      }}
                    >
                      <Trash2 size={14} color={dangerIconColor} />
                      <Text className="text-danger" style={styles.deleteAccountText}>
                        Hesabımı Sil
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.actionsRow}>
              <Pressable className="border-line" style={styles.cancelBtn} onPress={onClose} disabled={loading}>
                <Text className="text-ink2" style={styles.cancelText}>
                  İptal
                </Text>
              </Pressable>
              <Pressable style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
                <Text style={styles.saveText}>{loading ? 'Güncelleniyor...' : 'Güncelle'}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <OptionSheet
          visible={showFacultyPicker}
          title="Fakülte seç"
          options={faculties}
          value={faculty}
          onSelect={(f) => {
            setFaculty(f);
            setDepartment('');
          }}
          onClose={() => setShowFacultyPicker(false)}
        />

        <OptionSheet
          visible={showDeptPicker}
          title="Bölüm seç"
          options={departments[faculty] || []}
          value={department}
          onSelect={setDepartment}
          onClose={() => setShowDeptPicker(false)}
        />
      </KeyboardAvoider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 16, padding: 20, maxHeight: '90%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '800' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, marginTop: 12 },
  tabBtn: { flex: 1, paddingBottom: 10, borderBottomWidth: 2, alignItems: 'center' },
  tabBtnText: { fontSize: 13, fontWeight: '600' },
  alertError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  alertErrorText: { color: '#b91c1c', fontSize: 12.5, flex: 1 },
  alertSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  alertSuccessText: { color: '#15803d', fontSize: 12.5, flex: 1 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontSize: 11, marginTop: 4, lineHeight: 15 },
  hintRight: { fontSize: 11, marginTop: 4, textAlign: 'right' },
  selectBox: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  selectText: { fontSize: 14 },
  selectPlaceholder: { fontSize: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  switchLabel: { fontSize: 13, fontWeight: '600' },
  visibilityBox: { borderWidth: 1, borderRadius: 10, marginTop: 8, overflow: 'hidden' },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  visibilityLabel: { fontSize: 13 },
  dangerZone: { marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#fecaca' },
  dangerLabel: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
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
  deleteAccountText: { fontSize: 12.5, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  cancelText: { fontSize: 13.5, fontWeight: '600' },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#2F5755' },
  saveText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
});
