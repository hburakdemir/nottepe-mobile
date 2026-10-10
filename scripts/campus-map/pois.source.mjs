// Kampüs haritasının ELLE seçilmiş kaynağı. build.mjs bunu okuyup OSM'den
// koordinat/şekil çözüyor; buradaki her `osm` referansı OSM'de gerçekten var
// olan bir öğe (2026-10-03'te Overpass'ta tek tek bakıldı).
//
// Tek veri kaynağı OSM: başka sitelerden metin/koordinat alınmıyor
// (ODbL; haritada "© OpenStreetMap katkıcıları" atfı ZORUNLU).
//
// Bilerek DIŞARIDA bırakılanlar:
// - Beytepe doğusundaki "Kapalı Yüzme Havuzu", "77./78. Yurt", "Yurtlar Spor
//   Salonu" — 32.744 boylamının doğusu Bilkent; OSM'deki Bilkent "Merkez
//   Kampüs Ring" durakları (78. Yurt, 72. Yurt) tam orada. Hacettepe'nin
//   olimpik havuzu OSM'de Hacettepe adıyla kayıtlı değil; tahminle pin
//   koymuyoruz.
// - Sıhhiye kutusunun batısı (Morfoloji, Dil ve Tarih-Coğrafya, "Kütüphane",
//   "Öğrenci İşleri") Ankara Üniversitesi'ne ait.

export const CATEGORIES = ['Fakülte', 'İdari', 'Kütüphane', 'Yurt', 'Yemek', 'Spor', 'Kültür', 'Sağlık', 'Hizmet'];

export const CAMPUSES = [
  {
    key: 'beytepe',
    name: 'Beytepe Kampüsü',
    // Kuzeyde Kongre Merkezi ve Atletik Spor Kompleksi'ni, güneyde Hukuk'u
    // kapsıyor; doğu sınırı Bilkent'e girmeden kesiliyor.
    bbox: { s: 39.8600, w: 32.7260, n: 39.8870, e: 32.7450 },
    // Metroya giden yol koridoru — yalnızca bağlam çizgisi (ana yollar + M2).
    corridor: { s: 39.8860, w: 32.7180, n: 39.9100, e: 32.7520 },
    transit: {
      kind: 'bus',
      line: {
        ref: '130',
        name: '130 Ring',
        relation: 16026119,
        // EGO: Hukuk Fakültesi kalkışından Beytepe Metro'ya 7 dk
        // (bkz. Ego130ScheduleScreen.tsx — "kalkış + 7 dk").
        tripMin: 7,
        tripFrom: 'node/9431296533', // Hukuk Fakültesi (kalkış perornu)
        board: { osm: 'node/11011408249', name: 'Beytepe Metro İstasyonu', rail: 'M2' },
        // Metrodan kampüse gelen yöndeki iniş durakları (relation sırasıyla).
        alight: [
          { osm: 'node/11011408251', name: 'Kültür Kongre Salonu' },
          { osm: 'node/6321657006', name: 'Fakülteler' },
          { osm: 'node/11011408253', name: 'Öğrenci Evleri' },
          { osm: 'node/11011408255', name: 'Mühendislik Fakültesi' },
          { osm: 'node/11011408241', name: 'Hukuk Fakültesi' },
        ],
      },
      options: [
        { id: 'metro', label: 'Metrodan · 130' },
        { id: 'stop', label: 'Duraktan yürü' },
      ],
    },
    pois: [
      // — Fakülte ve bölümler —
      { id: 'egitim', name: 'Eğitim Fakültesi', cat: 'Fakülte', osm: 'relation/19729729' },
      { id: 'edebiyat', name: 'Edebiyat Fakültesi', cat: 'Fakülte', osm: 'node/11341485827' },
      { id: 'iibf', name: 'İktisadi ve İdari Bilimler Fakültesi', short: 'İİBF', cat: 'Fakülte', osm: 'way/423400042' },
      { id: 'hukuk', name: 'Hukuk Fakültesi', cat: 'Fakülte', osm: 'way/422817504' },
      { id: 'iletisim', name: 'İletişim Fakültesi', cat: 'Fakülte', osm: 'node/12228285006' },
      { id: 'mimarlik', name: 'Mimarlık Fakültesi', cat: 'Fakülte', osm: 'node/13928604411' },
      { id: 'gsf', name: 'Güzel Sanatlar Fakültesi', cat: 'Fakülte', osm: 'way/783145125' },
      { id: 'heykel', name: 'Heykel Bölümü', cat: 'Fakülte', osm: 'way/783145126' },
      { id: 'spor-fak', name: 'Spor Bilimleri Fakültesi', cat: 'Fakülte', osm: 'way/423211449' },
      { id: 'ydyo', name: 'Yabancı Diller Yüksekokulu', short: 'YDYO', cat: 'Fakülte', osm: 'way/422817423' },
      { id: 'sbmyo', name: 'Sosyal Bilimler Meslek Yüksekokulu', cat: 'Fakülte', osm: 'way/423400065' },
      { id: 'bil-muh', name: 'Bilgisayar ve Yapay Zekâ Mühendisliği', cat: 'Fakülte', osm: 'way/423400122' },
      { id: 'eem', name: 'Elektrik ve Elektronik Mühendisliği', cat: 'Fakülte', osm: 'way/423400068' },
      { id: 'endustri', name: 'Endüstri Mühendisliği', cat: 'Fakülte', osm: 'way/423391389' },
      { id: 'insaat', name: 'İnşaat Mühendisliği', cat: 'Fakülte', osm: 'way/422817415' },
      { id: 'makine', name: 'Makine Mühendisliği', cat: 'Fakülte', osm: 'way/422817419' },
      { id: 'kimya-muh', name: 'Kimya Mühendisliği', cat: 'Fakülte', osm: 'way/423385856' },
      { id: 'gida', name: 'Gıda Mühendisliği', cat: 'Fakülte', osm: 'way/387637766' },
      { id: 'harita', name: 'Harita Mühendisliği', cat: 'Fakülte', osm: 'way/422817500' },
      { id: 'jeoloji', name: 'Jeoloji Mühendisliği', cat: 'Fakülte', osm: 'way/423400035' },
      { id: 'fizik-muh', name: 'Fizik Mühendisliği', cat: 'Fakülte', osm: 'way/423400038' },
      { id: 'nukleer', name: 'Nükleer Enerji Mühendisliği', cat: 'Fakülte', osm: 'way/423400069' },
      { id: 'biyoloji', name: 'Biyoloji Bölümü', cat: 'Fakülte', osm: 'way/423385902' },
      { id: 'kimya', name: 'Kimya Bölümü', cat: 'Fakülte', osm: 'node/13928604410' },
      { id: 'matematik', name: 'Matematik Bölümü', cat: 'Fakülte', osm: 'node/13301735401' },
      { id: 'yer-bilimleri', name: 'Yer Bilimleri Binası', cat: 'Fakülte', osm: 'way/423400051' },
      { id: 'fbe', name: 'Fen Bilimleri Enstitüsü', cat: 'Fakülte', osm: 'way/423400058' },
      { id: 'gse', name: 'Güzel Sanatlar Enstitüsü', cat: 'Fakülte', osm: 'way/783145127' },
      { id: 'nee', name: 'Nüfus Etütleri Enstitüsü', cat: 'Fakülte', osm: 'way/423211441' },
      // — İdari —
      { id: 'rektorluk', name: 'Rektörlük', cat: 'İdari', osm: 'way/423400046' },
      { id: 'ogrenci-isleri', name: 'Öğrenci İşleri Daire Başkanlığı', cat: 'İdari', osm: 'way/783145837' },
      { id: 'bidb', name: 'Bilgi İşlem Daire Başkanlığı', cat: 'İdari', osm: 'way/423400039' },
      { id: 'sks', name: 'Sağlık, Kültür ve Spor Daire Başkanlığı', short: 'SKS', cat: 'İdari', osm: 'node/11259630995' },
      { id: 'danisma', name: 'Öğrenci Danışma Merkezi', cat: 'İdari', osm: 'node/11259842662' },
      { id: 'dogramaci', name: 'Doğramacı Binası', cat: 'İdari', osm: 'way/423391394' },
      // — Kütüphane —
      { id: 'kutuphane', name: 'Beytepe Kütüphanesi', cat: 'Kütüphane', osm: 'way/343982637' },
      { id: 'hukuk-kutuphane', name: 'Hukuk Fakültesi Kütüphanesi', cat: 'Kütüphane', osm: 'node/13902341606' },
      // — Yurt —
      { id: 'erkek-yurdu', name: 'Beytepe Erkek Öğrenci Yurdu', cat: 'Yurt', osm: 'way/423410547' },
      { id: 'kiz-yurdu', name: 'Beytepe Kız Öğrenci Yurdu', cat: 'Yurt', osm: 'way/423410548' },
      { id: 'alev-alatli', name: 'Alev Alatlı Kız Öğrenci Yurdu', cat: 'Yurt', osm: 'way/1213002779' },
      { id: 'atatepe', name: 'Atatepe Öğrenci Yaşam Merkezi', cat: 'Yurt', osm: 'way/463839148' },
      { id: 'parlar', name: 'Parlar Kız Öğrenci Evi', cat: 'Yurt', osm: 'way/423211460' },
      { id: 'ogrenci-evleri', name: 'Öğrenci Evleri (A–N Blokları)', cat: 'Yurt', osm: 'way/423211447' },
      // — Yemek —
      { id: 'camli', name: 'Camlı Yemekhane', cat: 'Yemek', osm: 'way/692208743' },
      { id: 'kafeterya', name: 'Öğrenci Kafeteryası', cat: 'Yemek', osm: 'node/5256854939' },
      { id: 'yemekhane', name: 'Öğrenci Yemekhanesi', cat: 'Yemek', osm: 'node/5256854941' },
      // — Spor —
      { id: 'pist', name: 'Beytepe Stadı', cat: 'Spor', osm: 'relation/6286364' },
      { id: 'spor-salonu', name: 'Spor Fakültesi Spor Salonu', cat: 'Spor', osm: 'node/11795527519' },
      { id: 'basket-tenis', name: 'Kapalı Basketbol ve Tenis Kortu', cat: 'Spor', osm: 'way/422817411' },
      { id: 'basket', name: 'Basketbol Sahası', cat: 'Spor', osm: 'way/1064566672' },
      { id: 'atletik', name: 'Atletik Spor Kompleksi', cat: 'Spor', osm: 'node/4228157765' },
      // — Kültür —
      { id: 'kongre', name: 'Tunçalp Özgen Kültür ve Kongre Merkezi', cat: 'Kültür', osm: 'way/423122260' },
      { id: 'tiyatro', name: 'Tiyatro ve Konferans Salonu', cat: 'Kültür', osm: 'way/1215330834' },
      { id: 'yildiz-amfi', name: 'Yıldız Amfi', cat: 'Kültür', osm: 'way/423211465' },
      { id: 'amfitiyatro', name: 'Açık Hava Amfitiyatrosu', cat: 'Kültür', osm: 'way/163315029' },
      { id: 'mae-salonlari', name: 'Mehmet Akif Ersoy ve K Salonları', cat: 'Kültür', osm: 'relation/6286366' },
      { id: 'gunes-saatleri', name: 'Güneş Saatleri Parkı', cat: 'Kültür', osm: 'way/1524755474' },
      { id: 'yesil-vadi', name: 'Yeşil Vadi', cat: 'Kültür', osm: 'node/13902341638' },
      // — Sağlık / Hizmet —
      { id: 'poliklinik', name: 'Beytepe Semt Polikliniği', cat: 'Sağlık', osm: 'way/544163794' },
      { id: 'ptt', name: 'PTT Beytepe Şubesi', cat: 'Hizmet', osm: 'way/1021841172' },
      { id: 'carsi', name: 'Beytepe Alışveriş Merkezi', cat: 'Hizmet', osm: 'way/544164472' },
    ],
  },
  {
    key: 'sihhiye',
    name: 'Sıhhiye Kampüsü',
    // Batıda Sıhhiye M1, doğuda Kurtuluş Ankaray istasyonunu kapsıyor ki
    // yürüme rotaları istasyondan başlayabilsin.
    bbox: { s: 39.9268, w: 32.8530, n: 39.9348, e: 32.8710 },
    transit: {
      kind: 'walk',
      origins: [
        { id: 'm1', label: 'Sıhhiye · M1', name: 'Sıhhiye İstasyonu', rail: 'M1', osm: 'node/670243216' },
        { id: 'ankaray', label: 'Kurtuluş · Ankaray', name: 'Kurtuluş İstasyonu', rail: 'A1', osm: 'node/6053262327' },
      ],
    },
    pois: [
      { id: 'tip', name: 'Tıp Fakültesi', cat: 'Fakülte', osm: 'way/875361617' },
      { id: 'dis', name: 'Diş Hekimliği Fakültesi', cat: 'Fakülte', osm: 'way/421299560' },
      { id: 'shmyo', name: 'Sağlık Hizmetleri Meslek Yüksekokulu', cat: 'Fakülte', osm: 'way/875361615' },
      { id: 'asi', name: 'Aşı Enstitüsü', cat: 'Fakülte', osm: 'node/10579160401' },
      // way/875361613 ("Hacettepe Üniversitesi Hastanesi") bütün yerleşkenin
      // sınırı (~257.000 m²) — seçince tüm alan boyanıyor, yürüme mesafesi de
      // alanın kenarına ölçülüyordu. OSM'deki merkez noktası kullanılıyor.
      { id: 'hastane', name: 'Hacettepe Üniversitesi Hastaneleri', cat: 'Sağlık', osm: 'node/8147891777' },
      { id: 'eriskin', name: 'Erişkin Hastanesi', cat: 'Sağlık', osm: 'way/875361611' },
      { id: 'cocuk', name: 'Çocuk Hastanesi', cat: 'Sağlık', osm: 'way/875361612' },
      { id: 'onkoloji', name: 'Onkoloji Hastanesi', cat: 'Sağlık', osm: 'way/421299572' },
      { id: 'ic-hastaliklari', name: 'İç Hastalıkları', cat: 'Sağlık', osm: 'way/875361624' },
      { id: 'yemekhane', name: 'Öğrenci Yemekhanesi', cat: 'Yemek', osm: 'way/875361608' },
      { id: 'yurt', name: 'Hacettepe Öğrenci Yurdu', cat: 'Yurt', osm: 'way/421299601' },
      { id: 'spor-salonu', name: 'Spor Salonu', cat: 'Spor', osm: 'way/875361645' },
      { id: 'acik-amfi', name: 'Açık Amfi', cat: 'Kültür', osm: 'way/875361609' },
      { id: 'sanat-muzesi', name: 'Sanat Müzesi', cat: 'Kültür', osm: 'way/875361610' },
      { id: 'mae-evi', name: 'Mehmet Akif Ersoy Evi ve Müzesi', cat: 'Kültür', osm: 'way/421299643' },
    ],
  },
];
