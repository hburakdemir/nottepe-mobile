// WaveTabBar ekranın altında YÜZEN mutlak konumlu bir hap; normal akışta yer
// kaplamıyor. Bu yüzden kaydırılabilir her ekranın içeriği, sonuna gelindiğinde
// son öğe bar'ın altında kalmasın diye kendi alt boşluğunu bırakmak zorunda
// (kullanıcı bunu Araçlar sayfasında fark etti: son kartın üstüne biniyordu).
//
// Bar'ın yüksekliği + alt kenar boşluğu + jest çubuğu için pay + nefes:
// 50 + 10 → cihaz alt güvenli alanı (≤34) = 94. Eski değer 110'du, yani
// yalnızca 16px nefes bırakıyordu ve bu YETMİYORDU: listelerin sonundaki
// sayfalama çarkı (`ListFooterComponent`, kendi 16px dikey boşluğuyla) tam
// bar'ın arkasına denk gelip "sayfa takıldı" hissi veriyordu — kullanıcı
// bildirdi. 150, çarkın tamamını bar'ın üstünde bırakıyor ve son kart ile bar
// arasına gerçek bir boşluk koyuyor.
//
// Aynı değer NativeWind sınıfı olarak `pb-[150px]` biçiminde de kullanılıyor;
// ikisi birbirinden sapmasın diye buradaki yorumla birlikte tutuluyorlar.
export const TAB_BAR_HEIGHT = 50;
export const TAB_BAR_BOTTOM_MARGIN = 10;
export const TAB_BAR_SAFE_PADDING = 150;
