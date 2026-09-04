import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { ListChecks, Plus, Trash2, X } from 'lucide-react-native';
import { checklistAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import ChecklistCard from '../../components/ChecklistCard';
import ChecklistStatsModal from '../../components/ChecklistStatsModal';
import ChecklistEditModal from '../../components/ChecklistEditModal';
import { isWithinEditWindow, type Checklist, type ChecklistItem } from '../../types/checklist';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../context/ThemeContext';
import { TAB_BAR_SAFE_PADDING } from '../../components/layout/tabBarMetrics';
import KeyboardAvoider from '../../components/layout/KeyboardAvoider';

export default function ChecklistsScreen() {
  const route = useRoute<any>();
  const params = route.params as RootStackParamList['Checklists'];
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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
        c.id === checklistId ? { ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, checked: newChecked } : i)) } : c
      )
    );
    try {
      await checklistAPI.setItemState(item.id, newChecked);
    } catch {
      setChecklists((prev) =>
        prev.map((c) =>
          c.id === checklistId ? { ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, checked: !newChecked } : i)) } : c
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
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  const header = (
    <View className="mb-4">
      {/* Ekran içi "Checklistler" başlığı ve alt yazısı kaldırıldı — üst bar
          zaten sayfa adını yazıyor. Başlığın yanındaki oluşturma butonu kaldı,
          tek başına satırın sonuna hizalanıyor. */}
      <View className="flex-row justify-end">
        <Pressable className="flex-row items-center gap-2 bg-brand rounded-lg px-4 py-2" onPress={openCreateModal}>
          <Plus size={16} color="#fff" />
          <Text className="text-white text-sm font-medium">Checklist Oluştur</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-ground">
      <FlatList
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: TAB_BAR_SAFE_PADDING, flexGrow: 1 }}
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
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View className="items-center gap-3 bg-surface rounded-lg p-12" style={SHADOW_MD}>
            <ListChecks size={64} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text className="text-muted text-lg text-center">Henüz yayınlanmış bir checklist yok.</Text>
          </View>
        }
      />

      {statsChecklist && <ChecklistStatsModal checklist={statsChecklist} onClose={() => setStatsChecklist(null)} />}
      {editChecklist && <ChecklistEditModal checklist={editChecklist} onClose={() => setEditChecklist(null)} onSaved={fetchChecklists} />}

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoider>
          <View className="flex-1 bg-black/50 justify-center p-4">
            <View className="bg-surface rounded-xl p-6 max-h-[88%]">
              <View className="flex-row items-center justify-between">
                <Text className="text-xl font-bold text-ink flex-1 pr-3">Yeni Checklist Oluştur</Text>
                <Pressable onPress={() => setShowCreate(false)} hitSlop={8}>
                  <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                </Pressable>
              </View>
              <Text className="text-xs text-muted2 mt-1 mb-5 leading-4">
                Checklistin admin onayına gönderilir; onaylanana kadar yalnızca sana görünür. Oluşturduktan sonra 1 saat içinde
                düzenleyebilirsin.
              </Text>

              <Text className="text-sm font-medium text-ink2 mb-1 mt-4">
                Başlık <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TextInput
                className="border border-line bg-inset rounded-lg px-4 py-2 text-base text-ink"
                value={createTitle}
                onChangeText={setCreateTitle}
                maxLength={200}
                placeholder='Örn: "Erasmus Başvuru Süreci"'
                placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              />

              <Text className="text-sm font-medium text-ink2 mb-1 mt-4">Açıklama</Text>
              <TextInput
                className="border border-line bg-inset rounded-lg px-4 py-2 text-base text-ink"
                value={createDesc}
                onChangeText={setCreateDesc}
                placeholder="Kısa açıklama (opsiyonel)"
                placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              />

              <Text className="text-sm font-medium text-ink2 mb-1 mt-4">Maddeler</Text>
              <View className="gap-2">
                {createItems.map((item, idx) => (
                  <View key={idx} className="flex-row items-center gap-2.5">
                    <TextInput
                      className="flex-1 mb-0 border border-line bg-inset rounded-lg px-3 py-2 text-sm text-ink"
                      value={item}
                      onChangeText={(text) => setCreateItems((prev) => prev.map((v, i) => (i === idx ? text : v)))}
                      maxLength={300}
                      placeholder={`Madde ${idx + 1}`}
                      placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                    />
                    {createItems.length > 1 && (
                      <Pressable onPress={() => setCreateItems((prev) => prev.filter((_, i) => i !== idx))} hitSlop={8}>
                        <Trash2 size={17} color="#660B05" />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
              {createItems.length < 30 && (
                <Pressable className="flex-row items-center gap-[5px] mt-2.5" onPress={() => setCreateItems((prev) => [...prev, ''])}>
                  <Plus size={14} color={isDark ? '#5A9690' : '#2F5755'} />
                  <Text className="text-xs font-medium text-accent">Madde ekle</Text>
                </Pressable>
              )}

              <View className="flex-row gap-3 mt-6">
                <Pressable className="flex-1 items-center py-2 rounded-lg border border-line" onPress={() => setShowCreate(false)}>
                  <Text className="text-ink2 text-sm font-normal">İptal</Text>
                </Pressable>
                <Pressable
                  className={`flex-1 items-center py-2 rounded-lg bg-brand ${creating ? 'opacity-60' : ''}`}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  <Text className="text-white text-sm font-medium">{creating ? 'Oluşturuluyor...' : 'Oluştur'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoider>
      </Modal>
    </View>
  );
}

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};
