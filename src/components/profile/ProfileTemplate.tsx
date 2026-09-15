import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { useSavedPosts } from '../../context/SavedPostContext';
import { useMetrics } from '../../theme/metrics';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';
import { useProfileCounts } from '../../hooks/profile/useProfileLists';
import { usePostsPagination } from '../../hooks/profile/usePostsPagination';
import ProfileSkeleton from './ProfileSkeleton';
import { PagerPlaceholder } from './PagerPage';
import { ProfileScopeProvider, type ProfileScopeValue } from './ProfileScope';
import TabStrip, { type TabCounts } from './TabStrip';
import PostsTab from './PostsTab';
import ChecklistsTab from './ChecklistsTab';
import AktsTab from './AktsTab';
import ScheduleTab from './ScheduleTab';
import FollowsTab from './FollowsTab';
import ForumsTab from './ForumsTab';
import type { TabDef, TabKey } from './profileCommon';

// PROFİL SAYFASININ TEK ŞABLONU — pager, çöken başlık, sekme şeridi, iskelet.
//
// Bu gövde `ProfileScreen`'den taşındı ve artık `UserProfileScreen` de aynı
// şablonu basıyor. Testçi şikâyeti birebir şuydu: "başka bir kullanıcı profili
// görüntülendiği zaman tablardaki renkler, loading vs. kendi profilini
// görüntülediğin gibi olmalı, profil için tek şablon olmalı." İki ekran
// yıllardır ayrı ayrı yazıldığı için renk (lacivert vs. marka teal), yükleme
// (spinner vs. iskelet) ve sayfalama (ok düğmeleri vs. sonsuz kaydırma)
// birbirinden ayrışmıştı; bu dosya o ayrışmanın yapısal sebebini kaldırıyor.
//
// Mod farkları YALNIZCA üç yerde: etiketler (`tabs`, bkz. profileCommon
// `makeTabs`), yazma yetkisi (`scope.readOnly`, sekmeler context'ten okuyor) ve
// veri kaynağı (`scope.username`, hook'lar parametrik). Düzen, renk, animasyon
// ve yükleme davranışı ORTAK — yani bir daha ayrışamaz.

/** Başlık kartının `React.ReactNode` olarak geçmesi bilinçli. Alternatif
 *  (`identity`/`avatar`/`badges`/`editable` + dört callback'i prop olarak
 *  indirmek) hem sekiz prop daha getirirdi hem de memo'yu ZAYIFLATIRDI: her
 *  ekran kartını kendi kurunca, şablonun kendi state'i (ör. `activeTab`)
 *  değiştiğinde `header` AYNI element nesnesi kalıyor ve React memo'ya bile
 *  girmeden bail-out ediyor. */
export interface ProfileTemplateProps {
  scope: ProfileScopeValue;
  /** Görünür sekmeler, sırayla. STABİL referans olmak zorunda (bkz.
   *  profileCommon `makeTabs`/`visibleTabs`). */
  tabs: readonly TabDef[];
  header: React.ReactNode;
  /** Dışarıdan istenen sekme (menü kısayolları). Değiştikçe uygulanıyor. */
  requestedTab?: TabKey;
}

export default function ProfileTemplate({ scope, tabs, header, requestedTab }: ProfileTemplateProps) {
  const { mode, username, readOnly } = scope;
  const isMe = mode === 'me';

  const [activeTab, setActiveTab] = useState<TabKey>(requestedTab ?? tabs[0]?.key ?? 'posts');
  // Sekmeler yatay kaydırmalı bir "pager" (bkz. render) — sekme butonuna
  // basınca ya da kaydırma bitince ikisi birbirini senkron tutuyor.
  const pagerRef = useRef<ScrollView>(null);
  // Pager gerçekte ContentContainer'ın (bkz. src/theme/metrics.ts) sınırladığı
  // `contentMaxWidth` genişliğinde render ediliyor, tam ekran genişliğinde
  // değil — tablette bu ikisi (screenWidth vs. gerçek pager genişliği)
  // birbirinden ayrışınca sekmeler arası kayma/flash oluyordu.
  const { width: windowWidth, contentMaxWidth } = useMetrics();
  const screenWidth = Math.min(windowWidth, contentMaxWidth);

  // "Kayıtlı" sekmesi profil sahibi tarafından gizlenmiş olabilir; o zaman
  // sorgusu HİÇ atılmıyor (hook'un `enabled` kapısı). "Postlar" her zaman
  // görünür (`sectionKey: null`), yani oradaki kapı daima açık — iskeleti o
  // hook'un `firstLoading`'i sürüyor.
  const savedVisible = useMemo(() => tabs.some((t) => t.key === 'saved'), [tabs]);

  // İki gönderi sekmesinin sayfalama durum makinesi — sayfalama, odak
  // tazelemesi, silmede sayaç düşürme, "Kayıtlı"nın sentinel'i. Hepsi
  // hooks/profile/usePostsPagination.ts'te. Sayaçlar `TabStrip`'e prop olarak
  // indiği için toplamlar burada okunuyor.
  const myPosts = usePostsPagination('posts', activeTab === 'posts', username);
  const savedPostsState = usePostsPagination('saved', activeTab === 'saved', username, savedVisible);

  // İnternet hızlıysa (veri 200ms'den önce gelirse) iskelet HİÇ görünmüyor.
  // bkz. useDelayedLoading.ts. Ekranın ilk karesini YALNIZCA gönderi listesi
  // belirliyor — kalan her şey kendi başına yükleniyor.
  const loading = useDelayedLoading(myPosts.firstLoading);

  // Sekme sayaçları. `enabled: isMe` — başkasının profilinde sayaç
  // gösterilmiyor (bugünkü davranış), dolayısıyla dört sorgu da atılmıyor.
  // "Sayaçlar tıklamadan dolmalı" değişmezi korunuyor: bu hook sekmelerle AYNI
  // react-query anahtarlarını okuyor, ikinci ağ isteği yok.
  const listCounts = useProfileCounts(isMe);
  const postsCount = myPosts.total ?? myPosts.posts.length;
  // "Kayıtlı" sayacının yedeği BİLEREK context'in id kümesi, ekrandaki satır
  // sayısı DEĞİL: bir not kaydedilip çıkarıldığında `usePostsPagination`
  // toplamı sentinel'e (`null`) çekiyor ve sayaç o an context'e düşüp doğru
  // değeri gösteriyor (belgelenmiş `??`-vs-0 hatası, bkz. usePostsPagination.ts).
  // Yedek yalnızca kendi profilinde geçerli — context oturum sahibinin kayıtlı
  // id'lerini tutuyor, başkasının listesini anlatmıyor.
  const { savedPosts: ownSavedIds } = useSavedPosts();
  const savedCount = savedPostsState.total ?? (isMe ? ownSavedIds.length : savedPostsState.posts.length);
  // `useMemo` ŞART: `TabStrip` memo'lu.
  const counts = useMemo<TabCounts | undefined>(
    () =>
      isMe
        ? {
            posts: postsCount,
            saved: savedCount,
            lists: listCounts.lists,
            akts: listCounts.akts,
            schedule: listCounts.schedule,
            follows: listCounts.follows,
          }
        : undefined,
    [isMe, postsCount, savedCount, listCounts]
  );

  // Profil kendi profilinde kalıcı mount'lu bir SEKME (bkz. MainTabsScreen.tsx)
  // — bu yüzden `requestedTab` yalnızca useState'in başlangıç değeri olarak
  // okunamaz: menüdeki "Notlarım" / "Kaydettiğim Notlarım" kısayolları ikinci
  // kez basıldığında da doğru sekmeyi açsın diye parametre değiştikçe
  // uygulanıyor.
  useEffect(() => {
    if (!requestedTab) return;
    setActiveTab(requestedTab);
    const idx = tabs.findIndex((t) => t.key === requestedTab);
    if (idx >= 0) pagerRef.current?.scrollTo({ x: idx * screenWidth, animated: false });
  }, [requestedTab, screenWidth, tabs]);

  // --- Odak tazelemesi -----------------------------------------------------
  // Bir gönderiye girip yorum ekleyip dönmek listeyi tazelemiyordu (kullanıcı
  // bildirdi). Aktif gönderi sekmesi her odakta sessizce 1. sayfasını çekip
  // eldeki listeye işliyor.
  //
  // "İlk odakta atla" bayrağı BİLEREK iki sekmenin ORTAK'ı: her sekmeye ayrı
  // bayrak verilseydi, ilk kez "Kayıtlı"ya geçmek tazelemeyi atlardı — eski
  // davranışta atlamıyordu.
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
  // olarak belirleniyor. ARTIK TEK KARAR NOKTASI BURASI.
  const handlePagerMomentumEnd = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (screenWidth <= 0) return;
      const idx = Math.round(nativeEvent.contentOffset.x / screenWidth);
      const key = tabs[idx]?.key;
      if (key && key !== activeTab) setActiveTab(key);
    },
    [screenWidth, activeTab, tabs]
  );

  const handleTabPress = useCallback(
    (index: number) => {
      // Şeride dokunmak tek karar noktası olan `onMomentumScrollEnd`'i
      // beklemiyor: hedef zaten kesin, hemen yazılıyor.
      const key = tabs[index]?.key;
      if (!key) return;
      setActiveTab(key);
      pagerRef.current?.scrollTo({ x: index * screenWidth, animated: true });
    },
    [screenWidth, tabs]
  );

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
  // Her sekmenin KENDİ dikey kaydırma konumu — sekme değiştirince `scrollY` o
  // sekmenin son bilinen konumuna senkronlanıyor; aksi hâlde başlık, önceki
  // sekmede nerede kalmışsa orada donuk kalırdı. Kayıt yedi anahtarın HEPSİNİ
  // taşıyor: görünür sekme kümesi moda göre değişiyor, bu tablo değişmiyor.
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
    opacity:
      cardHeightShared.value > 0
        ? 1 - Math.min(scrollY.value, cardHeightShared.value * 0.7) / (cardHeightShared.value * 0.7)
        : 1,
  }));

  // SAYFA PENCERELEME.
  //
  // Pager yatay bir ScrollView ve sayfalarının HEPSİ mount'luydu: yedi native
  // scroll view + yedi Reanimated scroll worklet, profil ekranda olmasa bile
  // ayakta. Testçilerin "profilde daha çok donuyor" demesinin payı buydu.
  //
  // Artık yalnızca aktif sekme ve İKİ KOMŞUSU gerçek scroll view olarak
  // mount'lu; geri kalanlar yerlerinde `screenWidth` genişliğinde boş bir View
  // tutuyor (pager'ın geometrisi bozulmasın, `scrollTo(idx * screenWidth)`
  // çalışmaya devam etsin diye).
  //
  // ±1 penceresi kasıtlı VE ÖNEMLİ: sürükleme sırasındaki sayfa değişimi
  // kaldırıldığı için `activeTab` ancak parmak kalkınca güncelleniyor.
  // Komşuların önceden mount'lu olması bu yüzden şart — olmasaydı parmakla
  // kaydırırken yandaki sayfa boş görünürdü.
  //
  // Bir kez mount olan sayfa mount'lu KALIYOR: kaydırma konumu ve yüklenmiş
  // verisi korunsun diye.
  //
  // İki gönderi sekmesi bu mekanizmanın dışında (hep mount'lu): içerikleri
  // `active` kapısının arkasında olduğu için pasif hâldeyken zaten BOŞ bir
  // FlatList — placeholder'dan pahalı değil, ama sayaçları ve kaydırma
  // konumlarını koruyor.
  const activeIndex = tabs.findIndex((t) => t.key === activeTab);

  // Aktif sekme görünür kümeden ÇIKARSA (profil sahibi o bölümü gizlemiş ve
  // başlık yeniden çekilmiş) ilk sekmeye dönülüyor. Bu olmadan `activeIndex`
  // -1'de kalır: şeritte hiçbir sekme aktif görünmez ve pager çıkmaz bir
  // durumda takılır.
  useEffect(() => {
    if (activeIndex >= 0) return;
    const first = tabs[0]?.key;
    if (first) setActiveTab(first);
  }, [activeIndex, tabs]);

  const [mountedTabs, setMountedTabs] = useState<TabKey[]>(() => [activeTab]);
  useEffect(() => {
    setMountedTabs((prev) => {
      const next = new Set(prev);
      for (let i = activeIndex - 1; i <= activeIndex + 1; i += 1) {
        const k = tabs[i]?.key;
        if (k) next.add(k);
      }
      // Referansı boşuna değiştirme: her kaydırmada yeni dizi = gereksiz render.
      return next.size === prev.length ? prev : Array.from(next);
    });
  }, [activeIndex, tabs]);
  const isTabMounted = useCallback((key: TabKey) => mountedTabs.includes(key), [mountedTabs]);

  if (loading) {
    return <ProfileSkeleton editable={!readOnly} />;
  }

  // Sekme bileşenlerinin ortak prop kümesi. Hepsi stabil referans olduğu için
  // `React.memo` iş görüyor: bir modal açılması ya da bir sayacın değişmesi o
  // ağaçlara HİÇ girmiyor.
  //
  // `headerHeight`: sayfa içeriği başlık kadar boşlukla başlıyor (kart + şerit
  // pager'ın ÜSTÜNDE mutlak konumlu duruyor).
  const tabProps = {
    width: screenWidth,
    headerHeight: headerTotalHeight,
    scrollY,
    onRememberOffset: rememberPageOffset,
  };

  const renderTab = (def: TabDef) => {
    const key = def.key;
    const active = activeTab === key;
    if (key === 'posts') {
      return (
        <PostsTab
          key={key}
          kind="posts"
          active={active}
          {...tabProps}
          posts={myPosts.posts}
          rows={myPosts.rows}
          loadingMore={myPosts.loadingMore}
          loadMore={myPosts.loadMore}
          onDelete={myPosts.handleDelete}
          emptyText={isMe ? 'Henüz not paylaşmadınız.' : 'Henüz onaylı not paylaşılmamış.'}
        />
      );
    }
    if (key === 'saved') {
      return (
        <PostsTab
          key={key}
          kind="saved"
          active={active}
          {...tabProps}
          posts={savedPostsState.posts}
          rows={savedPostsState.rows}
          loadingMore={savedPostsState.loadingMore}
          loadMore={savedPostsState.loadMore}
          onDelete={savedPostsState.handleDelete}
          emptyText={isMe ? 'Henüz not kaydetmediniz.' : 'Henüz not kaydetmemiş.'}
        />
      );
    }
    if (!isTabMounted(key)) return <PagerPlaceholder key={key} width={screenWidth} />;
    switch (key) {
      case 'lists':
        return <ChecklistsTab key={key} active={active} {...tabProps} />;
      case 'akts':
        return <AktsTab key={key} active={active} {...tabProps} />;
      case 'schedule':
        return <ScheduleTab key={key} active={active} {...tabProps} />;
      case 'follows':
        return <FollowsTab key={key} active={active} {...tabProps} />;
      case 'forums':
        return <ForumsTab key={key} active={active} {...tabProps} />;
      default:
        return <PagerPlaceholder key={key} width={screenWidth} />;
    }
  };

  return (
    <ProfileScopeProvider value={scope}>
      <View className="flex-1 bg-ground">
        {/* Pager ÖNCE render ediliyor: başlık katmanı ondan SONRA gelip üstüne
            mutlak konumla biniyor, böylece pager'ın kaydırması başlığın
            altından "akıyor" gibi görünüyor. Her sayfanın üst dolgusu
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
          {tabs.map(renderTab)}
        </ScrollView>

        {/* Başlık katmanı: pager'ın ÜSTÜNDE mutlak konumlu. Kart,
            `cardAnimStyle` ile hem kayıyor hem soluyor; şerit hep tam opak ve
            `headerAnimStyle` ile kartla birlikte yukarı gidip kartın
            yüksekliğinde duruyor — böylece ekranın en üstünde "yapışmış" gibi
            kalıyor. */}
        {/* `collapsable={false}`: bu da arka planı olmayan, yalnızca
            konumlandırma taşıyan bir `box-none` sarmalayıcı — Android'de
            düzleştirilip dokunuş yönlendirmesini kaybedebilir (ayrıntılı
            gerekçe WaveTabBar.tsx'te). Savunma amaçlı. */}
        <Animated.View
          pointerEvents="box-none"
          collapsable={false}
          style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, headerAnimStyle]}
        >
          {/* NativeWind'in `className` derleme dönüşümü yalnızca
              'react-native'den doğrudan import edilen bileşenleri tanıyor —
              `Animated.View` (reanimated) bu listede değil, üzerine className
              koymak sessizce hiçbir şey yapmaz. Bu yüzden görsel sınıflar
              başlığın KENDİSİNDE (`header`) kalıyor; `Animated.View` yalnızca
              saydamlık/kayma animasyonunu ve ölçümü taşıyor. */}
          <Animated.View
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              setCardHeight(h);
              cardHeightShared.value = h;
            }}
            style={cardAnimStyle}
          >
            {header}
          </Animated.View>

          <TabStrip
            tabs={tabs}
            activeTab={activeTab}
            // Sayaç "ekranda kaç satır var" değil, sunucudaki TOPLAM.
            counts={counts}
            onTabPress={handleTabPress}
            onHeightChange={setStripHeight}
          />
        </Animated.View>
      </View>
    </ProfileScopeProvider>
  );
}
