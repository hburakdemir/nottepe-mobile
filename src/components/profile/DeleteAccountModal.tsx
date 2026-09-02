import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertCircle, X } from 'lucide-react-native';
import { profileupdateAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
        <View className="bg-primary dark:bg-darkbgbutton" style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text className="text-red-600 dark:text-red-400" style={styles.title}>Hesabını silmek üzeresin</Text>
            <Pressable onPress={onClose} hitSlop={8} disabled={loading}>
              <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            </Pressable>
          </View>
          <Text className="text-gray-500 dark:text-gray-400" style={styles.desc}>
            Bu işlem geri alınamaz. Bilgilerin (isim, kullanıcı adı, email, telefon, fotoğraf) anonimleştirilir;
            paylaştığın notlar, yorumlar ve listeler "Silinmiş Kullanıcı" adıyla yayında kalmaya devam eder.
          </Text>

          <Text className="text-gray-900 dark:text-darktext" style={styles.label}>Neden hesabını siliyorsun?</Text>
          <TextInput
            className="text-gray-900 dark:text-darktext border-gray-200 dark:border-gray-600"
            style={styles.textArea}
            value={reason}
            onChangeText={(t) => setReason(t.slice(0, 300))}
            placeholder="Kısaca sebep belirt..."
            placeholderTextColor="#9ca3af"
            multiline
          />

          {!!error && (
            <View className="bg-red-50 dark:bg-red-950/30" style={styles.alertError}>
              <AlertCircle size={14} color={isDark ? '#f87171' : '#b91c1c'} />
              <Text className="text-red-700 dark:text-red-400" style={styles.alertErrorText}>{error}</Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <Pressable className="border-gray-200 dark:border-gray-600" style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text className="text-gray-900 dark:text-darktext" style={styles.cancelText}>Vazgeç</Text>
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
  sheet: { borderRadius: 16, padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: '800' },
  desc: { fontSize: 12.5, marginTop: 8, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  alertError: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, marginTop: 10 },
  alertErrorText: { fontSize: 12, flex: 1 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  cancelText: { fontSize: 13.5, fontWeight: '600' },
  confirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#dc2626' },
  confirmText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
});
