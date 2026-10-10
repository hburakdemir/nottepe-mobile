import { useCallback, useEffect, useRef, useState } from 'react';
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
  try {
    await AsyncStorage.setItem(key, JSON.stringify(arr));
  } catch {
    /* yazılamadıysa tercih yalnızca bu oturumda geçerli kalır */
  }
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
  // Dönen söz diske yazılınca çözülüyor: rozet sorgusu (readNotificationPrefsSnapshot)
  // ancak ondan sonra tazelenmeli, yoksa eski değeri okuyor.
  hide: (kind: NotificationKind, id: string | number) => Promise<void>;
  /** Silmeyi geri alır — "Geri al" şeridi bunu çağırıyor. */
  unhide: (kind: NotificationKind, id: string | number) => Promise<void>;
  markUnread: (kind: NotificationKind, id: string | number) => Promise<void>;
  markRead: (kind: NotificationKind, id: string | number) => Promise<void>;
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

  // Yazma setState güncelleyicisinin İÇİNDE değil: React güncelleyiciyi bir
  // sonraki render'a kadar ertelediği için yazma, hemen ardından tazelenen
  // rozet sorgusundan SONRA oluyordu ("okunmadı yaptım, rozet artmadı").
  // Güncel küme ref'te tutuluyor ki ardışık çağrılar birbirini ezmesin.
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const unreadRef = useRef(unread);
  unreadRef.current = unread;

  const updateHidden = useCallback((fn: (next: IdSet) => void) => {
    const next = new Set(hiddenRef.current);
    fn(next);
    hiddenRef.current = next;
    setHidden(next);
    return writeIds(HIDDEN_KEY, next);
  }, []);
  const updateUnread = useCallback((fn: (next: IdSet) => void) => {
    const next = new Set(unreadRef.current);
    fn(next);
    unreadRef.current = next;
    setUnread(next);
    return writeIds(UNREAD_KEY, next);
  }, []);

  const hide = useCallback(
    (kind: NotificationKind, id: string | number) => updateHidden((next) => next.add(keyFor(kind, id))),
    [updateHidden]
  );
  // `hide`'ın simetriği: aynı anahtarı aynı şekilde yazıyor, yani geri alma da
  // kalıcı (uygulama kapanıp açılsa da satır geri gelmiş kalıyor).
  const unhide = useCallback(
    (kind: NotificationKind, id: string | number) => updateHidden((next) => next.delete(keyFor(kind, id))),
    [updateHidden]
  );
  const markUnread = useCallback(
    (kind: NotificationKind, id: string | number) => updateUnread((next) => next.add(keyFor(kind, id))),
    [updateUnread]
  );
  const markRead = useCallback(
    (kind: NotificationKind, id: string | number) => {
      if (!unreadRef.current.has(keyFor(kind, id))) return Promise.resolve();
      return updateUnread((next) => next.delete(keyFor(kind, id)));
    },
    [updateUnread]
  );

  const isHidden = useCallback((kind: NotificationKind, id: string | number) => hidden.has(keyFor(kind, id)), [hidden]);
  const isUnread = useCallback((kind: NotificationKind, id: string | number) => unread.has(keyFor(kind, id)), [unread]);

  return { ready, hidden, unread, hide, unhide, markUnread, markRead, isHidden, isUnread };
}
