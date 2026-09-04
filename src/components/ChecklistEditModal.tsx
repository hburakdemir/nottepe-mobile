import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Clock, Plus, Trash2, X } from 'lucide-react-native';
import { checklistAPI } from '../lib/api';
import type { Checklist } from '../types/checklist';
import { useTheme } from '../context/ThemeContext';
import KeyboardAvoider from './layout/KeyboardAvoider';

interface EditItem {
  id: number | null;
  content: string;
}

interface Props {
  checklist: Checklist;
  onClose: () => void;
  onSaved: () => void;
}

export default function ChecklistEditModal({ checklist, onClose, onSaved }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';
  const dangerColor = isDark ? '#f87171' : '#dc2626';
  const linkColor = isDark ? '#60a5fa' : '#1d4ed8';
  const [title, setTitle] = useState(checklist.title);
  const [description, setDescription] = useState(checklist.description || '');
  const [items, setItems] = useState<EditItem[]>(checklist.items.map((i) => ({ id: i.id, content: i.content })));
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const remainingMinutes = Math.max(0, Math.round((new Date(checklist.created_at).getTime() + 60 * 60 * 1000 - Date.now()) / 60000));

  const handleRemoveItem = (idx: number) => {
    const item = items[idx];
    if (item.id) setRemovedIds((prev) => [...prev, item.id!]);
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Hata', 'Başlık zorunludur.');
      return;
    }
    setSaving(true);
    try {
      await checklistAPI.update(checklist.id, { title: title.trim(), description: description.trim() });

      const originalById = new Map(checklist.items.map((i) => [i.id, i.content]));

      for (const id of removedIds) {
        await checklistAPI.deleteItem(id);
      }
      for (const item of items) {
        const content = item.content.trim();
        if (!content) continue;
        if (item.id == null) {
          await checklistAPI.addItem(checklist.id, { content });
        } else if (originalById.get(item.id) !== content) {
          await checklistAPI.updateItem(item.id, { content });
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoider>
        <View style={styles.overlay}>
          <View className="bg-surface" style={styles.sheet}>
            <View style={styles.headerRow}>
              <Text className="text-ink" style={styles.title}>
                Checklisti Düzenle
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={20} color={mutedColor} />
              </Pressable>
            </View>
            <View style={styles.remainingRow}>
              <Clock size={12} color={mutedColor} />
              <Text className="text-muted" style={styles.remainingText}>
                Düzenleme için kalan süre: ~{remainingMinutes} dk
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
              <Text className="text-muted" style={styles.label}>
                Başlık *
              </Text>
              <TextInput
                className="border-line bg-inset text-ink"
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                maxLength={200}
              />

              <Text className="text-muted" style={styles.label}>
                Açıklama
              </Text>
              <TextInput className="border-line bg-inset text-ink" style={styles.input} value={description} onChangeText={setDescription} />

              <Text className="text-muted" style={styles.label}>
                Maddeler
              </Text>
              <View style={{ gap: 8 }}>
                {items.map((item, idx) => (
                  <View key={item.id ?? `new-${idx}`} style={styles.itemRow}>
                    <TextInput
                      className="border-line bg-inset text-ink"
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      value={item.content}
                      onChangeText={(text) => setItems((prev) => prev.map((v, i) => (i === idx ? { ...v, content: text } : v)))}
                      maxLength={300}
                    />
                    <Pressable onPress={() => handleRemoveItem(idx)} hitSlop={8}>
                      <Trash2 size={17} color={dangerColor} />
                    </Pressable>
                  </View>
                ))}
              </View>
              {items.length < 30 && (
                <Pressable style={styles.addItemBtn} onPress={() => setItems((prev) => [...prev, { id: null, content: '' }])}>
                  <Plus size={13} color={linkColor} />
                  <Text style={[styles.addItemText, { color: linkColor }]}>Madde ekle</Text>
                </Pressable>
              )}
            </ScrollView>

            <View style={styles.actionsRow}>
              <Pressable className="border-line" style={styles.cancelBtn} onPress={onClose}>
                <Text className="text-muted" style={styles.cancelText}>
                  İptal
                </Text>
              </Pressable>
              <Pressable className="bg-accent" style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveText}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 16, padding: 20, maxHeight: '88%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '800' },
  remainingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  remainingText: { fontSize: 11 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  addItemText: { fontSize: 12.5, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelText: { fontSize: 13.5, fontWeight: '600' },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10 },
  saveText: { color: '#fff', fontSize: 13.5, fontWeight: '600' },
});
