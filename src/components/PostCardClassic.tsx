import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar, FileText, MessageSquare, Star, Trash2, User } from 'lucide-react-native';
import type { Post } from '../types/post';
import { postsAPI, ratingAPI } from '../lib/api';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { useSavedPosts } from '../context/SavedPostContext';
import { useTheme } from '../context/ThemeContext';
import { useGoToUserProfile } from '../hooks/useGoToUserProfile';
import { useOpenFileViewer } from '../hooks/useOpenFileViewer';
import { buildPostAuthorAvatar } from '../lib/postAuthorAvatar';
import AvatarDisplay from './avatar/AvatarDisplay';
import BadgeChip from './BadgeChip';
import SaveButton from './SaveButton';

const MAX_LENGTH = 200;

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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

// ESKİ (klasik) kart tasarımı — yeni düzen beğenilmezse `PostCard.tsx`
// içindeki POSTCARD_VARIANT bayrağı 'classic' yapılınca bu dosya devreye
// giriyor. Prop sözleşmesi PostCardModern ile birebir aynı.
export default function PostCardClassic({ post, showStatus = false, showRating = true, onDelete }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  // Web'in PostCard.jsx'indeki dark: token'larıyla birebir eşleşiyor —
  // lucide ikonları className değil renk prop'u alıyor (bkz. MenuDrawerContent
  // iconColor deseni), o yüzden burada da tema koşullu hex kullanılıyor.
  const trashColor = isDark ? '#DFD0B8' : '#6b7280';
  const fileIconColor = isDark ? '#C5D3E8' : '#1e3a8a';
  const { isAuthenticated, user } = useAuth();
  const isOwner = !!user && String(user.id) === String(post.user_id);
  const { savedPosts, toggleSavePost } = useSavedPosts();
  const goToUserProfile = useGoToUserProfile();
  const openFileViewer = useOpenFileViewer();
  const [showMore, setShowMore] = useState(false);
  const content = post.content || '';
  const isLong = content.length > MAX_LENGTH;
  const displayText = showMore || !isLong ? content : content.slice(0, MAX_LENGTH) + '...';
  const [avgRating, setAvgRating] = useState(Number(post.avg_rating) || 0);
  const [ratingCount, setRatingCount] = useState(post.rating_count || 0);
  const [rating, setRating] = useState(false);
  const postId = post.id ?? post.post_id!;
  const authorAvatar = buildPostAuthorAvatar(post);
  const isSaved = savedPosts.includes(String(postId));

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

  return (
    <Pressable className="bg-surface rounded-lg mb-3" style={styles.card} onPress={() => navigation.navigate('PostDetail', { postId })}>
      {showStatus && (
        <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusBadge.text }]}>{statusBadge.label}</Text>
        </View>
      )}
      <View style={styles.titleRow}>
        <Text className="text-ink f" style={[styles.title, { flex: 1 }]}>
          {post.title}
        </Text>
        {isOwner && (
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Trash2 size={18} color={trashColor} />
          </Pressable>
        )}
        {isAuthenticated && (
          <SaveButton
            saved={isSaved}
            onPress={() => toggleSavePost(postId)}
            size={19}
            color={isDark ? '#DFD0B8' : '#111827'}
            savedColor={isDark ? '#DFD0B8' : '#003161'}
          />
        )}
      </View>
      <Text className="text-ink2" style={styles.content}>
        {displayText}
      </Text>
      {isLong && (
        <Pressable onPress={() => setShowMore((v) => !v)}>
          <Text className="text-on-badge" style={styles.more}>
            {showMore ? 'Daha az göster' : 'Devamını oku'}
          </Text>
        </Pressable>
      )}

      {post.link ? (
        <Pressable onPress={() => Linking.openURL(post.link!)}>
          <Text className="text-on-badge" style={styles.link}>
            🔗 Linki aç
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.chipRow}>
        <View style={[styles.chip, styles.chipBrand]}>
          <Text style={styles.chipText}>{post.faculty}</Text>
        </View>
        <View style={[styles.chip, styles.chipBrandLight]}>
          <Text style={styles.chipText}>{post.department}</Text>
        </View>
      </View>

      <Pressable style={styles.ownerRow} onPress={() => goToUserProfile(post.username)}>
        <View className="bg-inset" style={styles.avatarFallback}>
          {authorAvatar ? (
            <AvatarDisplay avatar={authorAvatar} size={32} showBg={false} />
          ) : (
            <User size={16} color={isDark ? '#DFD0B8' : '#6b7280'} />
          )}
        </View>
        <Text className="text-ink2" style={styles.username}>
          {post.username || 'Anonim'}
        </Text>
        {!!post.badges?.length && (
          <View style={styles.badgeRow}>
            {post.badges.map((badge) => (
              <BadgeChip key={badge.id} badge={badge} compact />
            ))}
          </View>
        )}
      </Pressable>

      {post.file_urls && post.file_urls.length > 0 && (
        <View style={{ marginTop: 8, gap: 6 }}>
          {post.file_urls.map((fileName, index) => (
            <Pressable
              key={index}
              style={styles.fileRow}
              onPress={() => openFileViewer(post.file_urls!, index, post.title)}
            >
              <FileText size={16} color={fileIconColor} />
              <Text className="text-on-badge" style={styles.fileText}>
                Notu Gör
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {showRating && (
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => handleRate(star)} disabled={rating} hitSlop={4}>
              <Star size={16} color={avgRating >= star ? '#eab308' : '#d1d5db'} fill={avgRating >= star ? '#eab308' : 'none'} />
            </Pressable>
          ))}
          <Text className="text-muted" style={styles.ratingText}>
            ({ratingCount > 0 ? `${avgRating.toFixed(1)}/5` : '0.0/5'})
          </Text>
        </View>
      )}

      <View className="border-line-soft" style={styles.footer}>
        <View style={styles.footerItem}>
          <Calendar size={13} color={isDark ? '#9ca3af' : '#6b7280'} />
          <Text className="text-muted" style={styles.footerText}>
            {formatDate(post.created_at)}
          </Text>
        </View>
        <Pressable style={styles.footerItem} onPress={() => navigation.navigate('PostDetail', { postId })}>
          <MessageSquare size={13} color={isDark ? '#5A9690' : '#2F5755'} />
          <Text className="text-accent" style={styles.footerLink}>
            Yorumları Gör
          </Text>
          {!!post.comment_count && (
            <View className="bg-accent-soft" style={styles.commentPill}>
              <Text className="text-accent" style={styles.commentPillText}>
                {post.comment_count}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
  statusBadgeText: { fontSize: 10.5, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  title: { fontSize: 19, fontWeight: '800' },
  content: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  more: { fontSize: 13, marginTop: 4 },
  link: { fontSize: 13, marginTop: 8, fontWeight: '500' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 },
  chipBrand: { backgroundColor: '#2F5755' },
  chipBrandLight: { backgroundColor: '#4f7d7a' },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  badgeRow: { flexDirection: 'row', gap: 4, marginLeft: 2 },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: { fontSize: 13, fontWeight: '500' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fileText: { fontSize: 13, fontWeight: '500' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 8, justifyContent: 'flex-end' },
  ratingText: { fontSize: 12, marginLeft: 6 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { fontSize: 12 },
  footerLink: { fontSize: 12, fontWeight: '600' },
  commentPill: { borderRadius: 100, paddingHorizontal: 6, paddingVertical: 1 },
  commentPillText: { fontSize: 11, fontWeight: '700' },
});
