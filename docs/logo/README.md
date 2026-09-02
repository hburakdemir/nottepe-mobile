# Nottepe Logo Çalışması

Uygulama ikonu için yazısız, Hacettepe kimliğine uygun amblem arayışının notları.

## Araştırma

- Hacettepe Üniversitesi'nin kendi amblemi 1967'de Yücel Tanyeri tarafından,
  Alacahöyük'te bulunan Hitit dönemi bronz geyik heykelciğinden esinlenerek
  çizildi; soyutlanıp küçük "h" harfine benzer hale getirildi.
- Kurumsal renk bordo + beyaz. Tam Pantone/hex değeri kurumsal kimlik
  kılavuzunda (hacettepe.edu.tr) ama bu ortamdan doğrulanamadı; burada
  kullanılan bordo (#7A2038) yaygın referans aralığına dayanıyor — gerçek
  kılavuza erişilirse netleştirilmeli.

## İçerik

- `concept-board.html` — 10 konseptin karşılaştırmalı önizleme sayfası
  (tarayıcıda açılabilir).
- `svg/` — her konseptin tek başına kullanılabilir SVG dosyası. Hepsi aynı
  temel boynuzlu-baş silüetini (`deerMark`) veya "Belirgin N" monogramını
  paylaşıyor, 512×512 canvas üstünde 240×240 viewBox.

| Dosya | Konsept | Stil |
|---|---|---|
| `01-kalem-ucu-cizgisel.svg` | Geyik + Kalem Ucu | çizgisel |
| `02-kalem-ucu-dolu.svg` | Geyik + Kalem Ucu | dolu |
| `03-alacahoyuk-sade.svg` | Alacahöyük Geyiği | sade |
| `04-alacahoyuk-madalyon.svg` | Alacahöyük Geyiği | madalyon |
| `05-belirgin-n-hatli.svg` | Belirgin "N" | hatlı |
| `06-belirgin-n-dolu.svg` | Belirgin "N" | dolu |
| `07-acik-kitap-cizgisel.svg` | Açık Kitap | çizgisel |
| `08-acik-kitap-dolu.svg` | Açık Kitap | dolu |
| `09-lowpoly-faceted.svg` | Low-poly Geyik Başı | faceted |
| `10-lowpoly-rozet-gradient.svg` | Low-poly Geyik Başı | rozet + gradient |
| `11-bolunmus-amblem-dolu.svg` | Bölünmüş Amblem | dolu (bordo+teal) |
| `12-bolunmus-amblem-cizgisel.svg` | Bölünmüş Amblem | çizgisel (bordo+teal) |
| `13-gradyan-rozet-bordo-teal.svg` | Gradyan Rozet | bordo → teal |
| `14-gradyan-rozet-n-teal-bordo.svg` | Gradyan Rozet + N | teal → bordo |
| `15-bolunmus-n-bordo-teal.svg` | Bölünmüş N | bordo + teal |
| `16-teal-zemin-bordo-halka.svg` | Teal Zemin, Bordo Halka | üç renk |
| `17-n-kitap-tek-renk.svg` | N + Kitap | tek renk |
| `18-n-kitap-bordo-teal.svg` | N + Kitap | bordo + teal |
| `19-n-kitap-teal-madalyon.svg` | N + Kitap | teal madalyon |
| `20-aktif-geyik-kalem-bordo-teal.svg` | Aktif Geyik + Kalem | bordo + teal |
| `21-3-kitap-n-tek-renk.svg` | 3 Kitap N | tek renk |
| `22-3-kitap-n-bordo-teal.svg` | 3 Kitap N | bordo + teal |
| `23-nh-monogram-bordo-teal.svg` | NH Monogramı | bordo + teal |
| `24-nh-monogram-teal-madalyon.svg` | NH Monogramı | teal madalyon |
| `25-3-kitap-n-teal-madalyon-bonus.svg` | 3 Kitap N | teal madalyon (bonus) |

11-16 numaralı dosyalar, Nottepe'nin kendi ekranlarında (HomeScreen,
ProfileScreen vb.) zaten kullandığı site rengi olan teal'i (`#2F5755`)
Hacettepe bordo/krem paletiyle aynı markada birleştiriyor.

**Geri bildirim sonrası (17-20):** gradyan numuneleri (13-14) elendi;
"N"in köşegeni artık düz bir bant değil, tek noktadan açılan bir sayfa
yelpazesi (kitap hissi); geyik tek başına durağan bulunduğu için boynuzun
tepesi çok daha belirgin bir dolma kalem ucuna dönüştürüldü.

**Üçüncü tur (21-25):** "N" artık üç boyutlu, sağdan bakılmış, birbirine
devrilen üç kitaptan kuruluyor (ikisi dik, biri köprü gibi devrilmiş),
üst iki köşeden geyik boynuzu çıkıyor. Ayrıca Nottepe + Hacettepe'yi tek
harfte birleştiren bir "NH" bitişik monogramı eklendi — N'in sağ bacağı
ile H'nin sol bacağı aynı gövdeyi paylaşıyor, paylaşılan gövde tam
ortadan teal/bordo bölünerek iki ismin birleştiğini gösteriyor. 25
numara istenmemiş bir bonus: kitap-N'in krem/pirinç tonlu madalyon
versiyonu.

## Palet

| Rol | Hex |
|---|---|
| Bordo (birincil, Hacettepe) | `#7A2038` |
| Bordo koyu | `#4A1220` |
| Krem (ikincil) | `#F3EAD9` |
| Pirinç (vurgu) | `#B9925A` |
| Teal (Nottepe site rengi) | `#2F5755` |

## Sıradaki adım

Bir konsept seçildikten sonra `assets/icon.png`, `assets/android-icon-*.png`,
`assets/favicon.png`, `assets/splash-icon.png` bu SVG'den render edilip
mevcut dosyaların yerine konacak; `app.json` içindeki
`android.adaptiveIcon.backgroundColor` yeni paletle güncellenecek.
