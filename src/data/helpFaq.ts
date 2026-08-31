export interface HelpFaqItem {
  q: string;
  a: string;
}

const helpFaq: HelpFaqItem[] = [
  {
    q: 'Not paylaştım ama listede görünmüyor, neden?',
    a: 'Paylaştığın notlar herkese açık olmadan önce moderatör/admin onayından geçer. Onaylanana kadar sadece sen görürsün; onaylanınca ana sayfada ve bölüm sayfasında herkese görünür olur.',
  },
  {
    q: 'Şifremi unuttum, ne yapmalıyım?',
    a: 'Giriş ekranındaki "Şifremi unuttum" linkine dokun, e-posta adresine gelen kodla yeni bir şifre belirle.',
  },
  {
    q: 'E-posta doğrulama kodu gelmedi, ne yapayım?',
    a: 'Giriş ekranında hesabınla giriş yapmayı dene — doğrulanmamışsa "Doğrulama Kodu Gönder" butonu çıkar, kodu tekrar gönderir. Gelmezse spam/gereksiz klasörünü kontrol et.',
  },
  {
    q: 'Rozetler ve seri (streak) nasıl çalışır?',
    a: 'Platforma her gün giriş yaptığında serin bir artar; art arda giriş yapmadığın bir gün olursa seri sıfırlanır. Belirli seri uzunluklarına, onaylı not sayısına, yorum ve puanlama etkinliğine ulaştığında otomatik rozet kazanırsın.',
  },
  {
    q: 'AKTS / GANO hesaplayıcı nasıl kullanılır?',
    a: 'Araçlar menüsünden AKTS/GANO hesaplayıcıyı aç, derslerini ve harf notlarını gir; dönem ve kümülatif ortalaman otomatik hesaplanır. İstersen sonucu profiline kaydedebilirsin.',
  },
  {
    q: 'Bölüm takibi ne işe yarar?',
    a: 'Bir bölümü takip ettiğinde, o bölümde yeni bir not onaylanıp yayınlandığında bildirim alırsın. Bölüm sayfasından takip edebilirsin.',
  },
  {
    q: 'Yemek listesi, checklist ve ders programı nerede?',
    a: 'Hepsi "Araçlar" sekmesi altında: günlük/haftalık yemekhane menüsü, kayıt dönemi/mezuniyet checklistleri ve haftalık ders programı oluşturucu.',
  },
  {
    q: 'Hesabımı silmek veya bir sorunu bildirmek istiyorum, kime ulaşabilirim?',
    a: 'Aşağıdaki iletişim formunu veya doğrudan e-posta/sosyal medya bağlantılarını kullanarak bize ulaşabilirsin — mesajlarını okuyup dönüş yapıyoruz.',
  },
];

export default helpFaq;
