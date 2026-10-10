import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ListRenderItem, Pressable, Text, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckCircle2, ExternalLink, RotateCcw, XCircle } from 'lucide-react-native';
import { moderationAPI, type ReportStatus, type ReportTargetType } from '../../lib/api';
import type { RootStackParamList } from '../../navigation/types';
import { useThemeColors } from '../../context/ThemeContext';
import FilterChip from './FilterChip';

// Yönetici/moderatörün şikâyet listesi — web'deki admin paneli
// "Şikâyetler" sekmesinin (client/src/pages/admin/tabs/ReportsTab.jsx) mobil
// karşılığı. Sunucu uçları: GET /reports/admin, PATCH /reports/admin/:id.
// "İçeriği kaldır" bilerek yok: türe göre ayrı admin uçları gerekiyor; içerik
// "İçeriğe git" ile açılıp oradaki moderasyon menüsünden kaldırılabiliyor.

const PAGE_LIMIT = 20;

const STATUS_TABS: { key: ReportStatus; label: string }[] = [
  { key: 'open', label: 'Açık' },
  { key: 'resolved', label: 'Çözüldü' },
  { key: 'dismissed', label: 'Yoksayıldı' },
];

const TYPE_LABELS: Record<ReportTargetType, string> = {
  post: 'Gönderi',
  comment: 'Yorum',
  faq: 'Tartışma',
  faq_comment: 'Tartışma yorumu',
  suggestion: 'Öneri',
  suggestion_comment: 'Öneri yorumu',
  note_request: 'Not isteği',
  user: 'Kullanıcı',
};

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam / reklam',
  harassment: 'Hakaret / taciz',
  inappropriate: 'Uygunsuz içerik',
  copyright: 'Telif / kopya',
  misinformation: 'Yanlış bilgi',
  other: 'Diğer',
};

interface Report {
  id: number;
  target_type: ReportTargetType;
  target_id: number;
  parent_id: number | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  report_count: number;
  target_preview: string | null;
  target_username: string | null;
  reporter_username: string;
  handled_by_username: string | null;
  handled_at: string | null;
  created_at: string;
}

interface ReportsPage {
  reports: Report[];
  total: number;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

// İçeriğin uygulamada açılacağı ekran; yorumlar bağlı oldukları üst içerikte.
function openTarget(navigation: Nav, r: Report): (() => void) | null {
  switch (r.target_type) {
    case 'post':
      return () => navigation.navigate('PostDetail', { postId: r.target_id });
    case 'comment':
      return r.parent_id ? () => navigation.navigate('PostDetail', { postId: r.parent_id! }) : null;
    case 'faq':
      return () => navigation.navigate('FaqDetail', { id: r.target_id });
    case 'faq_comment':
      return r.parent_id ? () => navigation.navigate('FaqDetail', { id: r.parent_id! }) : null;
    case 'suggestion':
      return () => navigation.navigate('SuggestionDetail', { id: r.target_id });
    case 'suggestion_comment':
      return r.parent_id ? () => navigation.navigate('SuggestionDetail', { id: r.parent_id! }) : null;
    case 'note_request':
      return () => navigation.navigate('NoteRequests');
    case 'user':
      return r.target_username ? () => navigation.navigate('UserProfile', { username: r.target_username! }) : null;
    default:
      return null;
  }
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ActionButton({
  icon: Icon,
  label,
  onPress,
  primary,
  disabled,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      className={`flex-row items-center gap-1 rounded-lg px-3 py-1.5 active:opacity-60 ${
        primary ? 'bg-brand' : 'border border-line'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <Icon size={14} color={primary ? '#fff' : colors.muted} />
      <Text className={`text-xs font-medium ${primary ? 'text-white' : 'text-muted'}`}>{label}</Text>
    </Pressable>
  );
}

function ReportCard({
  report: r,
  busy,
  onSetStatus,
}: {
  report: Report;
  busy: boolean;
  onSetStatus: (r: Report, next: ReportStatus) => void;
}) {
  const navigation = useNavigation<Nav>();
  const open = openTarget(navigation, r);
  return (
    <View className="bg-surface rounded-xl p-3.5 mb-2.5">
      <View className="flex-row items-center flex-wrap gap-1.5 mb-2">
        <View className="bg-inset rounded-full px-2 py-[3px]">
          <Text className="text-[10.5px] font-semibold text-muted">{TYPE_LABELS[r.target_type] || r.target_type}</Text>
        </View>
        <View className="bg-danger-soft rounded-full px-2 py-[3px]">
          <Text className="text-[10.5px] font-semibold text-danger">{REASON_LABELS[r.reason] || r.reason}</Text>
        </View>
        {r.report_count > 1 && (
          <View className="bg-warn-soft rounded-full px-2 py-[3px]">
            <Text className="text-[10.5px] font-semibold text-warn-ink">{r.report_count} şikâyet</Text>
          </View>
        )}
        <Text className="text-[11px] text-muted2 ml-auto">{formatDateTime(r.created_at)}</Text>
      </View>

      {r.target_preview ? (
        <Text className="text-[13.5px] text-ink leading-[19px]" numberOfLines={3}>
          {r.target_preview}
        </Text>
      ) : (
        <Text className="text-[13.5px] text-muted2 italic">(içerik bulunamadı / silinmiş)</Text>
      )}
      <Text className="text-[11.5px] text-muted mt-1">
        İçerik sahibi: {r.target_username ? `@${r.target_username}` : '—'} · Bildiren: @{r.reporter_username}
      </Text>
      {!!r.details && <Text className="text-[11.5px] text-muted italic mt-1">“{r.details}”</Text>}
      {!!r.handled_by_username && !!r.handled_at && (
        <Text className="text-[11px] text-muted2 mt-1">
          İşlem: @{r.handled_by_username} · {formatDateTime(r.handled_at)}
        </Text>
      )}

      <View className="flex-row flex-wrap gap-2 mt-3">
        {open && <ActionButton icon={ExternalLink} label="İçeriğe git" onPress={open} />}
        {r.status === 'open' ? (
          <>
            <ActionButton icon={CheckCircle2} label="Çözüldü" primary disabled={busy} onPress={() => onSetStatus(r, 'resolved')} />
            <ActionButton icon={XCircle} label="Yoksay" disabled={busy} onPress={() => onSetStatus(r, 'dismissed')} />
          </>
        ) : (
          <ActionButton icon={RotateCcw} label="Yeniden aç" disabled={busy} onPress={() => onSetStatus(r, 'open')} />
        )}
      </View>
    </View>
  );
}

export default function ReportsList({ loadingPlaceholder }: { loadingPlaceholder: React.ReactNode }) {
  const colors = useThemeColors();
  const [status, setStatus] = useState<ReportStatus>('open');
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data, isLoading, isError, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: ['moderation', 'reports', status],
    queryFn: async ({ pageParam }) => {
      const res = await moderationAPI.adminReports({ status, page: pageParam, limit: PAGE_LIMIT });
      return res.data as ReportsPage;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.reports.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
    // Şikâyet 24 saat içinde incelenecek: sekmeye her girişte taze liste.
    staleTime: 0,
  });

  const reports = data?.pages.flatMap((p) => p.reports) ?? [];
  const total = data?.pages[0]?.total;

  // Durum değişince satır o listeden çıkıyor; sunucu aynı içeriğin diğer açık
  // şikâyetlerini de kapattığı için yerel çıkarma yerine yeniden çekiliyor.
  const handleSetStatus = useCallback(
    async (r: Report, next: ReportStatus) => {
      setBusyId(r.id);
      try {
        await moderationAPI.setReportStatus(r.id, next);
        await refetch();
      } catch (err: any) {
        Alert.alert('Güncellenemedi', err.response?.data?.message || 'Şikâyet güncellenemedi, tekrar dene.');
      } finally {
        setBusyId(null);
      }
    },
    [refetch]
  );

  const renderItem = useCallback<ListRenderItem<Report>>(
    ({ item }) => <ReportCard report={item} busy={busyId === item.id} onSetStatus={handleSetStatus} />,
    [busyId, handleSetStatus]
  );

  return (
    <FlatList
      showsVerticalScrollIndicator={false}
      contentContainerClassName="p-3 pb-[150px] flex-grow gap-2.5"
      data={reports}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      // `removeClippedSubviews` bilerek yok — gerekçe NotificationsScreen'deki listelerde.
      maxToRenderPerBatch={6}
      windowSize={7}
      initialNumToRender={6}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View className="mb-3">
          <View className="flex-row flex-wrap gap-2">
            {STATUS_TABS.map((t) => (
              <FilterChip
                key={t.key}
                label={status === t.key && total !== undefined ? `${t.label} (${total})` : t.label}
                selected={status === t.key}
                onPress={() => (status === t.key ? refetch() : setStatus(t.key))}
              />
            ))}
          </View>
          {isRefetching && !isFetchingNextPage && reports.length > 0 && (
            <ActivityIndicator style={{ marginTop: 10 }} color={colors.accent} />
          )}
        </View>
      }
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ marginTop: 12 }} color={colors.accent} /> : null}
      ListEmptyComponent={
        isLoading ? (
          <>{loadingPlaceholder}</>
        ) : (
          <Text className="text-center text-muted2 mt-6">
            {isError ? 'Şikâyetler alınamadı.' : 'Bu listede şikâyet yok.'}
          </Text>
        )
      }
    />
  );
}
