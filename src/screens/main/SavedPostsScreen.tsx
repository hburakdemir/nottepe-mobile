import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { Bookmark } from 'lucide-react-native';
import { savedPostsAPI } from '../../lib/api';
import { useSavedPosts } from '../../context/SavedPostContext';
import PostCard from '../../components/PostCard';
import type { Post } from '../../types/post';

export default function SavedPostsScreen() {
  const { savedPosts } = useSavedPosts();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSavedPostsData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await savedPostsAPI.getSavedPosts();
      setPosts(res.data);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedPostsData();
  }, [fetchSavedPostsData, savedPosts.length]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-[60px]">
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-primary dark:bg-darkbgbutton"
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 32, flexGrow: 1 }}
      data={posts}
      keyExtractor={(item) => String(item.id ?? item.post_id)}
      renderItem={({ item }) => <PostCard post={item} />}
      ListEmptyComponent={
        <View className="bg-white rounded-lg p-8 items-center" style={SHADOW_MD}>
          <Bookmark size={48} color="#9ca3af" style={{ marginBottom: 16 }} />
          <Text className="text-gray-500 text-base text-center">Henüz not kaydetmediniz.</Text>
        </View>
      }
    />
  );
}

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};
