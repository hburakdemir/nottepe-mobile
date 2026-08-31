import React, { createContext, useContext, useEffect, useState } from 'react';
import { savedPostsAPI } from '../lib/api';
import { useAuth } from './AuthContext';

interface SavedPostsContextValue {
  savedPosts: string[];
  loading: boolean;
  toggleSavePost: (postId: string | number) => Promise<void>;
  fetchSavedPosts: () => Promise<void>;
}

const SavedPostsContext = createContext<SavedPostsContextValue | null>(null);

export const useSavedPosts = () => {
  const context = useContext(SavedPostsContext);
  if (!context) {
    throw new Error('useSavedPosts must be used within a SavedPostsProvider');
  }
  return context;
};

export const SavedPostsProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [savedPosts, setSavedPosts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSavedPosts = async () => {
    if (!isAuthenticated) {
      setSavedPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await savedPostsAPI.getSavedPosts();
      const savedIds = res.data.map((p: any) => String(p._id || p.id || p.postId || p.post_id));
      setSavedPosts(savedIds);
    } catch {
      setSavedPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSavePost = async (postId: string | number) => {
    if (!isAuthenticated) return;
    const id = String(postId);
    try {
      if (savedPosts.includes(id)) {
        await savedPostsAPI.unsavePost(id);
        setSavedPosts((prev) => prev.filter((pid) => pid !== id));
      } else {
        await savedPostsAPI.savePost(id);
        setSavedPosts((prev) => [...prev, id]);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchSavedPosts();
  }, [isAuthenticated]);

  return (
    <SavedPostsContext.Provider value={{ savedPosts, loading, toggleSavePost, fetchSavedPosts }}>
      {children}
    </SavedPostsContext.Provider>
  );
};
