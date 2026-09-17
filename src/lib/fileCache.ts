import { Directory, File, Paths } from 'expo-file-system';
import type { DownloadProgress } from 'expo-file-system';
import { getFileUrl } from './config';

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
const FILES_DIR = 'files';
const SHARE_DIR = 'share';

// Budama eşikleri. Ders notu ekleri 10 MB ile sınırlı (bkz. AddPostScreen), yani
// 120 MB kabaca son birkaç haftanın okunan notları demek.
const MAX_CACHE_BYTES = 120 * 1024 * 1024;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

// Ağ asılı kalırsa kullanıcı sonsuza kadar spinner izlemesin. api.ts'teki
// axios instance'ının 12 sn'lik timeout'u BURADA GEÇERLİ DEĞİL — bu indirme
// axios'tan değil, expo-file-system'in kendi native yolundan gidiyor. 45 sn,
// 10 MB'lık bir dosyanın yavaş bir mobil bağlantıda inebileceği süre.
const DOWNLOAD_TIMEOUT_MS = 45_000;

function filesDir(): Directory {
  return new Directory(Paths.cache, FILES_DIR);
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

  // Zaman aşımını kullanıcının kendi iptaliyle AYNI sinyale bağlıyoruz: ikisi
  // de indirmeyi `AbortError` ile bitiriyor, çağıran tarafta tek bir dal var.
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  options?.signal?.addEventListener('abort', abortFromCaller);
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    return await File.downloadFileAsync(url, target, {
      // Yarım kalmış bir indirmenin üstüne yazılabilsin; `false` olsaydı
      // dosya zaten var diye hata fırlatıp kullanıcıyı kalıcı olarak kilitlerdi.
      idempotent: true,
      onProgress: options?.onProgress,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    options?.signal?.removeEventListener('abort', abortFromCaller);
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
  await source.copy(pretty, { overwrite: true });
  return pretty;
}

/**
 * Yaşlı ve fazla yer kaplayan ekleri siler. Ateşle-unut: görüntüleyici
 * açılırken çağrılıyor, hatası kullanıcıya yansımıyor — budama yapılamamış
 * olması hiçbir akışı bozmuyor.
 */
export function trimFileCache(): void {
  try {
    const dir = filesDir();
    if (!dir.exists) return;

    const files = dir
      .list()
      .filter((entry): entry is File => entry instanceof File)
      .map((file) => ({ file, at: file.lastModified ?? 0, size: file.size }))
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
