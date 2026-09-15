import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Skeleton } from './Skeleton';
import { useCardSurface } from '../theme/feedTokens';

// Bir not kartının yükleme iskeleti.
//
// NEDEN AYRI BİR BİLEŞEN: bu işaretleme eskiden iki yerde birebir kopyaydı
// (SavedPostsScreen ve ProfileScreen) ve ProfileScreen'deki kopyanın başında
// "aynı uygulamada iki farklı not-kartı iskeleti olmasın" diye bir YORUM
// duruyordu. Yorumla verilen söz, kopyalar ayrıldıkça sessizce çürür: birini
// düzenleyen kişi ötekini görmez. Söz artık koda gömülü — tek kaynak burası.
//
// ⚠️ İSKELET YANLIŞ KARTI AYNALIYORDU. Önceki hâli klasik kartı çiziyordu
// (üstte 34px avatar, ad/tarih, iki metin satırı) ama uygulamada çizilen kart
// `PostCardModern` (bkz. PostCard.tsx'teki POSTCARD_VARIANT). Testçi bunu
// "profil skeletonu klasik olmuş, bizim uygulamayla alakası yok" diye
// bildirdi ve haklıydı: iskelet gelecek içeriğin şeklini göstermiyorsa
// yükleme bitince ekran zıplıyor, yani iskeletin VAR OLMA SEBEBİ ortadan
// kalkıyor.
//
// Artık ölçüler ve sıra `PostCardModern`'ın kendi `styles`'ından birebir
// alınıyor — kabuk (`useCardSurface` + kart metrikleri) dahil. Kartın
// gerçek yerleşimi değişirse bu dosya da güncellenmeli; ikisi aynı sözleşmeyi
// paylaşıyor.
//
// `SkeletonGroup` BİLEREK burada değil, çağıranda: nabız tek bir worklet'ten
// sürülüyor (bkz. Skeleton.tsx) ve bir ekranda genelde birden çok kart art arda
// geliyor — grubu her kartın içine koymak o tekilliği bozardı.
export default function NoteCardSkeleton({ showStatus = false }: { showStatus?: boolean }) {
  const cardSurface = useCardSurface();

  return (
    <View style={[styles.card, cardSurface]}>
      {/* Durum rozeti yalnızca istendiğinde: `PostCardModern`'ın varsayılanı
          `showStatus = false` (ana sayfa, kaydedilenler) ama profil sekmeleri
          onu AÇIK geçiyor (PostsTab). İskelette de aynı koşul olmalı, yoksa
          rozet olmayan listelerde içerik gelince satır yukarı kayar. */}
      {showStatus && <Skeleton width={64} height={19} radius={10} />}

      {/* Künye satırı: fakülte › bölüm. Gerçek metin `numberOfLines={2}` ama
          pratikte tek satır; iki satır varsayıp boş yer bırakmak zıplamayı
          ters yöne çevirirdi. */}
      <View style={styles.crumbRow}>
        <Skeleton width="52%" height={12} radius={4} />
      </View>

      {/* Başlık: fontSize 18 / lineHeight 24. */}
      <Skeleton width="88%" height={18} radius={5} />

      {/* Gövde iki satır: fontSize 13.5 / lineHeight 21. İkinci satır kısa,
          çünkü gerçek metin nadiren tam genişlikte bitiyor. */}
      <Skeleton width="100%" height={13} radius={4} />
      <Skeleton width="68%" height={13} radius={4} />

      {/* Alt satır: 24px avatar + kullanıcı adı + tarih, sağda sayaçlar. */}
      <View style={styles.foot}>
        <Skeleton width={24} height={24} radius={12} />
        <Skeleton width={78} height={12} radius={4} />
        <Skeleton width={52} height={12} radius={4} />
        <View style={styles.stats}>
          <Skeleton width={28} height={12} radius={4} />
          <Skeleton width={28} height={12} radius={4} />
        </View>
      </View>
    </View>
  );
}

// Ölçüler `PostCardModern.tsx` içindeki `styles.card` / `crumbRow` / `foot` /
// `stats` ile BİREBİR aynı — kabuk aynı olmadan iskelet ne kadar doğru çizilse
// de içerik geldiğinde kart kayar.
const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 16,
    gap: 11,
  },
  crumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  stats: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 13 },
});
