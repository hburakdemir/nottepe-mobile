import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistedClient, PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';

// KATMAN 2 — cache'i diske yaz (madde 10).
//
// Katman 1 (react-query'nin bellek içi cache'i) uygulama AÇIKKEN tekrar tekrar
// yükleme görmeyi bitirdi. Bu katman ise uygulamayı KAPATIP AÇMAYI hedefliyor:
// yemek listesi, SSS ve takip edilen bölümler soğuk açılışta diskten anında
// geliyor, ağ isteği arkada sessizce tazeliyor.
//
// Testçilerde eski Android cihazlar da var ve orada en pahalı şey ağ isteğinin
// kendisi değil, isteğin dönüşünü bekleyen boş ekran. Asıl kazanç orada.

// NELERİN DİSKE YAZILACAĞI BİLEREK ÇOK DAR.
//
// "Her şeyi kalıcı yap" cazip ama yanlış: AsyncStorage yazma işlemi ana
// thread'i meşgul eden bir köprü çağrısı ve yazılan veri büyüdükçe her
// tazelemede bedel ödenir — yani cihazı yavaşlatmamak için konan kural
// ("önbellek cihazı yavaşlatmayacak şekilde kısıtlı noktalarda artırılabilir")
// tam da burada uygulanıyor.
//
// Ölçüt üç şart birden: (1) yavaş değişiyor, (2) küçük, (3) bayat görünmesi
// zarar vermiyor.
//
//   'menu'        → yemek listesi. Gün içinde değişmiyor, birkaç KB.
//   'faq'         → SSS. Moderasyondan geçiyor, neredeyse statik.
//   'departments' → takip edilen bölümler. Sadece birkaç isim.
//
// DIŞARIDA BIRAKILANLAR ve sebepleri:
//   'notifications'           → tazelik şart; bayatı yanlış bilgi demek
//   'savedPosts', 'checklists', 'noteRequests', 'suggestions' → kullanıcı
//        kendi değiştiriyor, diskten gelen eski hâli kafa karıştırır
//   'leaderboard'             → sürekli değişiyor, kalıcı olmasının anlamı yok
//   'schedule'                → EN ÖNEMLİ İSTİSNA: o sorgu `staleTime: Infinity`
//        kullanıyor (düzenleyici ekran, arka plan tazelemesi kullanıcının
//        düzenlemesini ezmesin diye). Diske yazılsaydı "sonsuza kadar taze"
//        sayılan bayat bir kopya geri yüklenir ve BİR DAHA HİÇ tazelenmezdi.
//        İkisi bir arada kullanılamaz.
const PERSISTED_KEY_ROOTS = new Set(['menu', 'faq', 'departments']);

// AKIŞ (ana sayfa) AYRI BİR KURALLA EKLENDİ — yukarıdaki üç şartı karşılamıyor
// (hızlı değişiyor) ama ölçülen bedeli her şeyden ağır: ana sayfada iskeleti
// bekleten TEK şey `/posts/getpost?page=1` isteğiydi, yani her soğuk açılış
// 2-3 saniye boş ekran demekti (kullanıcı bildirdi).
//
// Bayatlık neden zarar vermiyor: geri yüklenen veri `staleTime: 60_000`
// yüzünden açılış anında zaten "bayat" sayılıyor, react-query onu ekrana
// basar basmaz arkada tazeliyor. En kötü hâl, tek bir istek süresi boyunca
// ≤24 saatlik (bkz. MAX_AGE_MS) ilk sayfayı görmek — öncesi o sürede hiçbir
// şey görmemekti.
//
// YALNIZCA FİLTRESİZ AKIŞ: anahtar `['posts', search, faculty]`. Arama ve
// fakülte varyantları dışarıda — anahtar uzayı sınırsız (her arama terimi yeni
// bir kayıt) ve diskten gelen bayat bir ARAMA sonucu kafa karıştırır.
function isDefaultFeedKey(key: readonly unknown[]): boolean {
  return key[0] === 'posts' && !key[1] && !key[2];
}

// Bir günden eski hiçbir şey geri yüklenmiyor: kullanıcı uygulamayı bir hafta
// açmadıysa geçen haftanın yemek listesini görmesin.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Akış bir `useInfiniteQuery`: cache'te YÜKLÜ BÜTÜN SAYFALARI tutuyor. Diske
// olduğu gibi yazılsaydı kullanıcı 5 sayfa kaydırdığında her `fetchNextPage`
// sonrası yüz KB'larca veri JS thread'inde `JSON.stringify` edilip AsyncStorage
// köprüsünden geçirilirdi — tam da kaydırma sırasında, yani donma şikayetinin
// üstüne yeni bir sebep eklerdi.
//
// Soğuk açılışta zaten yalnızca İLK SAYFA gerekiyor (gerisini kullanıcı
// kaydırdıkça ağdan gelir), o yüzden yazmadan hemen önce sayfa dizileri ilk
// elemana kırpılıyor. Kırpma yalnızca diske giden kopyada: bellekteki sorgu
// dokunulmuyor, kullanıcının kaydırma geçmişi kaybolmuyor.
function trimFeedToFirstPage(client: PersistedClient): PersistedClient {
  const queries = client.clientState?.queries;
  if (!queries?.length) return client;

  let touched = false;
  const trimmed = queries.map((query) => {
    if (!isDefaultFeedKey(query.queryKey as readonly unknown[])) return query;
    const data = query.state?.data as { pages?: unknown[]; pageParams?: unknown[] } | undefined;
    if (!data?.pages || data.pages.length <= 1) return query;
    touched = true;
    return {
      ...query,
      state: {
        ...query.state,
        data: { pages: data.pages.slice(0, 1), pageParams: (data.pageParams ?? []).slice(0, 1) },
      },
    };
  });

  if (!touched) return client;
  return { ...client, clientState: { ...client.clientState, queries: trimmed } };
}

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'NOTTEPE_QUERY_CACHE_V1',
  // Yazma işlemi topaklanıyor: her sorgu güncellemesinde değil, en fazla 2
  // saniyede bir diske iniliyor.
  throttleTime: 2000,
  serialize: (client) => JSON.stringify(trimFeedToFirstPage(client)),
});

// Sürüm değişince eski cache tamamen atılıyor. Bir sürümde sorgu yanıtının
// şekli değişirse, diskteki eski şekle göre çizilen ekran çökebilir; `buster`
// bunu imkânsız kılıyor.
const buster = String(Constants.expoConfig?.version ?? 'dev');

// Çıkışta diskteki kopyayı da SİL.
//
// `queryClient.clear()` belleği boşaltıyor ve persister bunu er ya da geç
// diske yazacak — ama yazma 2 saniye topaklanıyor. Kullanıcı çıkış yapıp
// uygulamayı hemen kapatırsa o yazma hiç gerçekleşmez ve bir sonraki açılışta
// ÖNCEKİ HESABIN verisi geri yüklenir. Persist edilenler arasında
// 'departments' (takip edilen bölümler) var ve o kullanıcıya özel — yani bu
// teorik bir risk değil, hesaplar arası veri sızıntısı olurdu.
export async function clearPersistedQueryCache(): Promise<void> {
  try {
    await persister.removeClient();
  } catch {
    // Diskteki kopyayı silememek çıkışı engellememeli.
  }
}

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: MAX_AGE_MS,
  buster,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      // Yalnızca BAŞARILI sorgular yazılıyor: hata durumundaki bir sorguyu
      // diske yazmak, sonraki açılışta hatayı da geri yüklemek olurdu.
      if (query.state.status !== 'success') return false;
      const key = query.queryKey as readonly unknown[];
      if (isDefaultFeedKey(key)) return true;
      const root = key?.[0];
      return typeof root === 'string' && PERSISTED_KEY_ROOTS.has(root);
    },
  },
};
