import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarChart2, CheckCircle2, ChevronDown, Pencil } from 'lucide-react-native';
import type { Checklist, ChecklistItem } from '../types/checklist';
import { useTheme } from '../context/ThemeContext';

interface Props {
  checklist: Checklist;
  isOpen: boolean;
  onToggleOpen: (checklist: Checklist) => void;
  onToggleItem?: (checklistId: number, item: ChecklistItem) => void;
  onStatsClick?: (checklist: Checklist) => void;
  onEditClick?: (checklist: Checklist) => void;
  canEdit?: boolean;
  readOnlyItems?: boolean;
}

// `React.memo`: bu kart üç ekranda listede basılıyor (Profil, Kontrol
// listeleri, Kullanıcı profili) ve içinde her madde için bir satır var. Memo
// olmadan, listeyi tutan ekranın HERHANGİ bir state'i değişince tüm kartlar
// tüm maddeleriyle yeniden çiziliyordu — bir kutucuğu işaretlemek bile
// ekrandaki her kartı baştan render ediyordu.
//
// Çağıranların `on*` prop'larını `useCallback` ile vermesi ŞART, yoksa memo
// hiçbir zaman bail-out yapamaz (bkz. PostCard'daki aynı not).
function ChecklistCard({
  checklist,
  isOpen,
  onToggleOpen,
  onToggleItem,
  onStatsClick,
  onEditClick,
  canEdit = false,
  readOnlyItems = false,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const brandColor = isDark ? '#5A9690' : '#2F5755';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';
  const total = checklist.items.length;
  const done = checklist.items.filter((i) => i.checked).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const isUserList = checklist.list_type === 'user';
  const isPending = checklist.approval_status === 'pending';

  return (
    <View className="bg-surface" style={styles.card}>
      <Pressable style={styles.headerRow} onPress={() => onToggleOpen(checklist)}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text className="text-ink" style={styles.title}>
              {checklist.title}
            </Text>
            {isUserList && isPending && (
              <View className="bg-warn-soft" style={styles.pendingBadge}>
                <Text className="text-warn-ink" style={styles.pendingText}>
                  Onay Bekliyor
                </Text>
              </View>
            )}
          </View>
          {!!checklist.description && (
            <Text className="text-muted" style={styles.desc}>
              {checklist.description}
            </Text>
          )}
          <View style={styles.progressRow}>
            <View className="bg-inset" style={styles.progressTrack}>
              <View className="bg-accent" style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
            <Text className="text-muted" style={styles.progressText}>
              {done}/{total}
            </Text>
          </View>
        </View>
        <ChevronDown size={20} color={mutedColor} style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
      </Pressable>

      {isOpen && (
        <View className="border-line-soft" style={styles.itemsBlock}>
          {checklist.items.length === 0 ? (
            <Text className="text-muted" style={styles.emptyText}>
              Bu checklistte henüz madde yok.
            </Text>
          ) : (
            checklist.items.map((item) => (
              <Pressable key={item.id} style={styles.itemRow} disabled={readOnlyItems} onPress={() => onToggleItem?.(checklist.id, item)}>
                <View
                  className={item.checked ? undefined : 'border-line'}
                  style={[styles.checkbox, item.checked && { backgroundColor: brandColor, borderColor: brandColor }]}
                >
                  {item.checked && <CheckCircle2 size={14} color="#fff" />}
                </View>
                <Text
                  className={item.checked ? undefined : 'text-ink'}
                  style={[styles.itemText, item.checked && { color: isDark ? '#6b7280' : '#9ca3af', textDecorationLine: 'line-through' }]}
                >
                  {item.content}
                </Text>
              </Pressable>
            ))
          )}

          {total > 0 && done === total && (
            <View className="bg-success-soft" style={styles.doneBanner}>
              <CheckCircle2 size={18} color={isDark ? '#4ade80' : '#15803d'} />
              <Text className="text-success" style={styles.doneBannerText}>
                Tebrikler, bu checklisti tamamladın!
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.actionsRow}>
        {canEdit && (
          <Pressable className="bg-inset" style={styles.actionBtn} onPress={() => onEditClick?.(checklist)} hitSlop={8}>
            <Pencil size={15} color={mutedColor} />
          </Pressable>
        )}
        {isUserList && checklist.completion && (
          <Pressable className="bg-inset" style={styles.actionBtn} onPress={() => onStatsClick?.(checklist)} hitSlop={8}>
            <BarChart2 size={15} color={mutedColor} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default React.memo(ChecklistCard);

const styles = StyleSheet.create({
  card: { borderRadius: 14, marginBottom: 12, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 16, fontWeight: '600' },
  pendingBadge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  pendingText: { fontSize: 10.5, fontWeight: '600' },
  desc: { fontSize: 12.5, marginTop: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  progressTrack: { flex: 1, height: 6, borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 100 },
  progressText: { fontSize: 11.5, fontWeight: '600' },
  itemsBlock: { borderTopWidth: 1, padding: 12, gap: 2 },
  emptyText: { fontSize: 13, padding: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { fontSize: 13.5, flex: 1 },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  doneBannerText: { fontSize: 12.5, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 8, paddingTop: 0 },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
