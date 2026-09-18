import { fileExtension } from '../theme/feedTokens';

// Backend dosyanın ORİJİNAL ADINI SAKLAMIYOR: elimize `files-1786979593014-
// 827053470.pdf` geliyor (bkz. feedTokens.ts'teki aynı not). Bu dosya o eksiğin
// kapatıldığı yer — türü uzantıdan, kullanıcıya gösterilecek adı da gönderi
// başlığından üretiyoruz.

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  txt: 'text/plain',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
};

// iOS paylaşım sayfası hangi uygulamaları listeleyeceğine MIME'a değil UTI'ye
// bakarak karar veriyor; vermezsek PDF'i "metin dosyası" sanıp Not Defteri'ni
// öneriyor. Tanımadığımız uzantıda hiç vermemek, yanlış vermekten iyi.
const UTI_BY_EXTENSION: Record<string, string> = {
  pdf: 'com.adobe.pdf',
  doc: 'com.microsoft.word.doc',
  docx: 'org.openxmlformats.wordprocessingml.document',
  rtf: 'public.rtf',
  txt: 'public.plain-text',
  ppt: 'com.microsoft.powerpoint.ppt',
  pptx: 'org.openxmlformats.presentationml.presentation',
  xls: 'com.microsoft.excel.xls',
  xlsx: 'org.openxmlformats.spreadsheetml.sheet',
  csv: 'public.comma-separated-values-text',
  jpg: 'public.jpeg',
  jpeg: 'public.jpeg',
  png: 'public.png',
  gif: 'com.compuserve.gif',
  heic: 'public.heic',
};

/**
 * Önce uzantı, sonra dosya sisteminin dosyadan okuduğu gerçek MIME (`File.type`),
 * ikisi de yoksa octet-stream. Sıralama bilinçli: uzantı bizim tür dallanmamızla
 * (`fileKind`) aynı kaynaktan geliyor, `File.type` ise platforma göre değişebiliyor.
 */
export function mimeTypeFor(fileName: string, probed?: string | null): string {
  return MIME_BY_EXTENSION[fileExtension(fileName)] ?? probed ?? 'application/octet-stream';
}

export function utiFor(fileName: string): string | undefined {
  return UTI_BY_EXTENSION[fileExtension(fileName)];
}

// `İ`.toLowerCase() JS'te 'i̇' veriyor (i + birleşen nokta, İKİ kod noktası) ve
// 'I'.toLowerCase() 'i' — yani Türkçe'nin noktalı/noktasız i ayrımı standart
// toLowerCase ile bozuluyor. Harfleri küçültmeden ÖNCE tablodan geçiriyoruz.
const ASCII_BY_TURKISH: Record<string, string> = {
  ç: 'c', Ç: 'c',
  ğ: 'g', Ğ: 'g',
  ı: 'i', I: 'i',
  i: 'i', İ: 'i',
  ö: 'o', Ö: 'o',
  ş: 's', Ş: 's',
  ü: 'u', Ü: 'u',
};

export function turkishSlug(input: string): string {
  return Array.from(input)
    .map((ch) => ASCII_BY_TURKISH[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Paylaşım penceresinde GÖRÜNEN ad. Sunucu adı (`files-1786979593014-…`) bir
 * kullanıcıya gösterilemeyeceği için gönderi başlığını ödünç alıyoruz:
 * "nottepe-veri-yapilari-vize-2.pdf". Başlık yoksa "nottepe-not-2.pdf".
 *
 * Sıra numarası tek dosyalı gönderilerde de veriliyor — aynı gönderiden birkaç
 * dosya paylaşan kullanıcıda dosyaların birbirini ezmemesi bunu gerektiriyor.
 */
export function shareFileName(remoteName: string, index: number, postTitle?: string): string {
  const ext = fileExtension(remoteName);
  const slug = postTitle ? turkishSlug(postTitle) : '';
  const body = slug || 'not';
  const name = `nottepe-${body}-${index + 1}`;
  return ext ? `${name}.${ext}` : name;
}
