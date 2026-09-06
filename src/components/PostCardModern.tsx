import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Link2, MessageSquare, Star, Trash2, User } from 'lucide-react-native';
import type { Post } from '../types/post';
import { postsAPI, ratingAPI } from '../lib/api';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { useSavedPosts } from '../context/SavedPostContext';
import { useCardSurface, useFeedTokens } from '../theme/feedTokens';
import { useGoToUserProfile } from '../hooks/useGoToUserProfile';
import { buildPostAuthorAvatar } from '../lib/postAuthorAvatar';
import AvatarDisplay from './avatar/AvatarDisplay';
import FileTiles from './FileTiles';
import SaveButton from './SaveButton';

const MAX_LENGTH = 200;

// Akışta en fazla iki dosya kutucuğu; kalanlar "+N" butonunda toplanıp
// gönderi ekranına götürüyor (satır uzayıp akışı bozmasın diye).
const FEED_FILE_TILES = 2;

// Kartta kısa tarih (17 Ağu) — künye satırı zaten dolu, uzun tarih orayı
// gereksiz şişiriyordu. Gönderi detayında tam tarih gösteriliyor.
function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

interface Props {
  post: Post;
  showStatus?: boolean;
  showRating?: boolean;
  onDelete?: (id: string | number) => void;
}

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  approved: { bg: '#dcfce7', text: '#166534', label: 'Onaylandı' },
  pending: { bg: '#fef9c3', text: '#854d0e', label: 'Onay Bekliyor' },
  rejected: { bg: '#fee2e2', text: '#991b1b', label: 'Reddedildi' },
};

// Onaylanan "R1 · Sakin Şerit" tasarımı: kart/gölge yok, satırlar tek zemin
// üstünde ince çizgiyle ayrılıyor. Sıra: künye (fakülte › bölüm) → başlık →
// içerik → dosya şeridi → link → kimlik + sayaçlar.
//
// Şerit nötr yüzeyde duruyor, renk yalnızca ikon karesinde — on satır arka
// arkaya geldiğinde dolu teal bloklar akışı yoruyordu (bkz. tasarım panosu).
// Eski tasarım PostCardClassic.tsx'te; geçiş PostCard.tsx'teki tek bayrakla.
export default function PostCardModern({ post, showStatus = false, showRating = true, onDelete }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const t = useFeedTokens();
  const cardSurface = useCardSurface();
  const { isAuthenticated, user } = useAuth();
  const isOwner = !!user && String(user.id) === String(post.user_id);
  const { savedPosts, toggleSavePost } = useSavedPosts();
  const goToUserProfile = useGoToUserProfile();
  const [showMore, setShowMore] = useState(false);
  const content = post.content || '';
  const isLong = content.length > MAX_LENGTH;
  const displayText = showMore || !isLong ? content : content.slice(0, MAX_LENGTH) + '...';
  const [avgRating, setAvgRating] = useState(Number(post.avg_rating) || 0);
  const [ratingCount, setRatingCount] = useState(post.rating_count || 0);
  const [rating, setRating] = useState(false);
  const [showRatingPicker, setShowRatingPicker] = useState(false);
  const postId = post.id ?? post.post_id!;
  const isSaved = savedPosts.includes(String(postId));
  const authorAvatar = buildPostAuthorAvatar(post);
  const files = post.file_urls ?? [];
  const fileCount = files.length;

  const handleRate = async (star: number) => {
    if (!isAuthenticated) {
      Alert.alert('Giriş gerekli', 'Oy vermek için giriş yapmalısınız.');
      return;
    }
    setRating(true);
    try {
      const res = await ratingAPI.ratePost(postId, star);
      setAvgRating(parseFloat(res.data.rating_info.avg_rating));
      setRatingCount(res.data.rating_info.rating_count);
      setShowRatingPicker(false);
    } catch {
      Alert.alert('Hata', 'Oy verirken hata oluştu.');
    } finally {
      setRating(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Gönderiyi sil', 'Bu gönderiyi silecek misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await postsAPI.deletePost(postId);
            onDelete?.(postId);
          } catch {
            Alert.alert('Hata', 'Gönderi silinirken bir hata oluştu.');
          }
        },
      },
    ]);
  };

  const statusBadge = STATUS_BADGES[post.status || 'pending'];
  const openDetail = () => navigation.navigate('PostDetail', { postId });

  return (
    <Pressable style={[styles.card, cardSurface]} onPress={openDetail}>
      {showStatus && (
        <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusBadge.text }]}>{statusBadge.label}</Text>
        </View>
      )}

      {/* Künye: fakülte soluk, bölüm net. Kaydet ikonu de bu satırla aynı
          hizada, en sağda — kullanıcı isteği: eskiden başlık satırındaydı,
          künye ile aynı yükseklikte olması istendi. */}
      <View style={styles.crumbRow}>
        <Text style={[styles.crumb, { color: t.ink3, flex: 1 }]} numberOfLines={2}>
          {post.faculty}
          {!!post.faculty && !!post.department && <Text style={{ color: t.line }}>{'  ›  '}</Text>}
          <Text style={[styles.crumbDept, { color: t.ink2 }]}>{post.department}</Text>
        </Text>
        {isAuthenticated && (
          <SaveButton saved={isSaved} onPress={() => toggleSavePost(postId)} color={t.ink2} savedColor={t.ink} />
        )}
      </View>

      <Text style={[styles.title, { color: t.ink }]}>{post.title}</Text>

      {!!content && <Text style={[styles.body, { color: t.ink2 }]}>{displayText}</Text>}
      {isLong && (
        <Pressable onPress={() => setShowMore((v) => !v)} hitSlop={6}>
          <Text style={[styles.more, { color: t.accent }]}>{showMore ? 'Daha az göster' : 'Devamını oku'}</Text>
        </Pressable>
      )}

      {fileCount > 0 && <FileTiles files={files} maxVisible={FEED_FILE_TILES} onPressMore={openDetail} />}

      {post.link ? (
        <Pressable style={styles.linkRow} onPress={() => Linking.openURL(post.link!)} hitSlop={6}>
          <Link2 size={14} color={t.ink2} strokeWidth={2} />
          <Text style={[styles.linkText, { color: t.ink2 }]} numberOfLines={1}>
            Bağlantıyı aç
          </Text>
        </Pressable>
      ) : null}

      {/* Alt satır sabit hizada: kimlik solda, sayaçlar + kaydet sağda. */}
      <View style={styles.foot}>
        <Pressable style={styles.who} onPress={() => goToUserProfile(post.username)} hitSlop={6}>
          <View style={[styles.avatar, { backgroundColor: t.inset }]}>
            {authorAvatar ? <AvatarDisplay avatar={authorAvatar} size={24} showBg={false} /> : <User size={13} color={t.ink3} />}
          </View>
          <Text style={[styles.whoName, { color: t.ink2 }]} numberOfLines={1}>
            {post.username || 'Anonim'}
          </Text>
        </Pressable>

        <Text style={[styles.date, { color: t.ink3 }]}>{formatShortDate(post.created_at)}</Text>

        <View style={styles.stats}>
          {showRating && (
            <Pressable style={styles.stat} onPress={() => setShowRatingPicker((v) => !v)} hitSlop={8}>
              <Star size={14} color={t.amber} fill={avgRating > 0 ? t.amber : 'none'} strokeWidth={1.6} />
              <Text style={[styles.statText, { color: t.ink2 }]}>{ratingCount > 0 ? avgRating.toFixed(1) : '0.0'}</Text>
            </Pressable>
          )}
          <Pressable style={styles.stat} onPress={openDetail} hitSlop={8}>
            <MessageSquare size={14} color={t.ink2} strokeWidth={2} />
            <Text style={[styles.statText, { color: t.ink2 }]}>{post.comment_count ?? 0}</Text>
          </Pressable>
          {isOwner && (
            <Pressable onPress={handleDelete} hitSlop={8}>
              <Trash2 size={16} color={t.ink3} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      </View>

      {showRating && showRatingPicker && (
        <View style={styles.ratingPicker}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => handleRate(star)} disabled={rating} hitSlop={4}>
              <Star size={20} color={avgRating >= star ? t.amber : t.line} fill={avgRating >= star ? t.amber : 'none'} strokeWidth={1.6} />
            </Pressable>
          ))}
          <Text style={[styles.ratingPickerText, { color: t.ink3 }]}>
            {ratingCount > 0 ? `${avgRating.toFixed(1)}/5 · ${ratingCount} puan` : 'Henüz puan yok'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Her gönderi ayrı bir kart: yumuşak köşe + kartlar arası boşluk. Yüzeyin
  // kendisi (koyu: kontrast + çerçeve, açık: gölge) useCardSurface'ten geliyor.
  card: {
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 16,
    gap: 11,
  },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  statusBadgeText: { fontSize: 10.5, fontWeight: '700' },
  crumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  crumb: { fontSize: 12, lineHeight: 17 },
  crumbDept: { fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '600', lineHeight: 24, letterSpacing: -0.2 },
  body: { fontSize: 13.5, lineHeight: 21 },
  more: { fontSize: 13, fontWeight: '600' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { fontSize: 12.5, fontWeight: '500' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1, minWidth: 0 },
  avatar: { width: 24, height: 24, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  whoName: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  date: { fontSize: 12 },
  stats: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 13 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontSize: 12.5, fontWeight: '600' },
  ratingPicker: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingPickerText: { fontSize: 12, marginLeft: 6 },
});
