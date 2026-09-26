import React, { useCallback, useMemo, useRef } from 'react';
import Animated, { runOnJS, useAnimatedScrollHandler, type SharedValue } from 'react-native-reanimated';
import { FileText } from 'lucide-react-native';
import PostCard from '../PostCard';
import { TAB_BAR_SAFE_PADDING } from '../layout/tabBarMetrics';
import { postKey, type PostsKind } from '../../hooks/profile/usePostsPagination';
import type { Post } from '../../types/post';
import { EmptyState } from './profileCommon';
import { PostListSkeleton } from '../PostCardSkeleton';

// Profil'in "Postlar" ve "Kayıtlı" sekmeleri — ikisi de aynı bileşen, tek fark
// `kind`.
//
// Liste SANALLAŞTIRILMIŞ (`Animated.FlatList`). Eskiden `Animated.ScrollView`
// içinde düz bir `.map()` vardı: liste ne kadar uzunsa o kadar kart aynı anda
// mount kalıyor, hepsi her render'da yeniden çiziliyordu.
//
// Scroll worklet'i artık BURADA kuruluyor ve closure'ındaki her şey kalıcı
// olarak stabil (`scrollY`, `onRememberOffset`, `reachEnd`) — yani mount'ta bir
// kez. ProfileScreen'in gövdesindeyken `loadMore` zinciri üzerinden her liste
// mutasyonunda yeniden inşa ediliyordu (bkz. usePostsPagination.ts).
function PostsTab({
  kind,
  active,
  width,
  headerHeight,
  scrollY,
  onRememberOffset,
  posts,
  rows,
  loadingMore,
  loadMore,
  onDelete,
  emptyText,
}: {
  kind: PostsKind;
  active: boolean;
  width: number;
  headerHeight: number;
  scrollY: SharedValue<number>;
  onRememberOffset: (key: PostsKind, y: number) => void;
  posts: Post[];
  /** `null` = ilk sayfa henüz çekilmedi — "henüz kaydın yok" yerine spinner. */
  rows: Post[] | null;
  loadingMore: boolean;
  loadMore: () => void;
  onDelete: (id: string | number) => void;
  emptyText: string;
}) {
  // Worklet'in closure'ına `active` GİRMİYOR: girseydi her sekme değişiminde
  // worklet yeniden kurulurdu. Kontrol JS tarafında, ref üzerinden.
  const activeRef = useRef(active);
  activeRef.current = active;

  const reachEnd = useCallback(() => {
    if (activeRef.current) loadMore();
  }, [loadMore]);

  // Sekme içerikleri sanallaştırılmış bir listede olduğu hâlde `onEndReached`
  // yerine kaydırma olayından tetikliyoruz: aynı worklet hem kayan başlığı
  // (`scrollY`) besliyor hem de eşiği kontrol ediyor — iki ayrı dinleyici
  // kurmamak için. Eşik bir ekran boyu ("onEndReachedThreshold={1}") —
  // HomeScreen ile aynı gerekçe: sayfa çoğu zaman kullanıcı dibe varmadan
  // gelmiş oluyor.
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const distanceToEnd = event.contentSize.height - event.contentOffset.y - event.layoutMeasurement.height;
      if (distanceToEnd <= event.layoutMeasurement.height) {
        runOnJS(reachEnd)();
      }
    },
    onEndDrag: (event) => runOnJS(onRememberOffset)(kind, event.contentOffset.y),
    onMomentumEnd: (event) => runOnJS(onRememberOffset)(kind, event.contentOffset.y),
  });

  const renderItem = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard post={item} showStatus showRating={kind === 'saved'} onDelete={onDelete} />
    ),
    [kind, onDelete]
  );

  const pageStyle = useMemo(() => ({ width }), [width]);
  // `paddingTop` bir `onLayout` ölçümü — derleme zamanında bilinemeyeceği için
  // NativeWind sınıfı olamaz.
  const contentStyle = useMemo(
    () => ({ paddingTop: headerHeight + 14, paddingBottom: TAB_BAR_SAFE_PADDING }),
    [headerHeight]
  );

  return (
    <Animated.FlatList
      style={pageStyle}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentStyle}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      // Pasif sekmede de DOLU: yan sekmeye kaydırırken kartlar görünsün
      // (kullanıcı isteği). Eskiden `active ? posts : NO_POSTS` idi ve her
      // sekme değişiminde liste söküp baştan kuruluyordu (bkz. ProfileScreen
      // pager notu) — artık iki liste de mount'ta bir kez kuruluyor ve
      // sanallaştırma sayesinde her biri yalnızca ekrana yakın kartları
      // çiziyor. Sayfalama yine yalnızca aktif sekmede (`activeRef`).
      data={posts}
      keyExtractor={postKey}
      renderItem={renderItem}
      // `removeClippedSubviews` BİLEREK KAPALI: kartlar dokunulabilir ve bu
      // prop'un ekrandan çıkıp giren satırlarda dokunmayı yutması bilinen bir
      // sorun. Sanallaştırmanın asıl kazancı zaten aşağıdaki üç ayarda.
      removeClippedSubviews={false}
      maxToRenderPerBatch={5}
      windowSize={7}
      initialNumToRender={5}
      // `rows === null` = ilk sayfa henüz gelmedi. "Postlar"da BİLEREK hiçbir
      // şey göstermiyoruz: o ilk yüklemeyi zaten ekran çapındaki iskelet
      // karşılıyor (bkz. ProfileScreen). Buraya ayrıca spinner koymak
      // "spinner -> iskelet -> içerik" diye çift geçiş yaratıyordu.
      //
      // "Kayıtlı"da gösterge KALIYOR (kart iskeleti olarak): oranın listesi bir not kaydedilip
      // çıkarıldığında sentinel'e çekilip sekmeye girilince yeniden çekiliyor
      // ve o an ekran iskeleti devrede değil — hiçbir geri bildirim olmazsa
      // sekme boş görünürdü.
      ListEmptyComponent={
        rows === null ? (
          kind === 'saved' ? <PostListSkeleton count={2} /> : null
        ) : (
          <EmptyState icon={FileText} text={emptyText} />
        )
      }
      // Sonraki sayfa: spinner yerine kart iskeleti (bkz. PostListSkeleton).
      ListFooterComponent={loadingMore ? <PostListSkeleton /> : null}
    />
  );
}

export default React.memo(PostsTab);
