import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bookmark, Calendar, FileText, MessageSquare, Star, Trash2, User } from 'lucide-react-native';
import type { Post } from '../types/post';
import { getFileUrl } from '../lib/config';
import { postsAPI, ratingAPI } from '../lib/api';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { useSavedPosts } from '../context/SavedPostContext';
import { useGoToUserProfile } from '../hooks/useGoToUserProfile';
import BadgeChip from './BadgeChip';

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

export default function PostCard({ post, showStatus = false, showRating = true, onDelete }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
  const postId = post.id ?? post.post_id!;
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
    <Pressable
      style={styles.card}
      onPress={() => navigation.navigate('PostDetail', { postId })}
    >
      {showStatus && (
        <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusBadge.text }]}>{statusBadge.label}</Text>
        </View>
      )}
      <View style={styles.titleRow}>
        <Text style={[styles.title, { flex: 1 }]}>{post.title}</Text>
        {isOwner && (
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Trash2 size={18} color="#6b7280" />
          </Pressable>
        )}
        {isAuthenticated && (
          <Pressable onPress={() => toggleSavePost(postId)} hitSlop={8}>
            <Bookmark size={19} color={isSaved ? '#003161' : '#111827'} fill={isSaved ? '#003161' : 'none'} />
          </Pressable>
        )}
      </View>
      <Text style={styles.content}>{displayText}</Text>
      {isLong && (
        <Pressable onPress={() => setShowMore((v) => !v)}>
          <Text style={styles.more}>{showMore ? 'Daha az göster' : 'Devamını oku'}</Text>
        </Pressable>
      )}

      {post.link ? (
        <Pressable onPress={() => Linking.openURL(post.link!)}>
          <Text style={styles.link}>🔗 Linki aç</Text>
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
        <View style={styles.avatarFallback}>
          <User size={16} color="#6b7280" />
        </View>
        <Text style={styles.username}>{post.username || 'Anonim'}</Text>
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
              onPress={() => Linking.openURL(getFileUrl(fileName))}
            >
              <FileText size={16} color="#1e3a8a" />
              <Text style={styles.fileText}>Notu Gör</Text>
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
          <Text style={styles.ratingText}>
            ({ratingCount > 0 ? `${avgRating.toFixed(1)}/5` : '0.0/5'})
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Calendar size={13} color="#6b7280" />
          <Text style={styles.footerText}>{formatDate(post.created_at)}</Text>
        </View>
        <Pressable style={styles.footerItem} onPress={() => navigation.navigate('PostDetail', { postId })}>
          <MessageSquare size={13} color="#2F5755" />
          <Text style={styles.footerLink}>Yorumları Gör</Text>
          {!!post.comment_count && (
            <View style={styles.commentPill}>
              <Text style={styles.commentPillText}>{post.comment_count}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
  statusBadgeText: { fontSize: 10.5, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  title: { fontSize: 17, fontWeight: '600', color: '#111827' },
  content: { fontSize: 14, color: '#1f2937', lineHeight: 20 },
  more: { color: '#1d4ed8', fontSize: 13, marginTop: 4 },
  link: { color: '#1d4ed8', fontSize: 13, marginTop: 8, fontWeight: '500' },
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
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: { fontSize: 13, color: '#374151', fontWeight: '500' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fileText: { color: '#1e3a8a', fontSize: 13, fontWeight: '500' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 8, justifyContent: 'flex-end' },
  ratingText: { fontSize: 12, color: '#6b7280', marginLeft: 6 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { fontSize: 12, color: '#6b7280' },
  footerLink: { fontSize: 12, color: '#2F5755', fontWeight: '600' },
  commentPill: { backgroundColor: '#2F575519', borderRadius: 100, paddingHorizontal: 6, paddingVertical: 1 },
  commentPillText: { fontSize: 11, fontWeight: '700', color: '#2F5755' },
});
