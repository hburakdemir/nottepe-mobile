import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Ban, ChevronDown, Inbox, MessageSquare, PackageSearch, Phone, Plus, Search, ShieldCheck } from 'lucide-react-native';
import { lostItemAPI } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { usePullRefresh } from '../../hooks/usePullRefresh';
import OptionSheet from '../../components/layout/OptionSheet';
import LostItemCard from '../../components/lostItems/LostItemCard';
import CreateLostItemModal from '../../components/lostItems/CreateLostItemModal';
import LostItemDetailModal from '../../components/lostItems/LostItemDetailModal';
import {
  CLAIM_STATUS_META,
  TYPE_META,
  formatDateTime,
  lostItemImageUrl,
  type LostItem,
  type MyClaim,
} from '../../components/lostItems/lostItemMeta';
import type { RootStackParamList } from '../../navigation/types';

const PAGE_LIMIT = 12;
const STALE_MS = 60 * 1000;

type Tab = 'lost' | 'found' | 'mine' | 'claims';
const TABS: { value: Tab; label: string }[] = [
  { value: 'lost', label: 'Kayıplar' },
  { value: 'found', label: 'Bulunanlar' },
  { value: 'mine', label: 'İlanlarım' },
  { value: 'claims', label: 'Başvurularım' },
];

type BoardStatus = 'open' | 'resolved';
const STATUS_OPTIONS = [
  { value: 'open', label: 'Açık ilanlar' },
  { value: 'resolved', label: 'Çözülenler' },
];

interface BoardPage {
  items: LostItem[];
  total: number;
}

const EMPTY: LostItem[] = [];

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

function MyClaimRow({ claim, onOpen }: { claim: MyClaim; onOpen: (id: number) => void }) {
  const st = CLAIM_STATUS_META[claim.status];
  const type = TYPE_META[claim.item_type] ?? TYPE_META.lost;
  return (
    <Pressable className="bg-surface rounded-lg p-4 mb-3 flex-row gap-3" style={SHADOW_MD} onPress={() => onOpen(claim.item_id)}>
      <View className="w-16 h-16 rounded-lg bg-inset overflow-hidden items-center justify-center">
        {claim.item_images?.[0] ? (
          <Image source={{ uri: lostItemImageUrl(claim.item_images[0]) }} style={{ width: 64, height: 64 }} contentFit="cover" />
        ) : (
          <PackageSearch size={26} color="#9ca3af" />
        )}
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex-row flex-wrap gap-1.5 mb-1">
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: type.bg }}>
            <Text style={{ color: type.text, fontSize: 10.5, fontWeight: '700' }}>{type.label}</Text>
          </View>
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: st.bg }}>
            <Text style={{ color: st.text, fontSize: 10.5, fontWeight: '700' }}>{st.label}</Text>
          </View>
        </View>
        <Text className="text-ink font-semibold" numberOfLines={1}>
          {claim.item_title}
        </Text>
        <Text className="text-muted2 text-xs">
          İlan sahibi: {claim.owner_username} · {formatDateTime(claim.created_at)}
        </Text>
        {claim.status === 'accepted' && !!claim.item_contact && (
          <View className="flex-row items-center gap-1 mt-1">
            <Phone size={13} color="#166534" />
            <Text style={{ color: '#166534', fontSize: 13, flexShrink: 1 }} selectable>
              {claim.item_contact}
            </Text>
          </View>
        )}
        {claim.status === 'accepted' && !!claim.owner_note && (
          <View className="flex-row gap-1.5 mt-2 rounded-lg p-2" style={{ backgroundColor: '#dcfce7' }}>
            <MessageSquare size={14} color="#166534" style={{ marginTop: 2 }} />
            <Text style={{ color: '#166534', fontSize: 13, flex: 1 }}>{claim.owner_note}</Text>
          </View>
        )}
        {!!claim.handed_over_place && !!claim.handed_over_at && (
          <View className="flex-row items-center gap-1 mt-1">
            <ShieldCheck size={13} color="#b45309" />
            <Text style={{ color: '#b45309', fontSize: 12, flexShrink: 1 }}>
              Teslim edildi: {claim.handed_over_place} · {formatDateTime(claim.handed_over_at)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function LostItemsScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const muted = isDark ? '#9ca3af' : '#6b7280';
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'LostItems'>>();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('lost');
  const [status, setStatus] = useState<BoardStatus>('open');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [showStatus, setShowStatus] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [openItem, setOpenItem] = useState<{ id: number; initial?: LostItem } | null>(null);

  // Bildirimden gelen hedef: { itemId }. Push params güvenilmez girdi
  // (bkz. lib/push/targets.ts) — yalnız pozitif tam sayı kabul edilir.
  const routeItemId = route.params?.itemId;
  useEffect(() => {
    const id = Number(routeItemId);
    if (Number.isInteger(id) && id > 0) {
      setOpenItem({ id });
      navigation.setParams({ itemId: undefined });
    }
  }, [routeItemId, navigation]);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const isBoard = tab === 'lost' || tab === 'found';

  const boardKey = useMemo(() => ['lostItems', 'board', { tab, status, q }] as const, [tab, status, q]);
  const board = useInfiniteQuery({
    queryKey: boardKey,
    queryFn: async ({ pageParam }) => {
      const res = await lostItemAPI.getAll({
        page: pageParam,
        limit: PAGE_LIMIT,
        type: tab,
        status,
        q,
      });
      return res.data as BoardPage;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
    enabled: isBoard,
    staleTime: STALE_MS,
  });

  const mine = useQuery({
    queryKey: ['lostItems', 'mine'],
    queryFn: async () => ((await lostItemAPI.getMine()).data.items || []) as LostItem[],
    enabled: tab === 'mine',
    staleTime: STALE_MS,
  });

  const claims = useQuery({
    queryKey: ['lostItems', 'myClaims'],
    queryFn: async () => ((await lostItemAPI.getMyClaims()).data.claims || []) as MyClaim[],
    enabled: tab === 'claims',
    staleTime: STALE_MS,
  });

  const boardItems = useMemo(() => board.data?.pages.flatMap((p) => p.items) ?? EMPTY, [board.data]);
  const items = tab === 'mine' ? mine.data ?? EMPTY : boardItems;
  const loading = tab === 'mine' ? mine.isLoading : tab === 'claims' ? claims.isLoading : board.isLoading;

  // Her değişiklik (ilan, başvuru, teslim, çözüldü) birden çok listeyi
  // bayatlatıyor — `lostItems` ön ekiyle hepsi birlikte geçersiz.
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['lostItems'] });
  }, [queryClient]);

  const openDetail = useCallback((item: LostItem) => setOpenItem({ id: item.id, initial: item }), []);
  const openProfile = useCallback(
    (username: string) => {
      setOpenItem(null);
      navigation.navigate('UserProfile', { username });
    },
    [navigation]
  );

  const header = (
    <View className="mb-4">
      <Pressable
        className="flex-row items-center justify-center gap-2 bg-brand rounded-lg px-5 py-2.5 self-start"
        onPress={() => setShowCreate(true)}
      >
        <Plus size={18} color="#fff" />
        <Text className="text-white text-[15px] font-bold">İlan Ver</Text>
      </Pressable>

      <View className="flex-row gap-1.5 mt-3">
        <Ban size={13} color="#ef4444" style={{ marginTop: 2 }} />
        <Text className="text-muted2 text-xs flex-1 leading-4">
          Pano ticari amaçla kullanılamaz; satış, ücret/ödül talebi ve reklam ilanları kaldırılır.
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
        <View className="flex-row">
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <Pressable
                key={t.value}
                className={`rounded-lg px-4 py-2 mr-2 ${active ? 'bg-brand' : 'bg-inset'}`}
                onPress={() => setTab(t.value)}
              >
                <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-muted'}`}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {isBoard && (
        <View className="gap-3 mt-4 bg-surface rounded-lg p-4" style={SHADOW_MD}>
          <View className="flex-row items-center bg-inset border border-line rounded-lg px-3">
            <Search size={16} color={muted} />
            <TextInput
              className="flex-1 text-ink text-sm py-2.5 px-2"
              value={qInput}
              onChangeText={setQInput}
              placeholder="Ara: kulaklık, MM amfi..."
              placeholderTextColor="#9ca3af"
              returnKeyType="search"
            />
          </View>
          <Pressable
            className="flex-row items-center justify-between bg-inset border border-line rounded-lg px-4 py-2.5"
            onPress={() => setShowStatus(true)}
          >
            <Text className="text-sm text-ink flex-shrink" numberOfLines={1}>
              {status === 'resolved' ? 'Çözülenler' : 'Açık ilanlar'}
            </Text>
            <ChevronDown size={16} color={muted} />
          </Pressable>
        </View>
      )}
    </View>
  );

  const emptyText =
    tab === 'mine'
      ? 'Henüz ilan vermedin.'
      : tab === 'claims'
        ? 'Henüz bir ilana başvurmadın.'
        : status === 'resolved'
          ? 'Henüz çözülen ilan yok.'
          : tab === 'found'
            ? 'Açık bulunan eşya ilanı yok.'
            : 'Açık kayıp ilanı yok.';

  const empty = loading ? (
    <ActivityIndicator color="#2F5755" style={{ marginTop: 32 }} />
  ) : (
    <View className="items-center bg-surface rounded-lg py-12 gap-4" style={SHADOW_MD}>
      <Inbox size={64} color={isDark ? '#6b7280' : '#9ca3af'} />
      <Text className="text-muted text-base">{emptyText}</Text>
    </View>
  );

  const pull = usePullRefresh(() =>
    tab === 'claims' ? claims.refetch() : tab === 'mine' ? mine.refetch() : board.refetch()
  );

  return (
    <View className="flex-1 bg-ground">
      {tab === 'claims' ? (
        <FlatList
          showsVerticalScrollIndicator={false}
          contentContainerClassName="p-4 pb-[150px]"
          data={claims.data ?? []}
          keyExtractor={(c) => String(c.id)}
          ListHeaderComponent={header}
          renderItem={({ item }) => <MyClaimRow claim={item} onOpen={(id) => setOpenItem({ id })} />}
          ListEmptyComponent={empty}
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
        />
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          contentContainerClassName="p-4 pb-[150px]"
          data={loading ? EMPTY : items}
          keyExtractor={(item) => String(item.id)}
          maxToRenderPerBatch={6}
          windowSize={7}
          initialNumToRender={6}
          ListHeaderComponent={header}
          renderItem={({ item }) => <LostItemCard item={item} onOpen={openDetail} />}
          ListEmptyComponent={empty}
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
          ListFooterComponent={
            isBoard && board.hasNextPage ? (
              <Pressable
                className="items-center border border-brand rounded-lg py-2.5 mt-2"
                onPress={() => board.fetchNextPage()}
                disabled={board.isFetchingNextPage}
              >
                {board.isFetchingNextPage ? (
                  <ActivityIndicator color="#2F5755" />
                ) : (
                  <Text className="text-accent text-[13px] font-semibold">Daha Fazla Göster</Text>
                )}
              </Pressable>
            ) : null
          }
        />
      )}

      {showCreate && (
        <CreateLostItemModal
          initialType={tab === 'found' ? 'found' : 'lost'}
          onClose={() => setShowCreate(false)}
          onCreated={refresh}
        />
      )}
      {openItem && (
        <LostItemDetailModal
          key={openItem.id}
          itemId={openItem.id}
          initialItem={openItem.initial}
          onClose={() => setOpenItem(null)}
          onChanged={refresh}
          onOpenProfile={openProfile}
        />
      )}

      <OptionSheet
        visible={showStatus}
        title="İlanlar"
        options={STATUS_OPTIONS}
        value={status}
        searchable={false}
        onSelect={(v) => setStatus(v as BoardStatus)}
        onClose={() => setShowStatus(false)}
      />
    </View>
  );
}
