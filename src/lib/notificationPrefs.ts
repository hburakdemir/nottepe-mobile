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

export type NotificationKind = 'announcement' | 'activity';

// Duyuru ve Aktivite id'leri AYRI tablolardan geliyor, yani aynı sayısal id
// iki türde de var olabilir. Anahtarları türle öneklemeden saklarsak (eski
// davranış) bir duyuruyu "okunmadı" yapmak, aynı id'ye sahip bir aktivite
// bildirimini de okunmamış gösterebilirdi — bkz. useUnreadNotifications'taki
// yerel-üst-ekleme mantığı, bu önek olmadan güvenli değil.
function keyFor(kind: NotificationKind, id: string | number): string {
  return `${kind}:${id}`;
}

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

// `useNotificationPrefs` her çağrıldığı yerde KENDİ React state'ini tutuyor
// (bkz. yukarıdaki yorum) — `NotificationsScreen`'deki liste ile rozet
// sayısını hesaplayan `useUnreadAnnouncements` (farklı bir bileşende/hook'ta)
// birbirinden habersiz iki ayrı örnek. Elle "okunmadı" yapılan bir duyuru bu
// yüzden listede okunmamış görünse de rozet sayısına hiç yansımıyordu. Bu
// fonksiyon, React state'e hiç girmeden AsyncStorage'daki GÜNCEL tercihleri
// tek seferlik okuyor — rozet sorgusu her çalıştığında (invalidate sonrası)
// bunu çağırıp sunucu verisiyle birleştiriyor.
export async function readNotificationPrefsSnapshot(): Promise<{ hidden: IdSet; unread: IdSet }> {
  const [hidden, unread] = await Promise.all([readIds(HIDDEN_KEY), readIds(UNREAD_KEY)]);
  return { hidden, unread };
}

// Rozet hesapları (bkz. useUnreadNotifications) bu önekli anahtarları
// doğrudan okumak zorunda kalmasın diye tek yerden.
export function hasLocalOverride(set: IdSet, kind: NotificationKind, id: string | number): boolean {
  return set.has(keyFor(kind, id));
}

export interface NotificationPrefs {
  ready: boolean;
  /** Kullanıcının sildiği (gizlediği) bildirim id'leri (önekli: "kind:id"). */
  hidden: IdSet;
  /** Kullanıcının elle "okunmadı" yaptığı bildirim id'leri (önekli: "kind:id"). */
  unread: IdSet;
  hide: (kind: NotificationKind, id: string | number) => void;
  /** Silmeyi geri alır — "Geri al" şeridi bunu çağırıyor. */
  unhide: (kind: NotificationKind, id: string | number) => void;
  markUnread: (kind: NotificationKind, id: string | number) => void;
  markRead: (kind: NotificationKind, id: string | number) => void;
  isHidden: (kind: NotificationKind, id: string | number) => boolean;
  isUnread: (kind: NotificationKind, id: string | number) => boolean;
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

  const hide = useCallback((kind: NotificationKind, id: string | number) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.add(keyFor(kind, id));
      writeIds(HIDDEN_KEY, next);
      return next;
    });
  }, []);

  // `hide`'ın simetriği: aynı anahtarı aynı şekilde yazıyor, yani geri alma da
  // kalıcı (uygulama kapanıp açılsa da satır geri gelmiş kalıyor).
  const unhide = useCallback((kind: NotificationKind, id: string | number) => {
    setHidden((prev) => {
      const key = keyFor(kind, id);
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      writeIds(HIDDEN_KEY, next);
      return next;
    });
  }, []);

  const markUnread = useCallback((kind: NotificationKind, id: string | number) => {
    setUnread((prev) => {
      const next = new Set(prev);
      next.add(keyFor(kind, id));
      writeIds(UNREAD_KEY, next);
      return next;
    });
  }, []);

  const markRead = useCallback((kind: NotificationKind, id: string | number) => {
    setUnread((prev) => {
      const key = keyFor(kind, id);
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      writeIds(UNREAD_KEY, next);
      return next;
    });
  }, []);

  const isHidden = useCallback((kind: NotificationKind, id: string | number) => hidden.has(keyFor(kind, id)), [hidden]);
  const isUnread = useCallback((kind: NotificationKind, id: string | number) => unread.has(keyFor(kind, id)), [unread]);

  return { ready, hidden, unread, hide, unhide, markUnread, markRead, isHidden, isUnread };
}
