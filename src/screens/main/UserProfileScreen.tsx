import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, ShieldOff, User as UserIcon } from 'lucide-react-native';
import { avatarAPI, badgeAPI, moderationAPI, userAPI } from '../../lib/api';
import { emitBlockChanged } from '../../lib/moderationEvents';
import ModerationMenu from '../../components/moderation/ModerationMenu';
import BlockedMeTag from '../../components/moderation/BlockedMeTag';
import BlockedDeerCard, { type UnblockReason } from '../../components/moderation/BlockedDeerCard';
import { useTheme } from '../../context/ThemeContext';
import type { Badge } from '../../components/BadgeChip';
import type { AvatarData } from '../../components/avatar/AvatarDisplay';
import type { RootStackParamList } from '../../navigation/types';
import type { Post } from '../../types/post';
import StateView from '../../components/StateView';
import { useMetrics } from '../../theme/metrics';
import { TAB_BAR_SAFE_PADDING } from '../../components/layout/tabBarMetrics';
import ProfileSkeleton from '../../components/profile/ProfileSkeleton';
import { SHADOW_MD, TABS, type TabKey } from '../../components/profile/profileCommon';
import { PagerPlaceholder } from '../../components/profile/PagerPage';
import HeaderCard, { type ProfileIdentity } from '../../components/profile/HeaderCard';
import TabStrip from '../../components/profile/TabStrip';
import PostsTab from '../../components/profile/PostsTab';
import ChecklistsTab from '../../components/profile/ChecklistsTab';
import AktsTab from '../../components/profile/AktsTab';
import ScheduleTab from '../../components/profile/ScheduleTab';
import FollowsTab from '../../components/profile/FollowsTab';
import ForumsTab from '../../components/profile/ForumsTab';
import { useUserSavedPosts, type ProfileOwner } from '../../hooks/profile/useProfileLists';
import { useUserPostsPagination } from '../../hooks/profile/useUserPostsPagination';

// BAŞKASININ PROFİLİ — kendi profilinle (ProfileScreen.tsx) BİREBİR aynı ekran.
//
// Eskiden bu dosya 800 satırlık ayrı bir tasarımdı: farklı sekme adları
// ("Paylaştığı Notlar"), mavi şerit, düz dikey kaydırma, kendi kart/boş durum
// stilleri, 12'şerlik sayfa düğmeleri. Kullanıcı isteği: iki profil "kart, yazı,
// her detay" aynı olsun, yalnızca Düzenle hariç. Artık aynı bileşenler
// (HeaderCard, TabStrip, PostsTab, sekme bileşenleri, ProfileSkeleton) ve aynı
// kabuk (yatay pager + üstte kayan başlık + ±1 sayfa pencereleme) kullanılıyor;
// bileşenler `owner` üzerinden sahibe özel düğmeleri kendileri gizliyor.
//
// Kabuğun her kararının gerekçesi ProfileScreen.tsx'teki notlarda — buradaki
// kopya bilerek onunla aynı tutuluyor, birinde değişen diğerinde de değişmeli.

interface PublicProfile {
  id: number;
  username: string;
  full_name?: string;
  department?: string;
  faculty?: string;
  bio?: string;
  post_count?: number;
  is_public: boolean;
  profile_section_visibility?: Record<string, boolean>;
  /** İzleyen bu kullanıcıyı engellemiş mi (sunucu). */
  is_blocked_by_me?: boolean;
}

const DEFAULT_SECTION_VISIBILITY: Record<string, boolean> = {
  saved_posts: true,
  my_lists: true,
  akts: true,
  schedule: true,
  follows: true,
  forums: true,
  badges: true,
};

// Sekme → profil ayarındaki bölüm anahtarı. Postlar her zaman görünür.
const SECTION_KEY: Record<TabKey, string | null> = {
  posts: null,
  saved: 'saved_posts',
  lists: 'my_lists',
  akts: 'akts',
  schedule: 'schedule',
  follows: 'follows',
  forums: 'forums',
};

const NO_BADGES: Badge[] = [];
const NO_POSTS: Post[] = [];
const noop = () => {};

export default function UserProfileScreen() {
  const route = useRoute<any>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { username } = route.params as RootStackParamList['UserProfile'];
  const queryClient = useQueryClient();

  const { width: windowWidth, contentMaxWidth } = useMetrics();
  const screenWidth = Math.min(windowWidth, contentMaxWidth);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [badges, setBadges] = useState<Badge[]>(NO_BADGES);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [banned, setBanned] = useState(false);
  // Profil sahibi BENİ engelledi (sunucu 403 + code BLOCKED_BY_USER).
  const [blockedByThem, setBlockedByThem] = useState(false);
  // Sunucudan yanıt gelmeden başarısız olan istekler (zaman aşımı, bağlantı
  // kopması) eskiden de "Kullanıcı bulunamadı" gösteriyordu — yanıltıcıydı.
  // `err.response` yoksa bu bir ağ hatası, gerçek bir 404 değil.
  const [loadError, setLoadError] = useState(false);
  const [loadRetryTick, setLoadRetryTick] = useState(0);

  const [activeTab, setActiveTab] = useState<TabKey>('posts');
  const pagerRef = useRef<ScrollView>(null);

  const sectionVisibility = useMemo(
    () => ({ ...DEFAULT_SECTION_VISIBILITY, ...(profile?.profile_section_visibility || {}) }),
    [profile]
  );
  // Görünür sekmeler: başkasının gizlediği bölümün sekmesi hiç yok. Pager
  // indeksleri bu listeye göre.
  const visibleTabs = useMemo(
    () => TABS.filter((t) => SECTION_KEY[t.key] === null || sectionVisibility[SECTION_KEY[t.key]!]),
    [sectionVisibility]
  );
  const activeIndex = Math.max(
    0,
    visibleTabs.findIndex((t) => t.key === activeTab)
  );

  const [mountedTabs, setMountedTabs] = useState<TabKey[]>(['posts']);
  useEffect(() => {
    setMountedTabs((prev) => {
      const next = new Set(prev);
      for (let i = activeIndex - 1; i <= activeIndex + 1; i += 1) {
        const k = visibleTabs[i]?.key;
        if (k) next.add(k);
      }
      return next.size === prev.length ? prev : Array.from(next);
    });
  }, [activeIndex, visibleTabs]);
  const isTabMounted = useCallback((key: TabKey) => mountedTabs.includes(key), [mountedTabs]);

  // --- Kayan başlık (bkz. ProfileScreen.tsx) --------------------------------
  const scrollY = useSharedValue(0);
  const [cardHeight, setCardHeight] = useState(0);
  const cardHeightShared = useSharedValue(0);
  const [stripHeight, setStripHeight] = useState(0);
  const headerTotalHeight = cardHeight + stripHeight;
  const pageScrollOffsets = useRef<Record<TabKey, number>>({
    posts: 0,
    saved: 0,
    lists: 0,
    akts: 0,
    schedule: 0,
    follows: 0,
    forums: 0,
  });
  const rememberPageOffset = useCallback((key: TabKey, y: number) => {
    pageScrollOffsets.current[key] = y;
  }, []);
  useEffect(() => {
    scrollY.value = pageScrollOffsets.current[activeTab] ?? 0;
  }, [activeTab, scrollY]);
  const headerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(scrollY.value, cardHeightShared.value) }],
  }));
  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardHeightShared.value > 0 ? 1 - Math.min(scrollY.value, cardHeightShared.value * 0.7) / (cardHeightShared.value * 0.7) : 1,
  }));

  // --- Profil yüklemesi -----------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setBanned(false);
      setBlockedByThem(false);
      setLoadError(false);
      // Aynı ekran başka bir kullanıcı adıyla yeniden kullanılabiliyor
      // (navigate aynı rotaya parametre günceller) — sekme durumu sıfırlansın.
      setActiveTab('posts');
      setMountedTabs(['posts']);
      for (const k of Object.keys(pageScrollOffsets.current) as TabKey[]) pageScrollOffsets.current[k] = 0;
      scrollY.value = 0;
      pagerRef.current?.scrollTo({ x: 0, animated: false });
      try {
        const profileRes = await userAPI.getProfile(username);
        if (cancelled) return;
        const p: PublicProfile = profileRes.data.profile;
        const visibility = { ...DEFAULT_SECTION_VISIBILITY, ...(p.profile_section_visibility || {}) };
        const [avatarRes, badgeRes] = await Promise.all([
          avatarAPI.getByUserId(p.id).catch(() => ({ data: { avatar: null } })),
          visibility.badges
            ? badgeAPI.getByUser(p.id).catch(() => ({ data: { badges: [] } }))
            : Promise.resolve({ data: { badges: [] } }),
        ]);
        if (cancelled) return;
        setProfile(p);
        setAvatar(avatarRes.data?.avatar || null);
        setBadges(badgeRes.data?.badges || NO_BADGES);
      } catch (err: any) {
        if (cancelled) return;
        if (err.response?.data?.code === 'BLOCKED_BY_USER') setBlockedByThem(true);
        else if (err.response?.status === 403) setBanned(true);
        else if (!err.response) setLoadError(true);
        else setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username, loadRetryTick, scrollY]);

  const canViewContent = !!profile && profile.is_public !== false && !profile.is_blocked_by_me;

  // Kendi profilindeki `usePostsPagination` ile aynı çıktı şekli.
  const posts = useUserPostsPagination(username, canViewContent);
  const saved = useUserSavedPosts(
    username,
    canViewContent && sectionVisibility.saved_posts && isTabMounted('saved')
  );

  // Sekme bileşenleri `React.memo`'lu — `owner` referansı stabil kalmalı.
  const profileId = profile?.id;
  const profileUsername = profile?.username;
  const owner = useMemo<ProfileOwner | null>(
    () => (profileId != null && profileUsername ? { kind: 'user', username: profileUsername, userId: profileId } : null),
    [profileId, profileUsername]
  );

  const identity = useMemo<ProfileIdentity | null>(
    () =>
      profile
        ? {
            username: profile.username,
            full_name: profile.full_name,
            department: profile.department,
            faculty: profile.faculty,
            bio: profile.bio,
          }
        : null,
    [profile]
  );

  // `HeaderCard` memo'lu: satır içi JSX her render'da yeni referans olurdu.
  const isBlockedByMe = !!profile?.is_blocked_by_me;
  const nameAccessory = useMemo(
    () =>
      profileId != null && !isBlockedByMe ? (
        <ModerationMenu
          targetType="user"
          targetId={profileId}
          ownerId={profileId}
          ownerUsername={profileUsername}
          size={20}
          style={{ marginLeft: 'auto' }}
          onBlocked={() => setProfile((prev) => (prev ? { ...prev, is_blocked_by_me: true } : prev))}
        />
      ) : null,
    [profileId, profileUsername, isBlockedByMe]
  );
  const belowName = useMemo(
    () => (profileId != null ? <BlockedMeTag userId={profileId} style={{ marginTop: 4 }} /> : null),
    [profileId]
  );

  // TEK KARAR NOKTASI: parmak kalkıp sayfa hizaya oturunca (bkz. ProfileScreen).
  const handlePagerMomentumEnd = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (screenWidth <= 0) return;
      const key = visibleTabs[Math.round(nativeEvent.contentOffset.x / screenWidth)]?.key;
      if (key && key !== activeTab) setActiveTab(key);
    },
    [screenWidth, visibleTabs, activeTab]
  );

  const handleTabPress = useCallback(
    (index: number) => {
      const key = visibleTabs[index]?.key;
      if (!key) return;
      setActiveTab(key);
      pagerRef.current?.scrollTo({ x: index * screenWidth, animated: true });
    },
    [visibleTabs, screenWidth]
  );

  const handleUnblock = useCallback(
    async (reason: UnblockReason) => {
      if (profileId == null) return;
      try {
        await moderationAPI.unblock(profileId, reason);
        emitBlockChanged(profileId, false);
        queryClient.invalidateQueries();
        setProfile((prev) => (prev ? { ...prev, is_blocked_by_me: false } : prev));
      } catch {
        Alert.alert('Hata', 'Engel kaldırılamadı.');
      }
    },
    [profileId, queryClient]
  );

  if (loading || posts.firstLoading) {
    return <ProfileSkeleton own={false} />;
  }

  if (banned) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-8 bg-ground">
        <ShieldOff size={48} color="#f87171" />
        <Text className="text-[15px] font-semibold text-ink2 text-center">Profil görüntülemeniz admin tarafından yasaklanmıştır</Text>
      </View>
    );
  }

  if (blockedByThem) {
    return (
      <ScrollView className="flex-1 bg-ground" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <BlockedDeerCard mode="them" />
      </ScrollView>
    );
  }

  if (loadError) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-8 bg-ground">
        <StateView kind="error" title="Profil yüklenemedi." onAction={() => setLoadRetryTick((n) => n + 1)} />
      </View>
    );
  }

  if (notFound || !profile || !owner) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-8 bg-ground">
        <UserIcon size={48} color={isDark ? '#4b5563' : '#d1d5db'} />
        <Text className="text-[15px] font-semibold text-ink2 text-center">Kullanıcı bulunamadı</Text>
      </View>
    );
  }

  const headerCard = (
    <HeaderCard
      identity={identity}
      avatar={avatar}
      badges={badges}
      showBadges={sectionVisibility.badges}
      nameAccessory={nameAccessory}
      belowName={belowName}
    />
  );

  // Engellediğin ya da gizli profil: aynı başlık kartı, altında şerit/pager
  // yerine tek bir bilgi kartı.
  if (!canViewContent) {
    return (
      <ScrollView
        className="flex-1 bg-ground"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_SAFE_PADDING }}
      >
        {headerCard}
        <View className="mx-4">
          {profile.is_blocked_by_me ? (
            <BlockedDeerCard mode="me" onUnblock={handleUnblock} />
          ) : (
            <View className="items-center gap-2 py-8 px-[30px] bg-surface rounded-lg" style={SHADOW_MD}>
              <Lock size={40} color={isDark ? '#6b7280' : '#d1d5db'} />
              <Text className="text-[15px] text-ink2 font-semibold">Bu profil gizli.</Text>
              <Text className="text-muted2 text-[13.5px] text-center">
                Kullanıcı postlarını ve listelerini yalnızca kendisi görebilir.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  const tabProps = {
    owner,
    width: screenWidth,
    headerHeight: headerTotalHeight,
    scrollY,
    onRememberOffset: rememberPageOffset,
  };

  const renderPage = (key: TabKey) => {
    switch (key) {
      case 'posts':
        return (
          <PostsTab
            key={key}
            own={false}
            kind="posts"
            active={activeTab === 'posts'}
            {...tabProps}
            posts={posts.posts}
            rows={posts.rows}
            loadingMore={posts.loadingMore}
            loadMore={posts.loadMore}
            emptyText="Henüz onaylı not paylaşılmamış."
          />
        );
      case 'saved':
        return (
          <PostsTab
            key={key}
            own={false}
            kind="saved"
            active={activeTab === 'saved'}
            {...tabProps}
            posts={saved.data ?? NO_POSTS}
            rows={saved.data ?? null}
            loadingMore={false}
            loadMore={noop}
            emptyText="Henüz not kaydetmemiş."
          />
        );
    }
    if (!isTabMounted(key)) return <PagerPlaceholder key={key} width={screenWidth} />;
    switch (key) {
      case 'lists':
        return <ChecklistsTab key={key} active={activeTab === key} {...tabProps} />;
      case 'akts':
        return <AktsTab key={key} active={activeTab === key} {...tabProps} />;
      case 'schedule':
        return <ScheduleTab key={key} active={activeTab === key} {...tabProps} />;
      case 'follows':
        return <FollowsTab key={key} active={activeTab === key} {...tabProps} />;
      case 'forums':
        return <ForumsTab key={key} active={activeTab === key} {...tabProps} />;
    }
  };

  return (
    <View className="flex-1 bg-ground">
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handlePagerMomentumEnd}
        style={{ flex: 1 }}
      >
        {visibleTabs.map(({ key }) => renderPage(key))}
      </ScrollView>

      {/* Başlık katmanı — bkz. ProfileScreen.tsx (`collapsable={false}` ve
          iç içe iki Animated.View'in gerekçesi orada). */}
      <Animated.View
        pointerEvents="box-none"
        collapsable={false}
        style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, headerAnimStyle]}
      >
        <Animated.View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setCardHeight(h);
            cardHeightShared.value = h;
          }}
          style={cardAnimStyle}
        >
          {headerCard}
        </Animated.View>

        <TabStrip
          owner={owner}
          countsUsername={profile.username}
          tabs={visibleTabs}
          activeTab={activeTab}
          // Notlar: sayfalamanın toplamı, gelmeden profildeki sayı.
          postsCount={posts.total ?? profile.post_count ?? null}
          savedCount={saved.data ? saved.data.length : null}
          onTabPress={handleTabPress}
          onHeightChange={setStripHeight}
        />
      </Animated.View>
    </View>
  );
}
