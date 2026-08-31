import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={posts}
      keyExtractor={(item) => String(item.id ?? item.post_id)}
      renderItem={({ item }) => <PostCard post={item} />}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>Henüz kaydettiğin bir not yok.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f9fafb' },
  listContent: { padding: 12, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { color: '#6b7280', fontSize: 14 },
});
