import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart2, Users, X } from 'lucide-react-native';
import { checklistAPI } from '../lib/api';
import { useDelayedLoading } from '../hooks/useDelayedLoading';
import { useTheme } from '../context/ThemeContext';
import { useGoToUserProfile } from '../hooks/useGoToUserProfile';
import type { Checklist } from '../types/checklist';

interface Completer {
  id: number;
  username: string;
  full_name: string;
  completed_at: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ChecklistStatsModal({ checklist, onClose }: { checklist: Checklist; onClose: () => void }) {
  const goToUserProfile = useGoToUserProfile();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const mutedIconColor = isDark ? '#DFD0B8' : '#6b7280';
  const brandIconColor = isDark ? '#5A9690' : '#2F5755';
  const sectionIconColor = isDark ? '#DFD0B8' : '#374151';
  const [completers, setCompleters] = useState<Completer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  // bkz. useDelayedLoading.ts — hızlı bağlantıda spinner hiç görünmüyor.
  const showLoading = useDelayedLoading(loading);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (p: number, append: boolean) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        const res = await checklistAPI.getCompleters(checklist.id, p, 20);
        setCompleters((prev) => (append ? [...prev, ...(res.data.completers || [])] : res.data.completers || []));
        setTotal(res.data.total || 0);
        setPage(p);
      } catch {
        // sessizce geç
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [checklist.id]
  );

  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  const items = checklist.completion?.items || [];
  const maxChecked = Math.max(1, ...items.map((i) => i.checkedCount));
  const hasMore = completers.length < total;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View className="bg-surface" style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text className="text-ink" style={styles.title} numberOfLines={1}>
              {checklist.title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={mutedIconColor} />
            </Pressable>
          </View>
          <Text className="text-muted" style={styles.subtitle}>
            Checklist istatistikleri
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
            <View className="bg-accent-soft" style={styles.summaryBox}>
              <Users size={22} color={brandIconColor} />
              <View>
                <Text className="text-accent" style={styles.summaryCount}>
                  {checklist.completion?.completedCount ?? total} kişi
                </Text>
                <Text className="text-muted" style={styles.summaryLabel}>
                  checklistin tamamını işaretleyerek tamamladı
                </Text>
              </View>
            </View>

            <View style={styles.sectionHeaderRow}>
              <BarChart2 size={15} color={sectionIconColor} />
              <Text className="text-ink2" style={styles.sectionHeader}>
                Madde bazlı işaretlenme
              </Text>
            </View>
            {items.length === 0 ? (
              <Text className="text-muted" style={styles.emptyText}>
                Bu checklistte henüz madde yok.
              </Text>
            ) : (
              <View style={{ gap: 10, marginBottom: 16 }}>
                {items.map((item) => (
                  <View key={item.id}>
                    <View style={styles.itemStatRow}>
                      <Text className="text-ink2" style={styles.itemStatText} numberOfLines={1}>
                        {item.content}
                      </Text>
                      <Text className="text-ink2" style={styles.itemStatCount}>
                        {item.checkedCount}
                      </Text>
                    </View>
                    <View className="bg-inset" style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(item.checkedCount / maxChecked) * 100}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
              <Users size={15} color={sectionIconColor} />
              <Text className="text-ink2" style={styles.sectionHeader}>
                Dolduranlar
              </Text>
            </View>
            {showLoading ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color="#1d4ed8" />
            ) : loading ? null : completers.length === 0 ? (
              <Text className="text-muted" style={styles.emptyText}>
                Bu checklisti henüz kimse tamamlamadı.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {completers.map((c) => (
                  <Pressable
                    key={c.id}
                    className="bg-inset border-line-soft"
                    style={styles.completerRow}
                    onPress={() => {
                      onClose();
                      goToUserProfile(c.username);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text className="text-ink" style={styles.completerName} numberOfLines={1}>
                        {c.full_name}
                      </Text>
                      <Text className="text-muted" style={styles.completerUsername}>
                        @{c.username}
                      </Text>
                    </View>
                    <Text className="text-muted" style={styles.completerDate}>
                      {formatDate(c.completed_at)}
                    </Text>
                  </Pressable>
                ))}
                {hasMore && (
                  <Pressable style={styles.loadMore} onPress={() => fetchPage(page + 1, true)} disabled={loadingMore}>
                    {loadingMore ? (
                      <ActivityIndicator color="#1d4ed8" />
                    ) : (
                      <Text className="text-info" style={styles.loadMoreText}>
                        Daha fazla göster
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 16, padding: 20, maxHeight: '85%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 11.5, marginTop: 2 },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  summaryCount: { fontSize: 17, fontWeight: '700' },
  summaryLabel: { fontSize: 11.5, marginTop: 2 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionHeader: { fontSize: 13, fontWeight: '700' },
  emptyText: { fontSize: 12, marginBottom: 16 },
  itemStatRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  itemStatText: { flex: 1, fontSize: 12 },
  itemStatCount: { fontSize: 12, fontWeight: '600' },
  barTrack: { height: 5, borderRadius: 100, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#4f7d7a', borderRadius: 100 },
  completerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  completerName: { fontSize: 13, fontWeight: '600' },
  completerUsername: { fontSize: 11 },
  completerDate: { fontSize: 11 },
  loadMore: { alignItems: 'center', paddingVertical: 10 },
  loadMoreText: { fontSize: 13, fontWeight: '600' },
});
