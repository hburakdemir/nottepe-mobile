import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bookmark, Calendar, ExternalLink, FileText, Star, Trash2, User } from 'lucide-react-native';
import { postsAPI } from '../../lib/api';
import { getFileUrl } from '../../lib/config';
import { useAuth } from '../../context/AuthContext';
import { useSavedPosts } from '../../context/SavedPostContext';
import { useGoToUserProfile } from '../../hooks/useGoToUserProfile';
import CommentSection from '../../components/CommentSection';
import type { RootStackParamList } from '../../navigation/types';
import type { Post } from '../../types/post';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function PostDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isAuthenticated } = useAuth();
  const { savedPosts, toggleSavePost } = useSavedPosts();
  const goToUserProfile = useGoToUserProfile();
  const { postId } = route.params as RootStackParamList['PostDetail'];
  const isSaved = savedPosts.includes(String(postId));

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
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
  }, [postId]);

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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Gönderi bulunamadı.'}</Text>
      </View>
    );
  }

  const isOwner = user && String(user.id) === String(post.user_id);
  const avgRating = Number(post.avg_rating) || 0;
  const ratingCount = post.rating_count || 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{post.title}</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {isAuthenticated && (
            <Pressable onPress={() => toggleSavePost(postId)} hitSlop={8}>
              <Bookmark size={20} color="#1d4ed8" fill={isSaved ? '#1d4ed8' : 'none'} />
            </Pressable>
          )}
          {isOwner && (
            <Pressable onPress={handleDeletePost} hitSlop={8}>
              <Trash2 size={20} color="#dc2626" />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={[styles.chip, styles.chipBrand]}>
          <Text style={styles.chipText}>{post.faculty}</Text>
        </View>
        <View style={[styles.chip, styles.chipBrandLight]}>
          <Text style={styles.chipText}>{post.department}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Pressable style={styles.metaItem} onPress={() => goToUserProfile(post.username)}>
          <View style={styles.avatarFallback}>
            <User size={14} color="#6b7280" />
          </View>
          <Text style={styles.metaText}>{post.username || 'Anonim'}</Text>
        </Pressable>
        <View style={styles.metaItem}>
          <Calendar size={13} color="#6b7280" />
          <Text style={styles.metaText}>{formatDate(post.created_at)}</Text>
        </View>
      </View>

      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            color={avgRating >= star ? '#eab308' : '#d1d5db'}
            fill={avgRating >= star ? '#eab308' : 'none'}
          />
        ))}
        <Text style={styles.ratingText}>
          {ratingCount > 0 ? `${avgRating.toFixed(1)}/5 · ${ratingCount} puan` : 'Henüz puan yok'}
        </Text>
      </View>

      <Text style={styles.body}>{post.content}</Text>

      {post.link ? (
        <Pressable style={styles.linkRow} onPress={() => Linking.openURL(post.link!)}>
          <ExternalLink size={15} color="#1d4ed8" />
          <Text style={styles.linkText}>Linki aç</Text>
        </Pressable>
      ) : null}

      {post.file_urls && post.file_urls.length > 0 && (
        <View style={styles.filesBlock}>
          <Text style={styles.filesLabel}>DOSYALAR</Text>
          <View style={{ gap: 8 }}>
            {post.file_urls.map((fileName, index) => (
              <Pressable
                key={index}
                style={styles.fileRow}
                onPress={() => Linking.openURL(getFileUrl(fileName))}
              >
                <FileText size={15} color="#374151" />
                <Text style={styles.fileText}>{fileName}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.divider} />

      <CommentSection
        postId={postId}
        postOwnerId={post.user_id}
        onRatingChange={({ avg_rating, rating_count }) =>
          setPost((prev) => (prev ? { ...prev, avg_rating, rating_count } : prev))
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#6b7280', fontSize: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: '#111827', lineHeight: 26 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 },
  chipBrand: { backgroundColor: '#2F5755' },
  chipBrandLight: { backgroundColor: '#4f7d7a' },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaText: { fontSize: 13, color: '#6b7280' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 14 },
  ratingText: { fontSize: 12.5, color: '#6b7280', marginLeft: 6 },
  body: { fontSize: 14.5, color: '#1f2937', lineHeight: 22, marginTop: 16 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  linkText: { color: '#1d4ed8', fontSize: 13.5, fontWeight: '600' },
  filesBlock: { marginTop: 18 },
  filesLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.5, marginBottom: 8 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileText: { fontSize: 13, color: '#374151' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginTop: 20 },
});
