import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarChart2, CheckCircle2, ChevronDown, Pencil } from 'lucide-react-native';
import type { Checklist, ChecklistItem } from '../types/checklist';

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

export default function ChecklistCard({
  checklist,
  isOpen,
  onToggleOpen,
  onToggleItem,
  onStatsClick,
  onEditClick,
  canEdit = false,
  readOnlyItems = false,
}: Props) {
  const total = checklist.items.length;
  const done = checklist.items.filter((i) => i.checked).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const isUserList = checklist.list_type === 'user';
  const isPending = checklist.approval_status === 'pending';

  return (
    <View style={styles.card}>
      <Pressable style={styles.headerRow} onPress={() => onToggleOpen(checklist)}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{checklist.title}</Text>
            {isUserList && isPending && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Onay Bekliyor</Text>
              </View>
            )}
          </View>
          {!!checklist.description && <Text style={styles.desc}>{checklist.description}</Text>}
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {done}/{total}
            </Text>
          </View>
        </View>
        <ChevronDown
          size={20}
          color="#9ca3af"
          style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
        />
      </Pressable>

      {isOpen && (
        <View style={styles.itemsBlock}>
          {checklist.items.length === 0 ? (
            <Text style={styles.emptyText}>Bu checklistte henüz madde yok.</Text>
          ) : (
            checklist.items.map((item) => (
              <Pressable
                key={item.id}
                style={styles.itemRow}
                disabled={readOnlyItems}
                onPress={() => onToggleItem?.(checklist.id, item)}
              >
                <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                  {item.checked && <CheckCircle2 size={14} color="#fff" />}
                </View>
                <Text style={[styles.itemText, item.checked && styles.itemTextChecked]}>
                  {item.content}
                </Text>
              </Pressable>
            ))
          )}

          {total > 0 && done === total && (
            <View style={styles.doneBanner}>
              <CheckCircle2 size={18} color="#15803d" />
              <Text style={styles.doneBannerText}>Tebrikler, bu checklisti tamamladın!</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.actionsRow}>
        {canEdit && (
          <Pressable style={styles.actionBtn} onPress={() => onEditClick?.(checklist)} hitSlop={8}>
            <Pencil size={15} color="#6b7280" />
          </Pressable>
        )}
        {isUserList && checklist.completion && (
          <Pressable style={styles.actionBtn} onPress={() => onStatsClick?.(checklist)} hitSlop={8}>
            <BarChart2 size={15} color="#6b7280" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  pendingBadge: { backgroundColor: '#fef9c3', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  pendingText: { fontSize: 10.5, fontWeight: '600', color: '#854d0e' },
  desc: { fontSize: 12.5, color: '#6b7280', marginTop: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  progressTrack: { flex: 1, height: 6, borderRadius: 100, backgroundColor: '#e5e7eb', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2F5755', borderRadius: 100 },
  progressText: { fontSize: 11.5, fontWeight: '600', color: '#6b7280' },
  itemsBlock: { borderTopWidth: 1, borderTopColor: '#f3f4f6', padding: 12, gap: 2 },
  emptyText: { fontSize: 13, color: '#9ca3af', padding: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#2F5755', borderColor: '#2F5755' },
  itemText: { fontSize: 13.5, color: '#1f2937', flex: 1 },
  itemTextChecked: { color: '#9ca3af', textDecorationLine: 'line-through' },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  doneBannerText: { fontSize: 12.5, fontWeight: '600', color: '#15803d' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 8, paddingTop: 0 },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
