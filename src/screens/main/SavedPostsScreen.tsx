import React, { useCallback } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react-native';
import { savedPostsAPI, postsAPI } from '../../lib/api';
import { SAVED_POSTS_KEY, useSavedPosts } from '../../context/SavedPostContext';
import PostCard from '../../components/PostCard';
import { useFeedTokens } from '../../theme/feedTokens';
import { SkeletonGroup } from '../../components/Skeleton';
import NoteCardSkeleton from '../../components/NoteCardSkeleton';
import type { Post } from '../../types/post';
import { TAB_BAR_SAFE_PADDING } from '../../components/layout/tabBarMetrics';

// Kaydedilenler kullanıcının KENDİ eylemiyle değişiyor, arkasından biri
// eklemiyor: kısa bir tazelik yeterli. Kaydet/çıkar anında listeyi geçersiz
// kılan taraf SavedPostContext (bkz. o dosya), yani bu süre yalnızca "başka
// cihazdan değiştiyse ne kadar sonra görürüm" sorusunun cevabı.
const SAVED_POSTS_STALE_MS = 60 * 1000;

export default function SavedPostsScreen() {
  const { fetchSavedPosts } = useSavedPosts();
  const t = useFeedTokens();
  const { data: posts = EMPTY_POSTS, isLoading } = useQuery({
    queryKey: SAVED_POSTS_KEY,
    queryFn: async () => {
      // İki uç birlikte tazeleniyor: SavedPostContext'in id listesi (bookmark
      // ikonunun "dolu" durumu buna bakıyor) ile bu ekranın kendi post
      // listesi aynı anda gelmezse, PostCard eski (kayıtlı değil) id
      // kümesine bakıp ikonu boş gösteriyordu.
      const [, res] = await Promise.all([fetchSavedPosts(), savedPostsAPI.getSavedPosts()]);
      let postsData: Post[] = Array.isArray(res.data) ? res.data : [];

      // `/saved-posts/getPost` yanıtı comment_count döndürmüyorsa (bkz. backend),
      // eksik olan postlar için tekil gönderi ucundan tamamlanıyor.
      const missing = postsData.filter((p) => typeof p.comment_count === 'undefined');
      if (missing.length > 0) {
        const enrichedById = new Map<string, Post>();
        await Promise.all(
          missing.map(async (post) => {
            const postId = post.id ?? post.post_id;
            if (postId == null) return;
            try {
              const fullPost = await postsAPI.getById(postId);
              enrichedById.set(String(postId), fullPost.data?.post ?? fullPost.data);
            } catch {
              /* eksik kalsın, sessizce geç */
            }
          })
        );
        postsData = postsData.map((post) => {
          const key = String(post.id ?? post.post_id);
          const enriched = enrichedById.get(key);
          return enriched ? { ...post, ...enriched } : post;
        });
      }

      return postsData;
    },
    staleTime: SAVED_POSTS_STALE_MS,
  });

  const renderPost = useCallback(({ item }: { item: Post }) => <PostCard post={item} />, []);

  if (isLoading) {
    return (
      <SkeletonGroup>
        {/* Dolgu/boşluk YOK: `NoteCardSkeleton` gerçek kartın metriklerini
            (marginHorizontal 12 + marginTop 10) kendisi taşıyor, üstüne
            `p-4 gap-3` eklemek kartları iki kat içeriye kaydırıyordu. */}
        <View className="flex-1 pt-2" style={{ backgroundColor: t.ground }}>
          {[0, 1, 2].map((i) => (
            <NoteCardSkeleton key={i} />
          ))}
        </View>
      </SkeletonGroup>
    );
  }

  return (
    <FlatList
      showsVerticalScrollIndicator={false}
      className="flex-1"
      style={{ backgroundColor: t.ground }}
      contentContainerStyle={{ paddingTop: 4, paddingBottom: TAB_BAR_SAFE_PADDING, flexGrow: 1 }}
      data={posts}
      keyExtractor={(item) => String(item.id ?? item.post_id)}
      renderItem={renderPost}
      // KAPALI: PostCard dokunulabilir ve yüksekliği içeriğe göre değişiyor;
      // bu prop'un Android'de dokunuş yutması bilinen bir sorun.
      removeClippedSubviews={false}
      maxToRenderPerBatch={6}
      windowSize={7}
      initialNumToRender={6}
      ListEmptyComponent={
        <View className="bg-white rounded-lg p-8 items-center" style={SHADOW_MD}>
          <Bookmark size={48} color="#9ca3af" style={{ marginBottom: 16 }} />
          <Text className="text-gray-500 text-base text-center">Henüz not kaydetmediniz.</Text>
        </View>
      }
    />
  );
}

const EMPTY_POSTS: Post[] = [];

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};
