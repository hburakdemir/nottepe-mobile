import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { ListChecks, Plus, Trash2, X } from 'lucide-react-native';
import { checklistAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import ChecklistCard from '../../components/ChecklistCard';
import ChecklistStatsModal from '../../components/ChecklistStatsModal';
import ChecklistEditModal from '../../components/ChecklistEditModal';
import { isWithinEditWindow, type Checklist, type ChecklistItem } from '../../types/checklist';
import type { RootStackParamList } from '../../navigation/types';

export default function ChecklistsScreen() {
  const route = useRoute<any>();
  const params = route.params as RootStackParamList['Checklists'];
  const { user } = useAuth();

  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statsChecklist, setStatsChecklist] = useState<Checklist | null>(null);
  const [editChecklist, setEditChecklist] = useState<Checklist | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createItems, setCreateItems] = useState(['']);
  const [creating, setCreating] = useState(false);

  const fetchChecklists = useCallback(async () => {
    try {
      const res = await checklistAPI.getAll();
      const lists: Checklist[] = res.data.checklists || [];
      setChecklists(lists);
      if (params?.slug) {
        const match = lists.find((c) => c.slug === params.slug);
        if (match) setExpandedId(match.id);
      }
    } catch {
      Alert.alert('Hata', 'Checklistler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [params?.slug]);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  const toggleExpand = (checklist: Checklist) => {
    setExpandedId((prev) => (prev === checklist.id ? null : checklist.id));
  };

  const handleToggleItem = async (checklistId: number, item: ChecklistItem) => {
    const newChecked = !item.checked;
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? { ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, checked: newChecked } : i)) }
          : c
      )
    );
    try {
      await checklistAPI.setItemState(item.id, newChecked);
    } catch {
      setChecklists((prev) =>
        prev.map((c) =>
          c.id === checklistId
            ? { ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, checked: !newChecked } : i)) }
            : c
        )
      );
      Alert.alert('Hata', 'Kaydedilemedi, tekrar deneyin.');
    }
  };

  const openCreateModal = () => {
    setCreateTitle('');
    setCreateDesc('');
    setCreateItems(['']);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!createTitle.trim()) {
      Alert.alert('Hata', 'Başlık zorunludur.');
      return;
    }
    const items = createItems.map((i) => i.trim()).filter(Boolean);
    setCreating(true);
    try {
      const res = await checklistAPI.create({
        title: createTitle.trim(),
        description: createDesc.trim() || undefined,
        items,
      });
      Alert.alert('Başarılı', res.data.message || 'Checklist oluşturuldu!');
      setShowCreate(false);
      fetchChecklists();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={checklists}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ChecklistCard
            checklist={item}
            isOpen={expandedId === item.id}
            onToggleOpen={toggleExpand}
            onToggleItem={handleToggleItem}
            onStatsClick={setStatsChecklist}
            onEditClick={setEditChecklist}
            canEdit={item.list_type === 'user' && item.created_by === user?.id && isWithinEditWindow(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <ListChecks size={40} color="#d1d5db" />
            <Text style={styles.emptyText}>Henüz yayınlanmış bir checklist yok.</Text>
          </View>
        }
      />

      <Pressable style={styles.fab} onPress={openCreateModal}>
        <Plus size={20} color="#fff" />
        <Text style={styles.fabText}>Checklist Oluştur</Text>
      </Pressable>

      {statsChecklist && <ChecklistStatsModal checklist={statsChecklist} onClose={() => setStatsChecklist(null)} />}
      {editChecklist && (
        <ChecklistEditModal
          checklist={editChecklist}
          onClose={() => setEditChecklist(null)}
          onSaved={fetchChecklists}
        />
      )}

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.headerRow}>
              <Text style={styles.sheetTitle}>Yeni Checklist Oluştur</Text>
              <Pressable onPress={() => setShowCreate(false)} hitSlop={8}>
                <X size={20} color="#6b7280" />
              </Pressable>
            </View>
            <Text style={styles.sheetHint}>
              Checklistin admin onayına gönderilir; onaylanana kadar yalnızca sana görünür. Oluşturduktan sonra
              1 saat içinde düzenleyebilirsin.
            </Text>

            <Text style={styles.label}>Başlık *</Text>
            <TextInput
              style={styles.input}
              value={createTitle}
              onChangeText={setCreateTitle}
              maxLength={200}
              placeholder='Örn: "Erasmus Başvuru Süreci"'
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Açıklama</Text>
            <TextInput
              style={styles.input}
              value={createDesc}
              onChangeText={setCreateDesc}
              placeholder="Kısa açıklama (opsiyonel)"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Maddeler</Text>
            <View style={{ gap: 8 }}>
              {createItems.map((item, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={item}
                    onChangeText={(text) =>
                      setCreateItems((prev) => prev.map((v, i) => (i === idx ? text : v)))
                    }
                    maxLength={300}
                    placeholder={`Madde ${idx + 1}`}
                    placeholderTextColor="#9ca3af"
                  />
                  {createItems.length > 1 && (
                    <Pressable onPress={() => setCreateItems((prev) => prev.filter((_, i) => i !== idx))} hitSlop={8}>
                      <Trash2 size={17} color="#dc2626" />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
            {createItems.length < 30 && (
              <Pressable style={styles.addItemBtn} onPress={() => setCreateItems((prev) => [...prev, ''])}>
                <Plus size={13} color="#1d4ed8" />
                <Text style={styles.addItemText}>Madde ekle</Text>
              </Pressable>
            )}

            <View style={styles.actionsRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelText}>İptal</Text>
              </Pressable>
              <Pressable style={[styles.saveBtn, creating && { opacity: 0.6 }]} onPress={handleCreate} disabled={creating}>
                <Text style={styles.saveText}>{creating ? 'Oluşturuluyor…' : 'Oluştur'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 90, flexGrow: 1 },
  emptyBox: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { color: '#9ca3af', fontSize: 14 },
  fab: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2F5755',
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '88%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1, paddingRight: 12 },
  sheetHint: { fontSize: 11.5, color: '#9ca3af', marginTop: 8, marginBottom: 4, lineHeight: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111827',
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  addItemText: { fontSize: 12.5, fontWeight: '600', color: '#1d4ed8' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelText: { color: '#374151', fontSize: 13.5, fontWeight: '600' },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10, backgroundColor: '#2F5755' },
  saveText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
});
