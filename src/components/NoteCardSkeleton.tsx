import React from 'react';
import { View } from 'react-native';
import { Skeleton } from './Skeleton';

// Bir not kartının yükleme iskeleti — avatar, ad/tarih satırı ve iki metin
// satırı.
//
// NEDEN AYRI BİR BİLEŞEN: bu işaretleme eskiden iki yerde birebir kopyaydı
// (SavedPostsScreen ve ProfileScreen) ve ProfileScreen'deki kopyanın başında
// "aynı uygulamada iki farklı not-kartı iskeleti olmasın" diye bir YORUM
// duruyordu. Yorumla verilen söz, kopyalar ayrıldıkça sessizce çürür: birini
// düzenleyen kişi ötekini görmez. Söz artık koda gömülü — tek kaynak burası.
//
// `SkeletonGroup` BİLEREK burada değil, çağıranda: nabız tek bir worklet'ten
// sürülüyor (bkz. Skeleton.tsx) ve bir ekranda genelde birden çok kart art arda
// geliyor — grubu her kartın içine koymak o tekilliği bozardı.
export default function NoteCardSkeleton() {
  return (
    <View className="bg-surface rounded-xl p-3.5 border border-line-soft gap-2.5">
      <View className="flex-row items-center gap-2.5">
        <Skeleton width={34} height={34} radius={17} />
        <View className="gap-1.5">
          <Skeleton width={120} height={12} />
          <Skeleton width={80} height={10} />
        </View>
      </View>
      <Skeleton width="95%" height={13} />
      <Skeleton width="70%" height={13} />
    </View>
  );
}
