import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Flag, X } from 'lucide-react-native';
import { moderationAPI, type ReportTargetType } from '../../lib/api';
import { useThemeColors } from '../../context/ThemeContext';
import KeyboardAvoider from '../layout/KeyboardAvoider';

export const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam / reklam' },
  { value: 'harassment', label: 'Hakaret, taciz ya da zorbalık' },
  { value: 'inappropriate', label: 'Uygunsuz / müstehcen içerik' },
  { value: 'copyright', label: 'Telif hakkı ihlali / kopya içerik' },
  { value: 'misinformation', label: 'Yanlış ya da yanıltıcı bilgi' },
  { value: 'other', label: 'Diğer' },
];

interface Props {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string | number;
  onClose: () => void;
}

// İçerik şikâyeti: gerekçe + isteğe bağlı açıklama. Şikâyet web'deki admin
// panelinin "Şikâyetler" sekmesine düşer, yetkililere push gider.
// Görünüm DeleteAccountModal ile aynı kalıpta (ortada kart, KeyboardAvoider).
export default function ReportSheet({ visible, targetType, targetId, onClose }: Props) {
  const colors = useThemeColors();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const close = () => {
    if (sending) return;
    setReason('');
    setDetails('');
    onClose();
  };

  const submit = async () => {
    if (!reason || sending) return;
    setSending(true);
    try {
      const res = await moderationAPI.report({ targetType, targetId, reason, details: details.trim() });
      setReason('');
      setDetails('');
      onClose();
      Alert.alert('Teşekkürler', res.data?.message || 'Bildirimin alındı. En geç 24 saat içinde incelenecek.');
    } catch (err: any) {
      Alert.alert('Gönderilemedi', err.response?.data?.message || 'Bildirim gönderilemedi, tekrar dene.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoider>
        <Pressable style={styles.overlay} onPress={close}>
          {/* İçteki Pressable dokunmayı yutuyor: kartın içine dokunmak kapatmasın. */}
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={styles.headerRow}>
              <Flag size={18} color={colors.danger} />
              <Text style={[styles.title, { color: colors.ink }]}>Bildir</Text>
              <Pressable onPress={close} hitSlop={10} accessibilityLabel="Kapat">
                <X size={20} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={[styles.desc, { color: colors.muted }]}>Neden bildiriyorsun? Bildirimler en geç 24 saat içinde incelenir.</Text>

            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {REPORT_REASONS.map((r) => {
                const selected = reason === r.value;
                return (
                  <Pressable
                    key={r.value}
                    onPress={() => setReason(r.value)}
                    style={[
                      styles.reasonRow,
                      { borderColor: selected ? colors.accent : colors.line },
                      selected && { backgroundColor: `${colors.accent}14` },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.muted2 }]}>
                      {selected && <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />}
                    </View>
                    <Text style={[styles.reasonText, { color: colors.ink }]}>{r.label}</Text>
                  </Pressable>
                );
              })}

              <TextInput
                style={[styles.textArea, { color: colors.ink, borderColor: colors.line }]}
                value={details}
                onChangeText={(t) => setDetails(t.slice(0, 1000))}
                placeholder="Açıklama (isteğe bağlı)"
                placeholderTextColor={colors.muted2}
                multiline
              />
            </ScrollView>

            <View style={styles.actionsRow}>
              <Pressable style={[styles.cancelBtn, { borderColor: colors.line }]} onPress={close}>
                <Text style={[styles.cancelText, { color: colors.ink }]}>Vazgeç</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, (!reason || sending) && { opacity: 0.5 }]}
                onPress={submit}
                disabled={!reason || sending}
              >
                {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Bildir</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 16, padding: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '800' },
  desc: { fontSize: 12.5, marginTop: 6, marginBottom: 12, lineHeight: 18 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 4.5 },
  reasonText: { fontSize: 13.5, flex: 1 },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  cancelText: { fontSize: 13.5, fontWeight: '600' },
  confirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#dc2626' },
  confirmText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
});
