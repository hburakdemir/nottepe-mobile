import React, { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  profileForumsKey,
  profileListKey,
  useProfileCounts,
  type ProfileOwner,
} from '../../hooks/profile/useProfileLists';
import { SHADOW_MD, TABS, type TabKey } from './profileCommon';

type TabDef = (typeof TABS)[number];

// Önbellekteki bir listenin uzunluğu — İSTEK ATMADAN. Liste yalnızca sekmesi
// mount olunca çekiliyor; çekildiyse (ve sonra silme/bırakma ile değiştiyse)
// sayaç sunucunun açılıştaki sayısı yerine bunu gösteriyor ki anında doğru
// kalsın. `useQuery` burada kullanılamazdı: gözlemci olarak sorguyu çekmeye
// başlatırdı, bütün amaç da açılışta listeleri çekmemek.
function useCachedListLength(queryKey: readonly unknown[]): number | null {
  const queryClient = useQueryClient();
  const subscribe = useCallback((cb: () => void) => queryClient.getQueryCache().subscribe(cb), [queryClient]);
  return useSyncExternalStore(subscribe, () => {
    const data = queryClient.getQueryData(queryKey);
    return Array.isArray(data) ? data.length : null;
  });
}

// Profil'in yatay sekme şeridi — sayaçlar ve aktif sekmeyi ortalama mantığı.
// Kendi profili ve başkasının profili AYNI şeridi kullanıyor.
//
// SAYAÇLAR: "sekme sayaçları tıklamadan dolmalı" daha önce bildirilmiş bir
// kullanıcı şikayeti. Eskiden dört liste açılışta TAMAMEN çekilerek
// sağlanıyordu (forum hiç sayılmıyordu); artık yedi sayı tek istekte sayım
// ucundan geliyor (bkz. `useProfileCounts`). Öncelik: önbellekteki liste
// uzunluğu > sayım ucu > gizli.
//
// Postlar ve Kayıtlı prop olarak geliyor: kendi profilinde onların sayacı
// sayfalama durum makinesinin `total`'ı (ProfileScreen'de yaşıyor).
function TabStrip({
  owner,
  countsUsername,
  tabs,
  activeTab,
  postsCount,
  savedCount,
  onTabPress,
  onHeightChange,
}: {
  owner: ProfileOwner;
  /** Sayım ucunun kullanıcı adı (kendi profilinde kendi adın). */
  countsUsername: string | undefined;
  /** Görünür sekmeler — başkasının gizlediği bölümler bu listede yok. */
  tabs: readonly TabDef[];
  activeTab: TabKey;
  postsCount: number | null;
  savedCount: number | null;
  onTabPress: (index: number) => void;
  onHeightChange: (height: number) => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { user } = useAuth();

  const { data: counts } = useProfileCounts(countsUsername);
  const cached = {
    lists: useCachedListLength(profileListKey(owner, 'lists')),
    akts: useCachedListLength(profileListKey(owner, 'akts')),
    schedule: useCachedListLength(profileListKey(owner, 'schedule')),
    follows: useCachedListLength(profileListKey(owner, 'follows')),
    forums: useCachedListLength(profileForumsKey(owner, user?.id)),
  };

  const countFor = (key: TabKey): number | null => {
    if (key === 'posts') return postsCount ?? counts?.posts ?? null;
    if (key === 'saved') return savedCount ?? counts?.saved ?? null;
    return cached[key] ?? counts?.[key] ?? null;
  };

  // --- Şeridi aktif sekmeye ortalama --------------------------------------
  // Eskiden şeridin ne `ref`'i ne `onLayout`'u ne de bir `scrollTo` çağrısı
  // vardı — sekmeler hiçbir zaman ortalanmıyordu, 5-7. sekmeler ekran dışında
  // kalıyordu ("tablar asla olması gereken yerde ortada render olmuyor").
  const stripRef = useRef<ScrollView>(null);
  const stripWidthRef = useRef(0);
  const stripContentWidthRef = useRef(0);
  const tabLayoutsRef = useRef<Partial<Record<TabKey, { x: number; width: number }>>>({});

  const centerStripOn = useCallback((key: TabKey) => {
    const item = tabLayoutsRef.current[key];
    const stripWidth = stripWidthRef.current;
    if (!item || stripWidth <= 0) return;
    const maxScroll = Math.max(0, stripContentWidthRef.current - stripWidth);
    const target = Math.min(Math.max(item.x + item.width / 2 - stripWidth / 2, 0), maxScroll);
    stripRef.current?.scrollTo({ x: target, animated: true });
  }, []);

  useEffect(() => {
    centerStripOn(activeTab);
  }, [activeTab, centerStripOn]);

  return (
    // Şerit bilinçli olarak kendi kutusunda: altında ince bir çizgi ve gölge
    // var ki profil kartından ayrı, kendi başına bir yapı olduğu görünsün
    // (kullanıcı isteği).
    <View
      onLayout={(e) => onHeightChange(e.nativeEvent.layout.height)}
      className="bg-surface rounded-lg mx-4 mb-5 border-b border-line-soft"
      style={SHADOW_MD}
    >
      <ScrollView
        ref={stripRef}
        showsVerticalScrollIndicator={false}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-3"
        onLayout={(e) => {
          stripWidthRef.current = e.nativeEvent.layout.width;
          centerStripOn(activeTab);
        }}
        onContentSizeChange={(w) => {
          stripContentWidthRef.current = w;
        }}
      >
        {tabs.map(({ key, label, icon: Icon }, index) => {
          // Sayaç ancak değer bilindiğinde gösteriliyor; aksi hâlde açılışta
          // hepsi yanıltıcı "(0)" görünürdü.
          const count = countFor(key);
          const active = activeTab === key;
          return (
            <Pressable
              key={key}
              className={`flex-row items-center gap-[5px] py-3 mr-[18px] border-b-2 ${active ? 'border-b-brand' : 'border-b-transparent'}`}
              onPress={() => onTabPress(index)}
              onLayout={(e) => {
                tabLayoutsRef.current[key] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
                if (active) centerStripOn(key);
              }}
            >
              {/* lucide ikonu ham renk alıyor (className değil) — marka rengi
                  temadan bağımsız, pasif gri de öyle. */}
              <Icon size={14} color={active ? (isDark ? '#5A9690' : '#2F5755') : '#9ca3af'} />
              <Text className={`text-[12.5px] font-semibold ${active ? 'text-accent' : 'text-muted2'}`}>
                {label}
                {count !== null ? ` (${count})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default React.memo(TabStrip);
