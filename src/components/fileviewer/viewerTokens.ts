// Dosya görüntüleyici uygulamanın TEMASINA BAKMIYOR, her iki temada da koyu.
//
// Gerekçe: bu ekranda içeriğin kendi rengi değerlendiriliyor. Açık temada beyaz
// bir zeminin üstüne beyaz bir PDF sayfası ya da beyaz arka planlı bir taranmış
// not koymak sayfanın nerede bittiğini görünmez yapıyor; fotoğraflarda da açık
// zemin pozlamayı olduğundan parlak gösteriyor. Galeri uygulamalarının tamamı
// aynı sebeple koyu.
//
// Bu yüzden palette.ts'in token'ları yerine buradaki sabitler kullanılıyor —
// bilinçli bir sapma, tema sisteminin unutulması değil.
export const VIEWER_BG = '#0B0E12';

// Başlık şeridi: içeriğin üstüne biniyor, tam opak değil ki altındaki sayfanın
// devam ettiği belli olsun.
export const VIEWER_CHROME = 'rgba(11,14,18,0.92)';

export const VIEWER_INK = '#FFFFFF';
export const VIEWER_INK_DIM = '#9AA4B2';
export const VIEWER_LINE = 'rgba(255,255,255,0.12)';

// palette.ts'teki DARK accent'in aynısı: koyu zeminde okunaklı olduğu zaten
// uygulamanın geri kalanında kanıtlanmış.
export const VIEWER_ACCENT = '#5A9690';
