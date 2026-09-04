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
      // Sadece id kümesi gerektiği için tam not listesi yerine id-only uç
      // (`GET /saved-posts/ids`) çağrılıyor — cevap çıplak bir string dizisi,
      // o yüzden eski `p._id || p.id || ...` alan tahmini map'i gereksiz.
      // Yine de sunucu sayı döndürürse küme eşleşmesin diye String()'liyoruz.
      const res = await savedPostsAPI.getSavedPostIds();
      setSavedPosts(Array.isArray(res.data) ? res.data.map((id: any) => String(id)) : []);
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
