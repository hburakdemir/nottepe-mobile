import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Link2, Star, Trash2, User } from 'lucide-react-native';
import { postsAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useSavedPosts } from '../../context/SavedPostContext';
import { useCardSurface, useFeedTokens } from '../../theme/feedTokens';
import { useGoToUserProfile } from '../../hooks/useGoToUserProfile';
import { buildPostAuthorAvatar } from '../../lib/postAuthorAvatar';
import AvatarDisplay from '../../components/avatar/AvatarDisplay';
import FileTiles from '../../components/FileTiles';
import BadgeChip from '../../components/BadgeChip';
import SaveButton from '../../components/SaveButton';
import CommentSection from '../../components/CommentSection';
import type { RootStackParamList } from '../../navigation/types';
import type { Post } from '../../types/post';
import { TAB_BAR_SAFE_PADDING } from '../../components/layout/tabBarMetrics';
import StateView from '../../components/StateView';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Akıştaki kartla (PostCardModern — "R1 · Sakin Şerit") aynı dil: kart/gölge
// yok, tek zemin, künye → başlık → içerik → dosya şeridi → kimlik sırası.
// Detayda fark: içerik kısaltılmıyor, dosyalar tek tek listeleniyor, tarih tam
// yazılıyor ve altta yorumlar var.
export default function PostDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isAuthenticated } = useAuth();
  const { savedPosts, toggleSavePost } = useSavedPosts();
  const t = useFeedTokens();
  const cardSurface = useCardSurface();
  const goToUserProfile = useGoToUserProfile();
  const { postId } = route.params as RootStackParamList['PostDetail'];
  const isSaved = savedPosts.includes(String(postId));

  const scrollRef = useRef<ScrollView>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // "Tekrar dene" butonunun useEffect'i yeniden tetikleyebilmesi için basit
  // bir sayaç — postId değişmeden aynı isteği yeniden atmanın en kısa yolu.
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await postsAPI.getById(postId);
        if (mounted) setPost(res.data.post);
      } catch (err: any) {
        if (mounted) setError(err.response?.status === 404 ? 'Gönderi bulunamadı.' : 'Gönderi yüklenemedi.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [postId, retryTick]);

  const handleRetry = useCallback(() => setRetryTick((n) => n + 1), []);

  const handleDeletePost = () => {
    Alert.alert('Gönderiyi sil', 'Bu gönderiyi silmek istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await postsAPI.deletePost(postId);
            navigation.goBack();
          } catch {
            Alert.alert('Hata', 'Gönderi silinemedi.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.ground }]}>
        <StateView kind="loading" loadingColor={t.accent} />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={[styles.center, { backgroundColor: t.ground }]}>
        <StateView
          kind="error"
          title={error || 'Gönderi bulunamadı.'}
          onAction={error === 'Gönderi bulunamadı.' ? undefined : handleRetry}
        />
      </View>
    );
  }

  const isOwner = user && String(user.id) === String(post.user_id);
  const avgRating = Number(post.avg_rating) || 0;
  const ratingCount = post.rating_count || 0;
  const authorAvatar = buildPostAuthorAvatar(post);
  const files = post.file_urls ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_SAFE_PADDING }}>
        <View style={[styles.head, cardSurface]}>
        {/* Profil en üstte: avatar + kullanıcı adı + rozetler + tarih, sağda
            kaydet/sil. Fakülte ve bölüm künyesi en alta indi. */}
        <View style={styles.authorRow}>
          <Pressable style={styles.who} onPress={() => goToUserProfile(post.username)} hitSlop={6}>
            <View style={[styles.avatar, { backgroundColor: t.inset }]}>
              {authorAvatar ? <AvatarDisplay avatar={authorAvatar} size={36} showBg={false} /> : <User size={18} color={t.ink3} />}
            </View>
            <View style={{ minWidth: 0, flexShrink: 1 }}>
              <View style={styles.nameLine}>
                <Text style={[styles.whoName, { color: t.ink }]} numberOfLines={1}>
                  {post.username || 'Anonim'}
                </Text>
                {!!post.badges?.length && (
                  <View style={styles.badgeRow}>
                    {post.badges.map((badge) => (
                      <BadgeChip key={badge.id} badge={badge} compact />
                    ))}
                  </View>
                )}
              </View>
              <Text style={[styles.date, { color: t.ink3 }]}>{formatDate(post.created_at)}</Text>
            </View>
          </Pressable>

          {isOwner && (
            <View style={styles.actions}>
              <Pressable onPress={handleDeletePost} hitSlop={8}>
                <Trash2 size={18} color={t.danger} strokeWidth={2} />
              </Pressable>
            </View>
          )}
        </View>

        <Text style={[styles.title, { color: t.ink }]}>{post.title}</Text>

        {!!post.content && <Text style={[styles.body, { color: t.ink2 }]}>{post.content}</Text>}

        {/* Detayda sınır yok: bütün dosyalar kendi kutucuğuyla listeleniyor. */}
        {files.length > 0 && <FileTiles files={files} />}

        {post.link ? (
          <Pressable style={styles.linkRow} onPress={() => Linking.openURL(post.link!)} hitSlop={6}>
            <Link2 size={14} color={t.ink2} strokeWidth={2} />
            <Text style={[styles.linkText, { color: t.ink2 }]} numberOfLines={1}>
              Bağlantıyı aç
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.crumb, { color: t.ink3 }]}>
          {post.faculty}
          {!!post.faculty && !!post.department && <Text style={{ color: t.line }}>{'  ›  '}</Text>}
          <Text style={[styles.crumbDept, { color: t.ink2 }]}>{post.department}</Text>
        </Text>

        <View style={[styles.ratingRow, { borderTopColor: t.line }]}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={16}
              color={avgRating >= star ? t.amber : t.line}
              fill={avgRating >= star ? t.amber : 'none'}
              strokeWidth={1.6}
            />
          ))}
          <Text style={[styles.ratingText, { color: t.ink3 }]}>
            {ratingCount > 0 ? `${avgRating.toFixed(1)}/5 · ${ratingCount} puan` : 'Henüz puan yok'}
          </Text>
        </View>
      </View>

      <View style={[styles.comments, cardSurface]}>
        <CommentSection
          postId={postId}
          postOwnerId={post.user_id}
          // Yorumlar açık geliyor: kullanıcı ayrıca dokunmadan yükleniyorlar.
          defaultCollapsed={false}
          // Klavye açılırken formu görünür alana kaydır (bkz. CommentSection).
          onInputFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)}
          isAdmin={user?.role === 'admin' || user?.role === 'moderator'}
          onRatingChange={({ avg_rating, rating_count }) => setPost((prev) => (prev ? { ...prev, avg_rating, rating_count } : prev))}
        />
      </View>
      </ScrollView>

      {/* Kaydet ikonu ekranın en sağ üstünde sabit (kullanıcı isteği),
          kaydırma boyunca yerinde kalıyor. */}
      {isAuthenticated && (
        <View style={[styles.floatingSave, { backgroundColor: t.ground }]} pointerEvents="box-none">
          <SaveButton saved={isSaved} onPress={() => toggleSavePost(postId)} size={20} color={t.ink2} savedColor={t.ink} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  floatingSave: { position: 'absolute', top: 8, right: 8, borderRadius: 24 },
  crumb: { fontSize: 12.5, lineHeight: 18 },
  crumbDept: { fontWeight: '600' },
  // Gönderi ve yorumlar iki ayrı kart — akıştaki kartlarla aynı dil.
  head: {
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    borderRadius: 16,
    gap: 13,
  },
  title: { fontSize: 23, fontWeight: '600', lineHeight: 30, letterSpacing: -0.3 },
  body: { fontSize: 14.5, lineHeight: 23 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { fontSize: 12.5, fontWeight: '500' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 },
  avatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  whoName: { fontSize: 14, fontWeight: '600' },
  date: { fontSize: 11.5, marginTop: 1 },
  badgeRow: { flexDirection: 'row', gap: 3 },
  actions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingTop: 14, marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth },
  ratingText: { fontSize: 12.5, marginLeft: 8 },
  comments: {
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderRadius: 16,
  },
});
