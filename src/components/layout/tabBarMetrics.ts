// WaveTabBar ekranın altında YÜZEN mutlak konumlu bir hap; normal akışta yer
// kaplamıyor. Bu yüzden kaydırılabilir her ekranın içeriği, sonuna gelindiğinde
// son öğe bar'ın altında kalmasın diye kendi alt boşluğunu bırakmak zorunda
// (kullanıcı bunu Araçlar sayfasında fark etti: son kartın üstüne biniyordu).
//
// Bar'ın yüksekliği + alt kenar boşluğu + jest çubuğu için pay + biraz nefes:
// 50 + 10 → cihaz alt güvenli alanı (≤34) → toplamı rahatça aşan tek bir sayı.
// Aynı değer NativeWind sınıfı olarak `pb-[110px]` biçiminde de kullanılıyor;
// ikisi birbirinden sapmasın diye buradaki yorumla birlikte tutuluyorlar.
export const TAB_BAR_HEIGHT = 50;
export const TAB_BAR_BOTTOM_MARGIN = 10;
export const TAB_BAR_SAFE_PADDING = 110;
