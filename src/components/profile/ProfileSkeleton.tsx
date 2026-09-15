import React from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonGroup } from '../Skeleton';
import NoteCardSkeleton from '../NoteCardSkeleton';
import { useTheme } from '../../context/ThemeContext';
import { SHADOW_MD } from './profileCommon';

// Profil'in yükleme durumu: ekranın ORTASINDA nabız atan tek bir ikon yerine,
// gelecek sayfanın yerleşimini önceden çizen iskelet.
//
// Eskiden burada `LoadingDeer` vardı — markalı ama jenerik bir spinner: "bir
// şey oluyor" demekten başka bilgi vermiyor ve içerik gelince ekran boş
// ortadan dolu sayfaya ZIPLIYOR. İskelet o zıplamayı kaldırıyor; algılanan hız
// farkının asıl kaynağı da bu (bkz. Skeleton.tsx).
//
// ⚠️ ÖNCEKİ HÂLİ GERÇEK DÜZENLE UYUŞMUYORDU ve testçi bunu "profil skeletonu
// klasik olmuş, bizim uygulamayla alakası yok" diye bildirdi. Üç somut hata
// vardı, üçü de zıplama üretiyordu:
//
//  1. Ortalanmış dikey yerleşim (avatar üstte, ad altında) — gerçek başlık
//     YATAY: solda avatar, sağında kimlik sütunu (bkz. HeaderCard.tsx:39-58).
//  2. Avatar DAİRE çiziliyordu (`radius 40`) — gerçeği kare-yuvarlak
//     (`rounded-[20px]`, HeaderCard.tsx:41).
//  3. Bir "sayaç şeridi" (gönderi / kaydedilen / takip) çiziliyordu — böyle bir
//     şerit UYGULAMADA YOK. Sayaçlar sekme şeridinin içinde (TabStrip.tsx).
//     Yani iskelet, gelmeyecek bir bloğa yer ayırıyordu.
//
// Artık kabuklar gerçeğinden birebir alınıyor: başlık kartı
// (`bg-surface p-4 m-4 mb-5 rounded-lg` + SHADOW_MD) ve sekme şeridi
// (`bg-surface rounded-lg mx-4 mb-5`). Kabuk aynı olmadan iç bloklar ne kadar
// doğru çizilse de içerik gelince kart kayar.
//
// Blok GENİŞLİKLERİ bilerek eşit değil: eşit uzunlukta gri çubuklar iskeleti
// "jenerik şablon" gibi gösteriyor, değişken uzunluklar gerçek metne benziyor.
// Marka hissi de buradan ve avatar bloğuna verilen soluk accent zeminden
// geliyor — nabız atan bir geyik ikonu KULLANILMIYOR, o kaldırılan
// `LoadingDeer`'e geri dönüş olurdu.
//
// Not kartları BİLEREK dolu gösteriliyor — kullanıcı isteği: "not varmış gibi
// ekleyelim, skeletonda öyle gözüksün". Boş bir liste iskeleti "hiç notun yok"
// izlenimi verip yükleme bitene kadar yanlış bilgi vermiş olurdu.
//
// Kart işaretlemesi `NoteCardSkeleton`'dan geliyor — SavedPostsScreen ile aynı
// kaynak, bkz. o dosyadaki not.
export default function ProfileSkeleton() {
  const { colors } = useTheme();

  return (
    <SkeletonGroup>
      <View className="flex-1 bg-ground">
        {/* BAŞLIK KARTI — kabuk HeaderCard.tsx:38 ile birebir. */}
        <View className="bg-surface p-4 m-4 mb-5 rounded-lg" style={SHADOW_MD}>
          <View className="flex-row gap-3.5">
            {/* Avatar: 80×80, `rounded-[20px]`. Zemin soluk accent — iskeletin
                tek marka dokunuşu (Skeleton zaten `style` alıyor, yeni prop
                gerekmedi). */}
            <Skeleton width={80} height={80} radius={20} style={{ backgroundColor: colors.accentSoft }} />
            {/* Kimlik sütunu: kullanıcı adı (19px), ad-soyad (13px), e-posta
                (12.5px) — gerçek sırayla. */}
            <View className="flex-1 gap-2 pt-1">
              <Skeleton width="62%" height={19} radius={5} />
              <Skeleton width="44%" height={13} radius={4} />
              <Skeleton width="56%" height={12} radius={4} />
            </View>
          </View>

          {/* Rozet çipleri: gerçekte `flex-wrap gap-2 mt-3.5`. */}
          <View className="flex-row gap-2 mt-3.5">
            <Skeleton width={64} height={22} radius={11} />
            <Skeleton width={50} height={22} radius={11} />
            <Skeleton width={72} height={22} radius={11} />
          </View>

          {/* "Düzenle" düğmesi: tam genişlik, `rounded-[10px] py-2.5 mt-3.5`. */}
          <Skeleton width="100%" height={38} radius={10} style={{ marginTop: 14 }} />
        </View>

        {/* SEKME ŞERİDİ — kabuk TabStrip.tsx:67 ile birebir. Gerçekte "pill"
            değil: yüzey kartı içinde, alt çizgili metin satırları. */}
        <View className="bg-surface rounded-lg mx-4 mb-5 px-4 flex-row items-center" style={{ height: 44 }}>
          {[74, 88, 66, 80].map((w, i) => (
            <View key={i} style={{ marginRight: 18 }}>
              <Skeleton width={w} height={12} radius={4} />
            </View>
          ))}
        </View>

        {/* NOTLAR. Sarmalayıcıda dolgu YOK: `NoteCardSkeleton` gerçek kartın
            metriklerini kendisi taşıyor (marginHorizontal 12 + marginTop 10).
            `showStatus`: profil sekmeleri gerçek kartı durum rozetiyle çiziyor
            (bkz. PostsTab), iskelet de öyle olmalı. */}
        {[0, 1, 2].map((i) => (
          <NoteCardSkeleton key={i} showStatus />
        ))}
      </View>
    </SkeletonGroup>
  );
}
