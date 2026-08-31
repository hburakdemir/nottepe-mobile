import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertCircle, X } from 'lucide-react-native';
import { profileupdateAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export default function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!reason.trim()) {
      setError('Lütfen bir sebep belirt.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await profileupdateAPI.deleteAccount(reason.trim());
      await logout();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Hesap silinemedi.');
      setLoading(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Hesabını silmek üzeresin</Text>
            <Pressable onPress={onClose} hitSlop={8} disabled={loading}>
              <X size={20} color="#6b7280" />
            </Pressable>
          </View>
          <Text style={styles.desc}>
            Bu işlem geri alınamaz. Bilgilerin (isim, kullanıcı adı, email, telefon, fotoğraf) anonimleştirilir;
            paylaştığın notlar, yorumlar ve listeler "Silinmiş Kullanıcı" adıyla yayında kalmaya devam eder.
          </Text>

          <Text style={styles.label}>Neden hesabını siliyorsun?</Text>
          <TextInput
            style={styles.textArea}
            value={reason}
            onChangeText={(t) => setReason(t.slice(0, 300))}
            placeholder="Kısaca sebep belirt..."
            placeholderTextColor="#9ca3af"
            multiline
          />

          {!!error && (
            <View style={styles.alertError}>
              <AlertCircle size={14} color="#b91c1c" />
              <Text style={styles.alertErrorText}>{error}</Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelText}>Vazgeç</Text>
            </Pressable>
            <Pressable style={[styles.confirmBtn, loading && { opacity: 0.6 }]} onPress={handleDelete} disabled={loading}>
              <Text style={styles.confirmText}>{loading ? 'Siliniyor...' : 'Evet, Hesabımı Sil'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: '#dc2626' },
  desc: { fontSize: 12.5, color: '#6b7280', marginTop: 8, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 6 },
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#111827',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  alertError: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderRadius: 10, padding: 10, marginTop: 10 },
  alertErrorText: { color: '#b91c1c', fontSize: 12, flex: 1 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cancelText: { color: '#374151', fontSize: 13.5, fontWeight: '600' },
  confirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#dc2626' },
  confirmText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
});
