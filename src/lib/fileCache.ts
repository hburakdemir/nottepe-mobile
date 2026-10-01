import { Directory, File, Paths } from 'expo-file-system';
import { createDownloadResumable } from 'expo-file-system/legacy';
import { getFileUrl } from './config';

// İNDİRME NEDEN `legacy` YOLUNDAN GİDİYOR.
//
// Bu proje SDK 54'te, yani expo-file-system 19. Oradaki `DownloadOptions`
// yalnızca `{ headers?, idempotent? }` — `onProgress` ve `signal` alanları
// 56.0.0'da eklendi (doğrulandı: build/ExpoFileSystem.types.d.ts:136).
//
// Yani yeni sınıf API'siyle indirirsek YÜZDE GÖSTERGESİ DE İPTAL DE OLMUYOR.
// İptalin olmaması yalnızca kozmetik bir kayıp değil: kullanıcı 10 MB'lık bir
// PDF'in yarısında slaytı kaydırırsa indirme mobil veriyi yemeye devam eder.
//
// `expo-file-system/legacy` bunların ikisini de veriyor
// (`createDownloadResumable` + `.cancelAsync()`). Expo bu yolu "legacy"
// damgaladı ama SDK 54'te desteklenen ve belgelenen yol bu. SDK 56+'ya
// çıkıldığında buradaki gövde sınıf API'sine geri alınabilir — o zaman
// aşağıdaki `DownloadProgress` tipi de expo-file-system'den import edilir.

// Gönderi ekleri diske burada iniyor. İki ayrı dizin var ve ayrım bilinçli:
//
//   files/  → indirilen ekin kendisi, sunucudaki adıyla. Önbellek anahtarı bu.
//   share/  → paylaşım penceresine verilecek OKUNAKLI adlı kopya (bkz.
//             utils/fileMeta.ts). Paylaşım sayfasında görünen ad dosyanın
//             diskteki adı olduğu için, önbellek anahtarını bozmadan ikinci bir
//             kopya çıkarmak zorundayız.
//
// İkisi de `Paths.cache` altında: bunlar kullanıcı verisi değil, her an
// sunucudan yeniden indirilebilir. Sistem yer darlığında silebilir — bu yüzden
// bir dosyanın URI'si ASLA kalıcı state'te (AsyncStorage, react-query persist)
// tutulmuyor; her açılışta `exists` tek doğru kaynak.
// `files` → `files-v2`: durum kodu kontrolünden önce indirilmiş ekler arasında
// HTML gövdeli bozuk kopyalar olabilir; eski dizin trimFileCache'te siliniyor.
// `files-v2` → `files-v3`: 1.0.27'ye kadar yarıda kesilen indirmeler asıl ada
// yazılıp önbellekte YARIM dosya bırakabiliyordu; temiz bir başlangıç.
const FILES_DIR = 'files-v3';
const LEGACY_FILES_DIRS = ['files', 'files-v2'];
// Süren indirmelerin yarım hâli. `files-v3`'ün DIŞINDA: liste/budama onları
// ek sanmasın.
const PARTS_DIR = 'files-parts';
const SHARE_DIR = 'share';

// Budama eşikleri. Ders notu ekleri 10 MB ile sınırlı (bkz. AddPostScreen), yani
// 120 MB kabaca son birkaç haftanın okunan notları demek.
const MAX_CACHE_BYTES = 120 * 1024 * 1024;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

// Ağ asılı kalırsa kullanıcı sonsuza kadar spinner izlemesin. api.ts'teki
// axios instance'ının 12 sn'lik timeout'u BURADA GEÇERLİ DEĞİL — bu indirme
// axios'tan değil, expo-file-system'in kendi native yolundan gidiyor.
//
// TOPLAM süre değil, İLERLEMESİZ süre: eskiden sabit 45 sn'lik bir tavan vardı
// ve yavaş bağlantıda büyük bir PowerPoint düzgün inerken bile yarıda
// kesiliyordu. Bayt geldiği sürece indirme sürüyor; 20 sn hiç bayt gelmezse
// bağlantı ölü sayılıyor.
const DOWNLOAD_STALL_MS = 20_000;

function filesDir(): Directory {
  return new Directory(Paths.cache, FILES_DIR);
}

function partsDir(): Directory {
  return new Directory(Paths.cache, PARTS_DIR);
}

function shareDir(): Directory {
  return new Directory(Paths.cache, SHARE_DIR);
}

function ensureDir(dir: Directory): Directory {
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Sunucu adı zaten benzersiz (`files-<zaman>-<rastgele>.pdf`), o yüzden
 * hash'lemeye gerek yok — üstelik uzantıyı koruduğu için paylaşımda MIME ve
 * UTI doğru çıkıyor. Tek iş, yol enjeksiyonuna karşı son bileşeni almak:
 * `file_urls` sunucudan geliyor ve `/uploads/...` önekiyle de gelebiliyor.
 */
function safeKey(remoteName: string): string {
  const base = remoteName.split('/').pop() ?? '';
  if (!base || base === '.' || base === '..') throw new Error('Geçersiz dosya adı');
  return base;
}

export function cachedFile(remoteName: string): File {
  return new File(filesDir(), safeKey(remoteName));
}

/** iOS WebView'ına verilen okuma izninin kapsamı (bkz. IosDocSlide). */
export function cachedFilesDirUri(): string {
  return filesDir().uri;
}

/**
 * İlerleme olayının şekli. Alan adları BİLEREK `bytesWritten` / `totalBytes` —
 * SDK 56+'daki sınıf API'sinin verdiği adlar bunlar. Legacy API farklı adlar
 * kullanıyor (`totalBytesWritten` / `totalBytesExpectedToWrite`) ve aşağıda
 * çevriliyor; böylece çağıran taraf (`useCachedFile`) SDK'dan bağımsız kalıyor
 * ve yükseltmede hiç değişmiyor.
 *
 * `totalBytes` sunucu `Content-Length` göndermezse **-1** oluyor; çağıran taraf
 * bunu belirsiz gösterge olarak ele alıyor.
 */
export interface DownloadProgress {
  bytesWritten: number;
  totalBytes: number;
}

export interface EnsureOptions {
  onProgress?: (data: DownloadProgress) => void;
  signal?: AbortSignal;
}

/**
 * Eki önbellekten verir, yoksa indirir. Aynı dosya ikinci kez açıldığında hiç
 * ağa çıkmıyor — bu, çevrimdışıyken daha önce okunmuş bir notu açabilmek
 * demek.
 *
 * `size > 0` kontrolü boş kalmış dosyalar için: indirme yarıda kesilirse diskte
 * 0 baytlık bir kabuk kalabiliyor, `exists` ona da `true` diyor.
 */
export async function ensureCachedFile(remoteName: string, options?: EnsureOptions): Promise<File> {
  ensureDir(filesDir());
  const target = cachedFile(remoteName);
  if (target.exists && target.size > 0) return target;

  const url = getFileUrl(remoteName);
  if (!url) throw new Error('Dosya adresi çözülemedi');

  // İndirme önce `.part` dosyasına yapılıyor, ancak TAM inince asıl adına
  // taşınıyor. Eskiden doğrudan asıl ada yazılıyordu: yarıda kesilen indirme
  // diskte boyutu > 0 olan YARIM bir dosya bırakıyor, yukarıdaki
  // `exists && size > 0` kontrolü onu "önbellekte var" sayıyor ve sonraki her
  // açılışta yarım dosya gösteriliyordu ("PowerPoint yarım gösteriyor").
  const partial = new File(ensureDir(partsDir()), `${safeKey(remoteName)}.part`);
  if (partial.exists) partial.delete();

  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  const armStall = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(cancel, DOWNLOAD_STALL_MS);
  };

  const task = createDownloadResumable(url, partial.uri, {}, (data) => {
    armStall();
    // Legacy adlarından ortak şekle çeviriyoruz (bkz. DownloadProgress).
    options?.onProgress?.({
      bytesWritten: data.totalBytesWritten,
      totalBytes: data.totalBytesExpectedToWrite,
    });
  });

  // Zaman aşımı ve kullanıcının kendi iptali AYNI yola bağlanıyor: ikisi de
  // native indirmeyi durduruyor, çağıran tarafta tek bir dal kalıyor.
  let cancelled = false;
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    // İptalin kendisi başarısız olursa yapacak bir şey yok; asıl olan
    // aşağıdaki `cancelled` bayrağının çağırana hata olarak dönmesi.
    void task.cancelAsync().catch(() => {});
  };

  options?.signal?.addEventListener('abort', cancel);
  armStall();

  try {
    const result = await task.downloadAsync();
    // ⚠️ İptal edilen indirme HATA FIRLATMIYOR, `undefined` dönüyor. Bunu
    // sessizce başarı saymak, diskte olmayan bir dosyayı "hazır" durumuna
    // geçirir ve görüntüleyici boş bir PDF açmaya çalışırdı.
    if (!result || cancelled) throw new Error('İndirme iptal edildi');

    // ⚠️ Legacy indirici HTTP hatasında da FIRLATMIYOR: 403/404'ün ya da bir
    // Cloudflare sayfasının gövdesini dosyanın adıyla diske yazıp başarı
    // dönüyor. Kontrol olmadan `.pdf` adlı bir HTML dosyası önbelleğe giriyor,
    // 14 gün boyunca her açılışta o okunuyor (görüntüleyici boş kalıyor) ve
    // "Dosyalar'a Kaydet" ile paylaşıldığında iPhone onu Chrome'da açıyor.
    // Ekler hiçbir zaman HTML değil; HTML gelmişse yanlış bir şey gelmiştir.
    const contentType = Object.entries(result.headers ?? {})
      .find(([key]) => key.toLowerCase() === 'content-type')?.[1]
      ?.toLowerCase();
    if (result.status !== 200 || contentType?.startsWith('text/html')) {
      throw new Error(`Sunucu dosyayı vermedi (HTTP ${result.status})`);
    }

    // Sunucunun bildirdiği boyutla diskteki boyut tutmuyorsa bağlantı yolda
    // kopmuştur — yarım dosyayı önbelleğe almıyoruz.
    // Sıkıştırılmış yanıtta Content-Length sıkıştırılmış boyut — karşılaştırma
    // anlamsız, atlanıyor (nottepe.com ekleri sıkıştırmadan veriyor; emniyet).
    const header = (name: string) =>
      Object.entries(result.headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1];
    const expected = header('content-encoding') ? 0 : Number(header('content-length'));
    const written = new File(partial.uri);
    if (!written.exists || written.size === 0 || (expected > 0 && written.size !== expected)) {
      throw new Error('Dosya eksik indi');
    }

    if (target.exists) target.delete();
    written.move(target);
    return cachedFile(remoteName);
  } catch (error) {
    try {
      const leftover = new File(partial.uri);
      if (leftover.exists) leftover.delete();
    } catch {
      // Bir sonraki indirme zaten üzerine yazıyor.
    }
    throw error;
  } finally {
    if (stallTimer) clearTimeout(stallTimer);
    options?.signal?.removeEventListener('abort', cancel);
  }
}

/**
 * Paylaşım penceresine verilecek, okunaklı adlı kopya. Aynı ada tekrar
 * paylaşıldığında üzerine yazılıyor — `share/` bir arşiv değil, tek kullanımlık
 * bir çalışma alanı.
 */
export async function stageForSharing(source: File, prettyName: string): Promise<File> {
  ensureDir(shareDir());
  const pretty = new File(shareDir(), prettyName);
  // v19'un `copy()`'si SENKRON ve `overwrite` seçeneği YOK (o 56.0.0'da geldi),
  // üstelik hedef varsa hata fırlatıyor — bu yüzden önce elle siliyoruz.
  // Aynı eki iki kez paylaşmak aksi hâlde ikincide çöküyordu.
  if (pretty.exists) pretty.delete();
  source.copy(pretty);
  return pretty;
}

/**
 * Yaşlı ve fazla yer kaplayan ekleri siler. Ateşle-unut: görüntüleyici
 * açılırken çağrılıyor, hatası kullanıcıya yansımıyor — budama yapılamamış
 * olması hiçbir akışı bozmuyor.
 */
export function trimFileCache(): void {
  for (const name of LEGACY_FILES_DIRS) {
    try {
      const legacy = new Directory(Paths.cache, name);
      if (legacy.exists) legacy.delete();
    } catch {
      // Bir sonraki açılışta yeniden denenir.
    }
  }

  try {
    const dir = filesDir();
    if (!dir.exists) return;

    const files = dir
      .list()
      .filter((entry): entry is File => entry instanceof File)
      // ⚠️ `modificationTime`, `lastModified` DEĞİL. İkincisi 56.0.0'da geldi
      // ve v19'da `undefined` dönerdi — tip hatası da vermezdi. O hâlde her
      // dosya `0` yaşında sayılır, hepsi `cutoff`'un altında kalır ve
      // görüntüleyici HER AÇILIŞTA tüm önbelleği silerdi. Sessiz veri kaybı.
      .map((file) => ({ file, at: file.modificationTime ?? 0, size: file.size }))
      // Yeniden eskiye: yaş sınırını aşanları ve toplam bütçeyi taşıranları
      // sondan kesiyoruz, yani en son okunan notlar en son siliniyor.
      .sort((a, b) => b.at - a.at);

    const cutoff = Date.now() - MAX_AGE_MS;
    let running = 0;

    for (const entry of files) {
      running += entry.size;
      if (entry.at < cutoff || running > MAX_CACHE_BYTES) {
        entry.file.delete();
      }
    }

    // Paylaşım kopyaları tek kullanımlık; görüntüleyici her açıldığında
    // tamamen temizleniyor.
    const staging = shareDir();
    if (staging.exists) staging.delete();
  } catch {
    // Yer açmak en iyi çabadır; başarısızlığı sessiz.
  }
}

// ── Ayarlar > Depolama ───────────────────────────────────────────────────────
//
// Diskteki ad sunucu adı (`files-1760…pdf`), kullanıcıya gösterilemez. Okunaklı
// ad için gönderi başlığı görüntüleyici açılırken bu küçük dizine yazılıyor
// (bkz. FileViewerScreen). Dizin ek klasörünün (`files-v3/`) DIŞINDA: içinde olsaydı
// budama onu da bir ek gibi sayıp silebilirdi. Dizinde kaydı olmayan dosya
// türünün adıyla ("PDF") gösteriliyor — bir şey bozulmuyor.
const TITLES_FILE = 'files-titles.json';

function titlesFile(): File {
  return new File(Paths.cache, TITLES_FILE);
}

function readTitles(): Record<string, string> {
  try {
    const file = titlesFile();
    if (!file.exists) return {};
    const parsed = JSON.parse(file.textSync());
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeTitles(titles: Record<string, string>): void {
  try {
    const file = titlesFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(titles));
  } catch {
    // Yalnızca görüntü adı; yazılamazsa liste türün adını gösterir.
  }
}

/** Görüntüleyici açılırken çağrılıyor; çok dosyalı gönderide sıra numarası ekleniyor. */
export function rememberFileTitles(remoteNames: string[], postTitle?: string): void {
  const title = postTitle?.trim();
  if (!title) return;
  const titles = readTitles();
  remoteNames.forEach((name, i) => {
    try {
      titles[safeKey(name)] = remoteNames.length > 1 ? `${title} (${i + 1})` : title;
    } catch {
      // Geçersiz ad — atla.
    }
  });
  writeTitles(titles);
}

export interface CachedFileEntry {
  key: string;
  title: string | null;
  size: number;
  /** ms; bilinmiyorsa 0 */
  at: number;
}

/** Yeniden eskiye. */
export function listCachedFiles(): CachedFileEntry[] {
  try {
    const dir = filesDir();
    if (!dir.exists) return [];
    const titles = readTitles();
    return dir
      .list()
      .filter((entry): entry is File => entry instanceof File)
      .map((file) => ({
        key: file.name,
        title: titles[file.name] ?? null,
        size: file.size ?? 0,
        at: file.modificationTime ?? 0,
      }))
      .sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export function deleteCachedFile(key: string): void {
  try {
    const file = new File(filesDir(), safeKey(key));
    if (file.exists) file.delete();
    const titles = readTitles();
    if (key in titles) {
      delete titles[key];
      writeTitles(titles);
    }
  } catch {
    // Liste yeniden okunduğunda gerçek durum görünür.
  }
}

export function clearFileCache(): void {
  for (const dir of [filesDir(), shareDir(), partsDir()]) {
    try {
      if (dir.exists) dir.delete();
    } catch {
      // En iyi çaba.
    }
  }
  try {
    const titles = titlesFile();
    if (titles.exists) titles.delete();
  } catch {
    // En iyi çaba.
  }
}
