import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Bildirim satırlarındaki "sil" ve "okunmadı" aksiyonları CİHAZDA saklanıyor.
//
// Sebep: backend'de bunların karşılığı yok — `userNotificationAPI` yalnızca
// listele / okunmamış-sayısı / HEPSİNİ-okundu-yap sunuyor; tekil okundu
// işaretleme ya da silme ucu bulunmuyor. Sunucuya bu uçlar eklendiğinde
// değiştirilecek tek yer burası: aşağıdaki beş fonksiyonun gövdesi API
// çağrısına döner, ekran kodu aynı kalır.
//
// Sınırı açık olsun: bu tercihler yalnızca bu cihazda geçerli, uygulama
// silinince kaybolur.

const HIDDEN_KEY = 'nottepe_notif_hidden';
const UNREAD_KEY = 'nottepe_notif_unread';

type IdSet = Set<string>;

async function readIds(key: string): Promise<IdSet> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

async function writeIds(key: string, ids: IdSet): Promise<void> {
  // Liste sonsuza kadar büyümesin: en son 500 kayıt yeter, daha eskisi zaten
  // sunucudan da gelmiyor.
  const arr = [...ids].slice(-500);
  AsyncStorage.setItem(key, JSON.stringify(arr)).catch(() => {});
}

export interface NotificationPrefs {
  ready: boolean;
  /** Kullanıcının sildiği (gizlediği) bildirim id'leri. */
  hidden: IdSet;
  /** Kullanıcının elle "okunmadı" yaptığı bildirim id'leri. */
  unread: IdSet;
  hide: (id: string | number) => void;
  /** Silmeyi geri alır — "Geri al" şeridi bunu çağırıyor. */
  unhide: (id: string | number) => void;
  markUnread: (id: string | number) => void;
  markRead: (id: string | number) => void;
}

export function useNotificationPrefs(): NotificationPrefs {
  const [hidden, setHidden] = useState<IdSet>(() => new Set());
  const [unread, setUnread] = useState<IdSet>(() => new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([readIds(HIDDEN_KEY), readIds(UNREAD_KEY)]).then(([h, u]) => {
      if (!alive) return;
      setHidden(h);
      setUnread(u);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const hide = useCallback((id: string | number) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.add(String(id));
      writeIds(HIDDEN_KEY, next);
      return next;
    });
  }, []);

  // `hide`'ın simetriği: aynı anahtarı aynı şekilde yazıyor, yani geri alma da
  // kalıcı (uygulama kapanıp açılsa da satır geri gelmiş kalıyor).
  const unhide = useCallback((id: string | number) => {
    setHidden((prev) => {
      if (!prev.has(String(id))) return prev;
      const next = new Set(prev);
      next.delete(String(id));
      writeIds(HIDDEN_KEY, next);
      return next;
    });
  }, []);

  const markUnread = useCallback((id: string | number) => {
    setUnread((prev) => {
      const next = new Set(prev);
      next.add(String(id));
      writeIds(UNREAD_KEY, next);
      return next;
    });
  }, []);

  const markRead = useCallback((id: string | number) => {
    setUnread((prev) => {
      if (!prev.has(String(id))) return prev;
      const next = new Set(prev);
      next.delete(String(id));
      writeIds(UNREAD_KEY, next);
      return next;
    });
  }, []);

  return { ready, hidden, unread, hide, unhide, markUnread, markRead };
}
