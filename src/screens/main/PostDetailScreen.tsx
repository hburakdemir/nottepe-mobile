import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bookmark, Calendar, ExternalLink, FileText, Star, Trash2, User } from 'lucide-react-native';
import { postsAPI } from '../../lib/api';
import { getFileUrl } from '../../lib/config';
import { useAuth } from '../../context/AuthContext';
import { useSavedPosts } from '../../context/SavedPostContext';
import { useTheme } from '../../context/ThemeContext';
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={isDark ? '#60a5fa' : '#1d4ed8'} />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-500 dark:text-gray-400 text-sm">{error || 'Gönderi bulunamadı.'}</Text>
      </View>
    );
  }

  const isOwner = user && String(user.id) === String(post.user_id);
  const avgRating = Number(post.avg_rating) || 0;
  const ratingCount = post.rating_count || 0;

  return (
    <ScrollView className="flex-1 bg-primary dark:bg-darkbgbutton" contentContainerClassName="px-4 py-6">
      <View className="bg-white dark:bg-darkbgbutton rounded-2xl p-6" style={SHADOW_MD}>
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 text-xl font-bold text-gray-900 dark:text-darktext leading-7">{post.title}</Text>
          <View className="flex-row gap-3.5">
            {isAuthenticated && (
              <Pressable onPress={() => toggleSavePost(postId)} hitSlop={8}>
                <Bookmark
                  size={20}
                  color={isDark ? '#DFD0B8' : isSaved ? '#003161' : '#6b7280'}
                  fill={isSaved ? (isDark ? '#DFD0B8' : '#003161') : 'none'}
                />
              </Pressable>
            )}
            {isOwner && (
              <Pressable onPress={handleDeletePost} hitSlop={8}>
                <Trash2 size={20} color="#f87171" />
              </Pressable>
            )}
          </View>
        </View>

        <View className="flex-row flex-wrap gap-2 mt-5">
          <View className="px-3 py-1 rounded-full bg-brand">
            <Text className="text-white text-xs font-medium">{post.faculty}</Text>
          </View>
          <View className="px-3 py-1 rounded-full bg-brand-light">
            <Text className="text-white text-xs font-medium">{post.department}</Text>
          </View>
        </View>

        <View className="flex-row items-center gap-4 mt-5">
          <Pressable className="flex-row items-center gap-1.5" onPress={() => goToUserProfile(post.username)}>
            <View className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700/40 items-center justify-center">
              <User size={16} color={isDark ? '#DFD0B8' : '#6b7280'} />
            </View>
            <Text className="text-sm text-gray-500 dark:text-gray-400">{post.username || 'Anonim'}</Text>
          </Pressable>
          <View className="flex-row items-center gap-1.5">
            <Calendar size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text className="text-sm text-gray-500 dark:text-gray-400">{formatDate(post.created_at)}</Text>
          </View>
        </View>

        <View className="flex-row items-center gap-1.5 mt-5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={16}
              color={avgRating >= star ? '#eab308' : '#d1d5db'}
              fill={avgRating >= star ? '#eab308' : 'none'}
            />
          ))}
          <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">
            {ratingCount > 0 ? `${avgRating.toFixed(1)}/5 · ${ratingCount} puan` : 'Henüz puan yok'}
          </Text>
        </View>

        <Text className="text-sm text-gray-700 dark:text-darktext leading-[23px] mt-5">{post.content}</Text>

        {post.link ? (
          <Pressable className="flex-row items-center gap-1.5 mt-5" onPress={() => Linking.openURL(post.link!)}>
            <ExternalLink size={16} color={isDark ? '#ffffff' : '#1e3a8a'} />
            <Text className="text-blue-900 dark:text-primary text-sm font-normal">Linki aç</Text>
          </Pressable>
        ) : null}

        {post.file_urls && post.file_urls.length > 0 && (
          <View className="mt-5">
            <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 tracking-[0.3px] mb-1.5">DOSYALAR</Text>
            <View className="flex-row flex-wrap gap-2">
              {post.file_urls.map((fileName, index) => (
                <Pressable
                  key={index}
                  className="flex-row items-center gap-1.5 bg-gray-100 dark:bg-gray-700/40 rounded-lg px-3 py-1.5"
                  onPress={() => Linking.openURL(getFileUrl(fileName))}
                >
                  <FileText size={16} color={isDark ? '#C5D3E8' : '#1e3a8a'} />
                  <Text className="text-sm text-blue-900 dark:text-[#C5D3E8]">{fileName}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View className="h-px bg-gray-100 dark:bg-gray-700/40 mt-5" />

        <CommentSection
          postId={postId}
          postOwnerId={post.user_id}
          isAdmin={user?.role === 'admin' || user?.role === 'moderator'}
          onRatingChange={({ avg_rating, rating_count }) =>
            setPost((prev) => (prev ? { ...prev, avg_rating, rating_count } : prev))
          }
        />
      </View>
    </ScrollView>
  );
}

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};
