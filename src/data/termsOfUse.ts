// Kullanım Koşulları metni — web (/kullanim-kosullari, nottepe client
// src/data/termsOfUse.js) ile AYNI; birini değiştirirsen diğerini de değiştir.
// Metin uygulamaya gömülü, çevrimdışıyken de kayıt ekranından açılabilsin diye.
// **kalın** işaretleri render'da kalın yazılıyor (TermsModal).
export interface TermsBlock {
  text?: string;
  bullets?: string[];
}

export const TERMS: {
  title: string;
  updated: string;
  intro: string;
  sections: { title: string; blocks: TermsBlock[] }[];
} = {
  title: 'Nottepe Kullanım Koşulları',
  updated: '26 Eylül 2026',
  intro:
    "Nottepe, öğrencilerin ders notu, kaynak ve bilgi paylaştığı bir platformdur. Nottepe'ye kayıt olarak ya da Nottepe'yi kullanarak bu koşulları kabul etmiş olursun.",
  sections: [
    {
      title: '1. Nottepe resmi bir üniversite uygulaması değildir',
      blocks: [
        {
          text: 'Nottepe, öğrenciler tarafından geliştirilen bağımsız bir projedir. Hacettepe Üniversitesi ya da başka bir kurumla resmi bir bağı yoktur, onlar adına hareket etmez.',
        },
      ],
    },
    {
      title: '2. Hesabın',
      blocks: [
        {
          bullets: [
            'Kayıt olurken verdiğin bilgilerin doğru olması gerekir.',
            'Hesabının güvenliğinden ve hesabınla yapılan işlemlerden sen sorumlusun.',
            'Hesabını dilediğin zaman Profil → Düzenle → Hesabımı sil yoluyla silebilirsin.',
          ],
        },
      ],
    },
    {
      title: '3. İçerik kuralları',
      blocks: [
        {
          text: 'Paylaştığın gönderi, dosya, yorum, soru, öneri ve isteklerden sen sorumlusun. Aşağıdakileri paylaşmak yasaktır:',
        },
        {
          bullets: [
            'Hakaret, küfür, taciz, tehdit, zorbalık ya da bir kişiyi hedef alan içerik',
            'Nefret söylemi; ırk, etnik köken, din, cinsiyet, cinsel yönelim, engellilik gibi özelliklere dayalı ayrımcılık',
            'Müstehcen, cinsel ya da şiddet içeren içerik',
            'Başkalarının kişisel bilgileri (telefon, adres, kimlik numarası, not dökümü vb.)',
            'Telif hakkıyla korunan ve paylaşma iznin olmayan içerik (ör. yayınevi kitaplarının tamamı)',
            'Sınav kopyası, kopya düzeneği ya da akademik dürüstlüğü ihlal eden içerik',
            'Spam, reklam, yanıltıcı ya da sahte bilgi',
            'Yasalara aykırı her türlü içerik',
          ],
        },
      ],
    },
    {
      title: '4. Uygunsuz içeriğe ve kullanıcılara sıfır tolerans',
      blocks: [
        {
          text: "Nottepe'de uygunsuz içeriğe ve taciz eden kullanıcılara hiçbir şekilde tolerans gösterilmez.",
        },
        {
          bullets: [
            'Gönderiler yayınlanmadan önce yöneticiler tarafından incelenir.',
            'Her içerikteki "…" menüsünden **Bildir** diyerek uygunsuz içeriği bize bildirebilirsin.',
            'Aynı menüden bir kullanıcıyı **engelleyebilirsin**. Engellediğin kişinin içerikleri sana gösterilmez ve engelini istediğin zaman kaldırabilirsin.',
            'Bildirimler en geç **24 saat** içinde incelenir. Kurallara aykırı içerik kaldırılır, içeriği paylaşan kullanıcı uyarılır, gerekirse hesabı geçici ya da kalıcı olarak kapatılır.',
          ],
        },
      ],
    },
    {
      title: "5. Nottepe'nin hakları",
      blocks: [
        {
          text: 'Nottepe, bu koşullara aykırı olduğunu değerlendirdiği içeriği önceden haber vermeden kaldırma, yayınlamama ve kuralları ihlal eden hesapları askıya alma ya da kapatma hakkını saklı tutar.',
        },
      ],
    },
    {
      title: '6. Paylaştığın içerik',
      blocks: [
        {
          text: "Paylaştığın içeriğin sahibi sensin. Paylaşarak, bu içeriğin Nottepe'de diğer kullanıcılara gösterilmesine izin vermiş olursun. İçeriğini sildiğinde ya da hesabını kapattığında içeriğin yayından kaldırılır; yasal zorunluluklar saklıdır.",
        },
      ],
    },
    {
      title: '7. Sorumluluğun sınırı',
      blocks: [
        {
          text: 'Kullanıcıların paylaştığı notlar ve bilgiler Nottepe tarafından doğruluk açısından garanti edilmez. Ders notları yardımcı kaynaktır; resmi bilgiler için ilgili birimlere başvur. Ring saatleri gibi araçlar bilgilendirme amaçlıdır.',
        },
      ],
    },
    {
      title: '8. Kişisel veriler',
      blocks: [
        {
          text: "Kişisel verilerin KVKK Aydınlatma Metni'nde açıklandığı şekilde işlenir.",
        },
      ],
    },
    {
      title: '9. Değişiklikler',
      blocks: [
        {
          text: "Bu koşullar güncellenebilir. Önemli değişiklikleri uygulama içinden duyururuz. Güncellemeden sonra Nottepe'yi kullanmaya devam etmen, yeni koşulları kabul ettiğin anlamına gelir.",
        },
      ],
    },
    {
      title: '10. İletişim',
      blocks: [
        {
          text: 'Soru, görüş ve şikâyetlerin için uygulamadaki Yardım → Bize Yazın formunu kullanabilirsin.',
        },
      ],
    },
  ],
};
