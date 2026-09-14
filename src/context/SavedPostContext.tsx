import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { savedPostsAPI } from '../lib/api';
import { useAuth } from './AuthContext';

// Kaydedilenler listesinin sorgu anahtarı BURADA tanımlı, ekranda değil:
// ekranda olsaydı context onu içe aktarmak zorunda kalır, ekran da zaten
// context'i içe aktardığı için döngü oluşurdu.
export const SAVED_POSTS_KEY = ['savedPosts', 'list'] as const;

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
  const queryClient = useQueryClient();
  const [savedPosts, setSavedPosts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // useCallback ile sabitlenmiş referanslar: bu fonksiyonlar başka ekranlarda
  // (bkz. ProfileScreen.tsx) useCallback/useEffect bağımlılığı olarak
  // kullanılıyor. Sabitlenmemiş bir fonksiyon her render'da yeni referans
  // üretir → ona bağımlı efekt her render'da yeniden tetiklenir → o efekt
  // context state'ini güncelleyip yeniden render'a yol açarsa sonsuz döngü
  // oluşur (yaşandı: profil sayfası sonsuz spinner'da takıldı).
  const fetchSavedPosts = useCallback(async () => {
    if (!isAuthenticated) {
      setSavedPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // `GET /saved-posts/ids` sunucuda mevcut değil (404 dönüyor — bkz. commit
      // notu), bu yüzden id kümesi tam not listesinden (`/saved-posts/getPost`,
      // sayfasız çağrıda çıplak dizi) çıkarılıyor. Sunucu sayı döndürürse küme
      // eşleşmesin diye String()'liyoruz.
      const res = await savedPostsAPI.getSavedPosts();
      const rows = Array.isArray(res.data) ? res.data : (res.data?.posts ?? []);
      setSavedPosts(rows.map((p: any) => String(p.id ?? p.post_id)));
    } catch {
      setSavedPosts([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // OPTİMİSTİK: ikon önce çevrilir, istek arkadan gider. Eskiden `await`
  // bitmeden state değişmiyordu — dokunuş "ölü" hissettiriyordu (bkz.
  // SaveButton.tsx). İstek başarısız olursa aynı işlem tersine çevrilerek geri
  // alınır.
  const toggleSavePost = useCallback(
    async (postId: string | number) => {
      if (!isAuthenticated) return;
      const id = String(postId);
      const wasSaved = savedPosts.includes(id);
      setSavedPosts((prev) => (wasSaved ? prev.filter((pid) => pid !== id) : [...prev, id]));
      try {
        if (wasSaved) {
          await savedPostsAPI.unsavePost(id);
        } else {
          await savedPostsAPI.savePost(id);
        }
        // Kaydedilenler EKRANI ayrı bir sorguda duruyor (SavedPostsScreen).
        // Buradaki iyimser güncelleme yalnız yer imi ikonunu doğru gösterir;
        // liste geçersiz kılınmazsa kullanıcı bir notu kaydedilenlerden
        // çıkarıp o ekrana gittiğinde notu hâlâ listede görürdü.
        queryClient.invalidateQueries({ queryKey: SAVED_POSTS_KEY });
      } catch {
        // Geri al.
        setSavedPosts((prev) => (wasSaved ? [...prev, id] : prev.filter((pid) => pid !== id)));
      }
    },
    [isAuthenticated, savedPosts, queryClient]
  );

  useEffect(() => {
    fetchSavedPosts();
  }, [isAuthenticated]);

  // Aksi hâlde her `toggleSavePost` çağrısında (yeni `savedPosts` referansı
  // yüzünden) yeni bir `value` nesnesi üretilir ve feed'deki TÜM PostCard'lar
  // yeniden render olur.
  const value = useMemo<SavedPostsContextValue>(
    () => ({ savedPosts, loading, toggleSavePost, fetchSavedPosts }),
    [savedPosts, loading, toggleSavePost, fetchSavedPosts]
  );

  return <SavedPostsContext.Provider value={value}>{children}</SavedPostsContext.Provider>;
};
