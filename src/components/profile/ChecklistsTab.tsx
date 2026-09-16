import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ListChecks } from 'lucide-react-native';
import ChecklistCard from '../ChecklistCard';
import ChecklistStatsModal from '../ChecklistStatsModal';
import ChecklistEditModal from '../ChecklistEditModal';
import { checklistAPI } from '../../lib/api';
import { isWithinEditWindow, type Checklist, type ChecklistItem } from '../../types/checklist';
import type { RootStackParamList } from '../../navigation/types';
import { MY_CHECKLISTS_KEY, useMyChecklists } from '../../hooks/profile/useProfileLists';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';
import PagerPage, { type ProfileTabProps } from './PagerPage';
import { EmptyState, TabLoading } from './profileCommon';

// Profil > Checklistler sekmesi.
//
// Eskiden bu içerik (ve kendi üç state'i: açık kart, istatistik modal'ı,
// düzenleme modal'ı) ProfileScreen'in gövdesindeydi; bir kartı açıp kapatmak
// 1632 satırlık ağacın tamamını yeniden render ediyordu. Artık state burada ve
// bileşen `React.memo` — dışarıdan gelen alakasız güncellemeler bu ağaca
// girmiyor.
function ChecklistsTab({ active, width, headerHeight, scrollY, onRememberOffset }: ProfileTabProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { data: checklists, isPending } = useMyChecklists();
  // İnternet hızlıysa spinner hiç görünmüyor (bkz. useDelayedLoading.ts) —
  // aynı kural ProfileScreen'in dış iskeletinde de geçerli. `isPending`
  // gecikme dolmadan da true kalabiliyor; o aralıkta hiçbir şey göstermiyoruz
  // (aşağıdaki `null` dalı), yoksa veri henüz gelmemişken "boş" metni yanlışlıkla
  // yanıp sönerdi.
  const showLoading = useDelayedLoading(isPending);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statsChecklist, setStatsChecklist] = useState<Checklist | null>(null);
  const [editChecklist, setEditChecklist] = useState<Checklist | null>(null);

  const handleToggleOpen = useCallback((c: Checklist) => {
    setExpandedId((prev) => (prev === c.id ? null : c.id));
  }, []);

  // İyimser güncelleme: kutucuk anında işaretleniyor, istek arkada gidiyor.
  // Sunucu reddederse uyarı çıkıyor — eski ham state'li davranışın birebir
  // aynısı, sadece kaynak artık react-query cache'i.
  const handleToggleItem = useCallback(
    async (checklistId: number, item: ChecklistItem) => {
      const newChecked = !item.checked;
      queryClient.setQueryData<Checklist[]>(MY_CHECKLISTS_KEY, (prev) =>
        prev?.map((c) =>
          c.id === checklistId
            ? { ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, checked: newChecked } : i)) }
            : c
        )
      );
      try {
        await checklistAPI.setItemState(item.id, newChecked);
      } catch {
        Alert.alert('Hata', 'Kaydedilemedi, tekrar deneyin.');
      }
    },
    [queryClient]
  );

  const goToChecklists = useCallback(() => navigation.navigate('Checklists'), [navigation]);

  // Düzenleme/silme sonrası liste tazeleniyor — eski koddaki "sentinel'i null'a
  // çek, effect yeniden çeksin" deseninin karşılığı.
  const handleSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: MY_CHECKLISTS_KEY });
  }, [queryClient]);

  return (
    <PagerPage
      tabKey="lists"
      width={width}
      headerHeight={headerHeight}
      scrollY={scrollY}
      onRememberOffset={onRememberOffset}
    >
      {active &&
        (showLoading ? (
          <TabLoading />
        ) : isPending ? null : !checklists || checklists.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            text="Henüz bir checklist oluşturmadın."
            actionLabel="Checklistlere Git"
            onAction={goToChecklists}
          />
        ) : (
          checklists.map((checklist) => (
            <ChecklistCard
              key={checklist.id}
              checklist={checklist}
              isOpen={expandedId === checklist.id}
              onToggleOpen={handleToggleOpen}
              onToggleItem={handleToggleItem}
              onStatsClick={setStatsChecklist}
              onEditClick={setEditChecklist}
              canEdit={isWithinEditWindow(checklist)}
            />
          ))
        ))}

      {/* Modallar burada durabiliyor: RN `Modal`'ı `position: absolute` ile
          çiziliyor, yani üstteki `gap`/yerleşim akışına hiç katılmıyor. */}
      {statsChecklist && <ChecklistStatsModal checklist={statsChecklist} onClose={() => setStatsChecklist(null)} />}
      {editChecklist && (
        <ChecklistEditModal checklist={editChecklist} onClose={() => setEditChecklist(null)} onSaved={handleSaved} />
      )}
    </PagerPage>
  );
}

export default React.memo(ChecklistsTab);
