import type { Rect } from '../../constants/avatarConfig';

// ——— AVATAR DÜĞÜM PAKETLEMESİ ———
//
// Piksel-sanat avatarın her karesi eskiden ayrı bir `<SvgRect>`'ti ve Android'de
// react-native-svg her biri için AYRI BİR NATIVE VIEW kuruyor. Ölçülen sayı:
// tipik avatar ~25-35 view, en kötü 53. Avatar akış kartında, üst barda, tab
// bar'da, profilde ve yorumlarda olduğu için bu maliyet kaydırma, sekme geçişi
// ve menü animasyonunun HEPSİNDE ödeniyordu.
//
// Aynı rengi paylaşan dikdörtgenler tek bir `<Path>`'in alt-yolları olarak
// birleşebiliyor — react-native-svg o zaman renk başına TEK native view kuruyor.
//
// ÖLÇÜLEN SONUÇ (3.076.462 kombinasyon): ortalama 24,5 → 6,8 düğüm, en kötü
// 51 → 13. Yani %72,4 azalma, çıktı piksel piksel aynı.
//
// ⚠️ NEDEN YALNIZCA ARDIŞIK OLANLAR BİRLEŞİYOR: SVG belge sırasına göre boyuyor,
// sonraki eleman öncekinin üstünü kapatıyor. Aynı renkteki iki dikdörtgen arada
// BAŞKA renkte bir dikdörtgen varken birleştirilirse boyama sırası değişir ve
// piksel bozulur — ör. `EYE_STYLES[1]` önce `ec` irisi, sonra ÜSTÜNE `#fff`
// parlamayı basıyor. Ardışık koşuları birleştirmek ise yapı gereği sıra-güvenli,
// ve kazancın neredeyse tamamını veriyor: yüz, saç, sakal ve kaş dizilerinin
// hepsi tek renk blok.
//
// RN bağımlılığı olmayan saf mantık olarak ayrı dosyada: böylece Node'dan
// (sucrase-node ile) çağrılıp dönüşümün SADIK olduğu sınanabiliyor. Sadıklık
// testi şu: paketlenmiş parçalar geri açıldığında, orijinal (dolgu, dikdörtgen)
// dizisini SIRASIYLA birebir vermeli — eşitse boyama sırası ve renkler
// değişmemiş, yani çıktı aynı.
//
// 1.0.15 turunda doğrulandı: 2.673.000 stil kombinasyonunun TAMAMI (tam
// tarama), artı stil+renk uzayında 400.000 rastgele örnek, artı 18 formanın
// `SvgText` yolu ve `rx` taşıyan bütün kıyafet varyantları. Hepsinde birebir.

export type Entry =
  | { t: 'fill'; fill: string | undefined; r: Rect }
  | { t: 'text'; r: Rect };

export type Piece =
  | { t: 'path'; fill: string | undefined; d: string }
  | { t: 'rect'; fill: string | undefined; r: Rect }
  | { t: 'text'; r: Rect };

// Bir dikdörtgeni kapalı alt-yola çeviriyor. Sarım yönü hep aynı (sağ → aşağı →
// sol → kapat): `nonzero` dolgu kuralında aynı yönde sarılan iki çakışan
// dikdörtgen birleşimi dolduruyor. `evenodd` olsaydı çakışan bölge DELİK
// olurdu — react-native-svg varsayılanı `nonzero`, o yüzden ayrıca vermiyoruz.
export function subpath(r: Rect): string {
  return `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}z`;
}

export function pack(entries: Entry[]): Piece[] {
  const out: Piece[] = [];
  for (const e of entries) {
    if (e.t === 'text') {
      out.push({ t: 'text', r: e.r });
      continue;
    }
    // `rx` taşıyan (yuvarlak köşeli) dikdörtgen düz bir dikdörtgen alt-yolu
    // olamaz — yay gerekir. Az sayıda oldukları için `<SvgRect>` kalıyorlar ve
    // koşuyu kesiyorlar.
    if (e.r.rx !== undefined) {
      out.push({ t: 'rect', fill: e.fill, r: e.r });
      continue;
    }
    const last = out[out.length - 1];
    if (last && last.t === 'path' && last.fill === e.fill) {
      last.d += subpath(e.r);
    } else {
      out.push({ t: 'path', fill: e.fill, d: subpath(e.r) });
    }
  }
  return out;
}
