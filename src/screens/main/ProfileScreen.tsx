import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { avatarAPI, badgeAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useSavedPosts } from '../../context/SavedPostContext';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';
import { type Badge } from '../../components/BadgeChip';
import ProfileEditModal from '../../components/profile/ProfileEditModal';
import DeleteAccountModal from '../../components/profile/DeleteAccountModal';
import AvatarBuilderScreen from './AvatarBuilderScreen';
import { MY_AVATAR_KEY, useInvalidateMyAvatar, useMyAvatar } from '../../hooks/useMyAvatar';
import type { AvatarData } from '../../components/avatar/AvatarDisplay';
import type { MainTabParamList } from '../../navigation/types';
import { useMetrics } from '../../theme/metrics';
import ProfileSkeleton from '../../components/profile/ProfileSkeleton';
import { TABS, type TabKey } from '../../components/profile/profileCommon';
import { PagerPlaceholder } from '../../components/profile/PagerPage';
import HeaderCard from '../../components/profile/HeaderCard';
import TabStrip from '../../components/profile/TabStrip';
import PostsTab from '../../components/profile/PostsTab';
import ChecklistsTab from '../../components/profile/ChecklistsTab';
import AktsTab from '../../components/profile/AktsTab';
import ScheduleTab from '../../components/profile/ScheduleTab';
import FollowsTab from '../../components/profile/FollowsTab';
import ForumsTab from '../../components/profile/ForumsTab';
import { MY_BADGES_KEY, useMyBadges } from '../../hooks/profile/useProfileLists';
import { usePostsPagination } from '../../hooks/profile/usePostsPagination';

// `useMyBadges()` henüz veri döndürmediğinde `HeaderCard`'a (memo'lu) her
// render'da yeni bir `[]` gitmesin.
const NO_BADGES: Badge[] = [];

export default function ProfileScreen() {
  const route = useRoute<RouteProp<MainTabParamList, 'Profile'>>();
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  const { savedPosts } = useSavedPosts();

  const [activeTab, setActiveTab] = useState<TabKey>(route.params?.initialTab ?? 'posts');
  // Sekmeler artık yatay kaydırmalı bir "pager" (bkz. render) — sekme
  // butonuna basınca ya da kaydırma bitince ikisi birbirini senkron tutuyor.
  const pagerRef = useRef<ScrollView>(null);
  // Pager gerçekte ContentContainer'ın (bkz. src/theme/metrics.ts) sınırladığı
  // `contentMaxWidth` genişliğinde render ediliyor, tam ekran genişliğinde
  // değil — tablette bu ikisi (screenWidth vs. gerçek pager genişliği)
  // birbirinden ayrışınca sekmeler arası kayma/flash oluyordu.
  const { width: windowWidth, contentMaxWidth } = useMetrics();
  const screenWidth = Math.min(windowWidth, contentMaxWidth);

  // İki gönderi sekmesinin sayfalama durum makinesi — sayfalama, odak
  // tazelemesi, silmede sayaç düşürme, "Kayıtlı"nın sentinel'i. Hepsi
  // hooks/profile/usePostsPagination.ts'te (ProfileScreen'den birebir taşındı).
  // Sayaçlar `TabStrip`'e prop olarak indiği için burada okunuyorlar.
  const myPosts = usePostsPagination('posts', activeTab === 'posts');
  const savedPostsState = usePostsPagination('saved', activeTab === 'saved');

  // İnternet hızlıysa (veri 200ms'den önce gelirse) iskelet HİÇ görünmüyor.
  // bkz. useDelayedLoading.ts. Ekranın ilk karesini YALNIZCA kendi
  // gönderilerin belirliyor — kalan her şey kendi başına yükleniyor.
  const loading = useDelayedLoading(myPosts.firstLoading);

  // Dört listenin verisi de rozetler de artık BU BİLEŞENDE DEĞİL; hepsi
  // react-query anahtarları üzerinden (bkz. hooks/profile/useProfileLists.ts).
  // Sayaçları `TabStrip`, listeyi ilgili sekme okuyor — aynı anahtar olduğu
  // için ikinci bir ağ isteği atılmıyor ve "sayaçlar tıklamadan dolmalı"
  // kuralı korunuyor.
  //
  // Rozetler burada da okunuyor çünkü `ProfileEditModal`'ı bu ekran render
  // ediyor (rozet görünürlüğü oradan değiştiriliyor); `HeaderCard`'a prop
  // olarak iniyor.
  const { data: badges = NO_BADGES } = useMyBadges();

  // Avatar artık burada ayrıca çekilmiyor: üst bar ve tab bar ile aynı
  // react-query anahtarını (`MY_AVATAR_KEY`, bkz. hooks/useMyAvatar.ts)
  // paylaşıyor — böylece açılışta tek bir `avatarAPI.get()` isteği kalıyor.
  const avatar = useMyAvatar();
  const queryClient = useQueryClient();
  // Avatar değişince üst bar ve tab bar da tazelensin.
  const invalidateMyAvatar = useInvalidateMyAvatar();
  const [photoUploading, setPhotoUploading] = useState(false);

  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Profil artık kalıcı mount'lu bir SEKME (bkz. MainTabsScreen.tsx) — bu
  // yüzden `initialTab` yalnızca useState'in başlangıç değeri olarak okunamaz:
  // menüdeki "Notlarım" / "Kaydettiğim Notlarım" kısayolları ikinci kez
  // basıldığında da doğru sekmeyi açsın diye parametre değiştikçe uygulanıyor.
  const initialTabParam = route.params?.initialTab;
  useEffect(() => {
    if (!initialTabParam) return;
    setActiveTab(initialTabParam);
    const idx = TABS.findIndex((t) => t.key === initialTabParam);
    if (idx >= 0) pagerRef.current?.scrollTo({ x: idx * screenWidth, animated: false });
  }, [initialTabParam, screenWidth]);

  // --- Odak tazelemesi -----------------------------------------------------
  // Profil kalıcı mount'lu olduğu için bir gönderiye girip yorum ekleyip
  // dönmek listeyi tazelemiyordu (kullanıcı bildirdi). Aktif gönderi sekmesi
  // her odakta sessizce 1. sayfasını çekip eldeki listeye işliyor.
  //
  // "İlk odakta atla" bayrağı BİLEREK burada, iki sekmenin ORTAK'ı: her
  // sekmeye ayrı bayrak verilseydi, ilk kez "Kayıtlı"ya geçmek tazelemeyi
  // atlardı — eski davranışta atlamıyordu.
  const didFocusOnceRef = useRef(false);
  const refreshMyPosts = myPosts.refreshFirstPage;
  const refreshSavedPosts = savedPostsState.refreshFirstPage;
  useFocusEffect(
    useCallback(() => {
      if (!didFocusOnceRef.current) {
        didFocusOnceRef.current = true;
        return;
      }
      if (activeTab === 'posts') return refreshMyPosts();
      if (activeTab === 'saved') return refreshSavedPosts();
    }, [activeTab, refreshMyPosts, refreshSavedPosts])
  );

  // ⚠️ SÜRÜKLEME SIRASINDA SAYFA ARTIK DEĞİŞMİYOR — `onScroll` dinleyicisi
  // tamamen kaldırıldı. Bir daha "şerit parmağı takip etsin" diye geri ekleme.
  //
  // Eskiden 32 ms throttle'lı bir `onScroll` vardı ve `Math.round` ile sayfayı
  // sürükleme YARIYA gelince değiştiriyordu. Görünürde masum bir önizlemeydi;
  // gerçekte her sekmenin içeriği `active` prop'unu RENDER KAPISI olarak
  // kullanıyor (`PostsTab.tsx` `data={active ? posts : NO_POSTS}`, diğerleri
  // `{active && ...}`), yani `activeTab` değiştiği an eski sayfanın tüm alt
  // ağacı UNMOUNT ediliyor ve yeninin ağacı sıfırdan kuruluyor. Postlar/Kayıtlı
  // sekmelerinde bu ~25-30 `PostCardModern`, her birinde ~25-40 düğümlük bir
  // `AvatarSVG` demek: kabaca 850 native SVG view + 220 metin ölçümü, hepsi
  // JEST SÜRERKEN. Üstüne `onMomentumScrollEnd` ikinci bir flip yapabildiği
  // için tek kaydırma iki tam yıkım/kurulum turu üretiyordu.
  //
  // Teşhis rozeti bunu ölçtü: 61 saniyelik pencerede Profile 24 blokaj /
  // 16.925 ms — tüm blokajların %64'ü. Blokajların 28 saniyeye yığılıp sonra
  // 16 saniye hiç görünmemesi periyodik bir sebebi eliyor: iş etkileşime bağlı.
  //
  // Projede aynı mekanizma navigator seviyesinde zaten kapatılmış
  // (`MainTabsScreen.tsx` `detachInactiveScreens={false}`, notu "yavaşlık
  // sekmeye ilk gidişte değil HER gidişte"). Pager bunu elle yeniden yapıyordu.
  //
  // Kaybedilen: sürüklerken şerit vurgusu parmağı takip etmiyor, bırakınca
  // yerine oturuyor. Kazanılan: rebuild jestin dışına çıktı ve sayısı yarıya
  // indi. `active` kapısının kendisi hâlâ duruyor — o bir sonraki tek değişken.
  //
  // (Tarihsel not: `contentOffset` prop'u da eskiden her render'da canlı
  // yazılıyordu ve o `onScroll` ara bir indeksi yuvarlayınca animasyonu BİR
  // SAYFA ERKEN durduruyordu — "neye tıkladıysam bir sağına gidiyor" şikâyeti.
  // O prop kaldırıldı ve öyle kalmalı; kesin sayfa `onMomentumScrollEnd`'den
  // geliyor. `onScroll` gittiği için o hatanın ikinci yarısı da artık imkânsız
  // ve onu bastırmak için tutulan `isProgrammaticScrollRef` kilidi de
  // gereksizleşip kaldırıldı.)

  // Kaydırma bittiğinde (elle sürükleyip bırakınca DA, `pagingEnabled`
  // sayfayı kendi kendine hizaya oturttuğunda DA) gerçek sayfa burada kesin
  // olarak belirleniyor — hiçbir sayfa boş/yanlış sekmede takılı kalmıyor.
  // ARTIK TEK KARAR NOKTASI BURASI.
  const handlePagerMomentumEnd = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (screenWidth <= 0) return;
      const idx = Math.round(nativeEvent.contentOffset.x / screenWidth);
      const key = TABS[idx]?.key;
      if (key && key !== activeTab) setActiveTab(key);
    },
    [screenWidth, activeTab]
  );

  const handleTabPress = useCallback(
    (index: number) => {
      // Şeride dokunmak tek karar noktası olan `onMomentumScrollEnd`'i
      // beklemiyor: hedef zaten kesin, hemen yazılıyor. (Eskiden burada bir
      // `isProgrammaticScrollRef` kilidi vardı; onu okuyan `onScroll`
      // dinleyicisi kaldırıldığı için gereksizleşti — bkz. yukarıdaki not.)
      setActiveTab(TABS[index].key);
      pagerRef.current?.scrollTo({ x: index * screenWidth, animated: true });
    },
    [screenWidth]
  );

  // Şeridin kendi ölçüm/ortalama mantığı artık `TabStrip`'in içinde — dört
  // `ref` ve bir effect daha bu bileşenden çıktı.

  const handleToggleBadgeVisibility = useCallback(
    async (badge: Badge) => {
      const nextVisible = !(badge.is_visible !== false);
      // En az bir rozet görünür kalmalı — sayım her çağrıda taze cache'ten.
      if (!nextVisible && badges.filter((b) => b.is_visible !== false).length <= 1) {
        Alert.alert('Uyarı', 'En az bir rozet görünür kalmalı.');
        return;
      }
      try {
        await badgeAPI.setVisibility(badge.id, nextVisible);
        queryClient.setQueryData<Badge[]>(MY_BADGES_KEY, (prev) =>
          prev?.map((b) => (b.id === badge.id ? { ...b, is_visible: nextVisible } : b))
        );
      } catch (err: any) {
        Alert.alert('Hata', err.response?.data?.message || 'Rozet görünürlüğü güncellenemedi.');
      }
    },
    [badges, queryClient]
  );

  // `HeaderCard` memo'lu: satır içi ok fonksiyonu verseydik her render'da yeni
  // referans olur, memo hiçbir zaman bail-out yapamazdı.
  const openAvatarBuilder = useCallback(() => setShowAvatarBuilder(true), []);
  const openEditModal = useCallback(() => setShowEditModal(true), []);

  const handlePickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin gerekli', 'Fotoğraf seçmek için galeri izni vermelisiniz.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotoUploading(true);
    try {
      const res = await avatarAPI.uploadPhoto({
        uri: asset.uri,
        name: asset.fileName || 'photo.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      // Yanıttaki avatarı önbelleğe doğrudan yazıyoruz ki bu ekran, üst bar ve
      // tab bar ağ turunu beklemeden anında güncellensin; ardından gelen
      // invalidate sunucudaki son hâlle senkronu garantiliyor.
      queryClient.setQueryData(MY_AVATAR_KEY, (res.data.avatar as AvatarData | null) ?? null);
      invalidateMyAvatar();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error || 'Fotoğraf yüklenemedi.');
    } finally {
      setPhotoUploading(false);
    }
  }, [invalidateMyAvatar, queryClient]);

  // --- Kayan (collapsing) profil başlığı -----------------------------------
  // Eskiden profil kartı + sekme şeridi pager'ın DIŞINDA, sabit duruyordu —
  // "aşağı kaydırdıkça profil kısmı sabit kalmamalı, kaymalı, en üstte tablar
  // kalacak kadar yok olabilmeli" şikâyeti buydu. Artık kart ölçülüp
  // (`cardHeight`) sayfa içeriği o kadar boşlukla başlıyor; kart+şerit,
  // sayfanın ÜSTÜNDE mutlak konumlu bir katman olarak `scrollY` kadar yukarı
  // kayıyor. Sayfanın kendi native kaydırması içeriği zaten normal şekilde
  // yukarı taşıdığı için (paddingTop sabit kalıyor), üstteki katman sadece
  // "kart kadar" yukarı gidip duruyor — şerit böylece ekranın en üstünde
  // yapışık kalıyor, kart tamamen kayboluyor.
  const scrollY = useSharedValue(0);
  const [cardHeight, setCardHeight] = useState(0);
  const cardHeightShared = useSharedValue(0);
  const [stripHeight, setStripHeight] = useState(0);
  const headerTotalHeight = cardHeight + stripHeight;
  // Her sekmenin KENDİ dikey kaydırma konumu — sekme değiştirince (bkz. aşağı)
  // `scrollY` o sekmenin son bilinen konumuna senkronlanıyor; aksi hâlde
  // başlık, önceki sekmede nerede kalmışsa orada donuk kalırdı.
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
    scrollY.value = withTiming(pageScrollOffsets.current[activeTab] ?? 0, { duration: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const headerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(scrollY.value, cardHeightShared.value) }],
  }));
  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardHeightShared.value > 0 ? 1 - Math.min(scrollY.value, cardHeightShared.value * 0.7) / (cardHeightShared.value * 0.7) : 1,
  }));

  // SAYFA PENCERELEME.
  //
  // Pager yatay bir ScrollView ve yedi sayfasının YEDİSİ de mount'luydu: yedi
  // native scroll view + yedi Reanimated scroll worklet, profil ekranda olmasa
  // bile ayakta. Testçilerin "profilde daha çok donuyor" demesinin payı buydu.
  //
  // Artık yalnızca aktif sekme ve İKİ KOMŞUSU gerçek scroll view olarak
  // mount'lu; geri kalanlar yerlerinde `screenWidth` genişliğinde boş bir View
  // tutuyor (pager'ın geometrisi bozulmasın, `scrollTo(idx * screenWidth)`
  // çalışmaya devam etsin diye).
  //
  // ±1 penceresi kasıtlı VE ARTIK DAHA DA ÖNEMLİ: sürükleme sırasındaki sayfa
  // değişimi kaldırıldığı için (bkz. yukarıdaki not) `activeTab` ancak parmak
  // kalkınca güncelleniyor. Komşuların önceden mount'lu olması bu yüzden şart —
  // olmasaydı parmakla kaydırırken yandaki sayfa boş görünürdü.
  //
  // Bir kez mount olan sayfa mount'lu KALIYOR: kaydırma konumu (bkz.
  // `pageScrollOffsets`) ve yüklenmiş verisi korunsun diye.
  //
  // İlk iki sayfa (Postlar, Kayıtlı) bu listede yok — indeksleri 0 ve 1,
  // varsayılan sekme de Postlar olduğu için pencere zaten ikisini de kapsıyor;
  // koşula sokmak sadece gereksiz dallanma olurdu.
  const activeIndex = TABS.findIndex((t) => t.key === activeTab);
  const [mountedTabs, setMountedTabs] = useState<TabKey[]>(() => ['posts', 'saved']);
  useEffect(() => {
    setMountedTabs((prev) => {
      const next = new Set(prev);
      for (let i = activeIndex - 1; i <= activeIndex + 1; i += 1) {
        const k = TABS[i]?.key;
        if (k) next.add(k);
      }
      // Referansı boşuna değiştirme: her kaydırmada yeni dizi = gereksiz render.
      return next.size === prev.length ? prev : Array.from(next);
    });
  }, [activeIndex]);
  const isTabMounted = useCallback((key: TabKey) => mountedTabs.includes(key), [mountedTabs]);

  if (loading) {
    return <ProfileSkeleton />;
  }

  // Sekme bileşenlerinin ortak prop kümesi. Hepsi stabil referans olduğu için
  // `React.memo` iş görüyor: bu ekranda bir modal açılması ya da bir sayacın
  // değişmesi o ağaçlara HİÇ girmiyor.
  //
  // `headerHeight`: sayfa içeriği başlık kadar boşlukla başlıyor (kart + şerit
  // pager'ın ÜSTÜNDE mutlak konumlu duruyor).
  const tabProps = {
    width: screenWidth,
    headerHeight: headerTotalHeight,
    scrollY,
    onRememberOffset: rememberPageOffset,
  };

  return (
    <View className="flex-1 bg-ground">
      {/* Pager ÖNCE render ediliyor: başlık katmanı ondan SONRA gelip üstüne
          mutlak konumla biniyor (bkz. aşağı), böylece pager'ın kaydırması
          başlığın altından "akıyor" gibi görünüyor. Her sayfanın üst dolgusu
          (`paddingTop: headerTotalHeight`) sabit — sayfa kendi native
          kaydırmasıyla zaten yukarı akıyor, üstteki katman sadece kart kadar
          (`cardHeight`) yukarı giderek onunla aynı hizada kalıyor; kart
          tamamını kat ettikten sonra şerit ekranın en üstünde sabitleniyor. */}
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handlePagerMomentumEnd}
        style={{ flex: 1 }}
      >
        <PostsTab
          kind="posts"
          active={activeTab === 'posts'}
          {...tabProps}
          posts={myPosts.posts}
          rows={myPosts.rows}
          loadingMore={myPosts.loadingMore}
          loadMore={myPosts.loadMore}
          onDelete={myPosts.handleDelete}
          emptyText="Henüz not paylaşmadınız."
        />

        <PostsTab
          kind="saved"
          active={activeTab === 'saved'}
          {...tabProps}
          posts={savedPostsState.posts}
          rows={savedPostsState.rows}
          loadingMore={savedPostsState.loadingMore}
          loadMore={savedPostsState.loadMore}
          onDelete={savedPostsState.handleDelete}
          emptyText="Henüz not kaydetmediniz."
        />

        {isTabMounted('lists') ? (
          <ChecklistsTab active={activeTab === 'lists'} {...tabProps} />
        ) : (
          <PagerPlaceholder width={screenWidth} />
        )}

        {isTabMounted('akts') ? (
          <AktsTab active={activeTab === 'akts'} {...tabProps} />
        ) : (
          <PagerPlaceholder width={screenWidth} />
        )}

        {isTabMounted('schedule') ? (
          <ScheduleTab active={activeTab === 'schedule'} {...tabProps} />
        ) : (
          <PagerPlaceholder width={screenWidth} />
        )}

        {isTabMounted('follows') ? (
          <FollowsTab active={activeTab === 'follows'} {...tabProps} />
        ) : (
          <PagerPlaceholder width={screenWidth} />
        )}

        {isTabMounted('forums') ? (
          <ForumsTab active={activeTab === 'forums'} {...tabProps} />
        ) : (
          <PagerPlaceholder width={screenWidth} />
        )}
      </ScrollView>

      {/* Başlık katmanı: pager'ın ÜSTÜNDE mutlak konumlu. Kart, `cardAnimStyle`
          ile hem kayıyor hem soluyor; şerit hep tam opak ve `headerAnimStyle`
          ile kartla birlikte yukarı gidip kartın yüksekliğinde duruyor —
          böylece ekranın en üstünde "yapışmış" gibi kalıyor. */}
      {/* `collapsable={false}`: bu da arka planı olmayan, yalnızca
          konumlandırma taşıyan bir `box-none` sarmalayıcı — Android'de
          düzleştirilip dokunuş yönlendirmesini kaybedebilir (ayrıntılı
          gerekçe WaveTabBar.tsx'te). Savunma amaçlı. */}
      <Animated.View
        pointerEvents="box-none"
        collapsable={false}
        style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, headerAnimStyle]}
      >
        {/* NativeWind'in `className` derleme dönüşümü yalnızca 'react-native'den
            doğrudan import edilen bileşenleri (View, ScrollView, ...) tanıyor —
            `Animated.View` (reanimated) bu listede değil, üzerine className
            koymak sessizce hiçbir şey yapmaz. Bu yüzden görsel sınıflar (arka
            plan/dolgu/köşe) düz bir `View`de kalıyor; `Animated.View` yalnızca
            saydamlık/kayma animasyonunu taşıyor. */}
        <Animated.View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setCardHeight(h);
            cardHeightShared.value = h;
          }}
          style={cardAnimStyle}
        >
          <HeaderCard
            avatar={avatar}
            badges={badges}
            photoUploading={photoUploading}
            onPickPhoto={handlePickPhoto}
            onOpenAvatarBuilder={openAvatarBuilder}
            onOpenEdit={openEditModal}
          />
        </Animated.View>

        <TabStrip
          activeTab={activeTab}
          // Sayaç "ekranda kaç satır var" değil, sunucudaki TOPLAM.
          // "Kayıtlı"nın yedeği context'in id kümesi: sunucu toplamı sentinel'e
          // çekildiğinde (bir not kaydedilip çıkarıldığında) sayaç anında
          // doğru değere düşsün diye (bkz. usePostsPagination.ts).
          postsCount={myPosts.total ?? myPosts.posts.length}
          savedCount={savedPostsState.total ?? savedPosts.length}
          onTabPress={handleTabPress}
          onHeightChange={setStripHeight}
        />
      </Animated.View>

      {/* Checklist istatistik/düzenleme modalları artık ChecklistsTab'ın
          içinde: onları açan state de orada yaşıyor, bir kartı açmak bu ekrana
          hiç ulaşmıyor. */}
      {showEditModal && (
        <ProfileEditModal
          badges={badges}
          onToggleBadgeVisibility={handleToggleBadgeVisibility}
          onClose={() => setShowEditModal(false)}
          onDeleteAccountRequest={() => setShowDeleteModal(true)}
        />
      )}
      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}

      <Modal visible={showAvatarBuilder} animationType="slide" onRequestClose={() => setShowAvatarBuilder(false)}>
        {/* RN'in `Modal`ı iOS'ta içeriğini AYRI bir native pencerede sunuyor —
            uygulama kökündeki `SafeAreaProvider` (App.tsx) o pencere için insets'i
            (özellikle notch/Dynamic Island'ın üst boşluğu) doğru ölçemiyor,
            AvatarBuilderScreen içindeki `SafeAreaView edges={['top']}` bu yüzden
            iOS'ta 0'a yakın bir üst boşlukla çiziyordu ("avatar çok üstte
            kalıyor"). Modal'ın kendi `SafeAreaProvider`'ı içeride yeniden
            ölçüm yaptırıyor — bilinen bir react-native-safe-area-context deseni. */}
        <SafeAreaProvider>
          <AvatarBuilderScreen
            initialConfig={avatar?.config || {}}
            isStaff={isStaff}
            onClose={() => setShowAvatarBuilder(false)}
            onSaved={(newCfg) => {
              queryClient.setQueryData(MY_AVATAR_KEY, (prev: AvatarData | null | undefined) => ({
                ...(prev || {}),
                config: newCfg,
              }));
              invalidateMyAvatar();
            }}
          />
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}
