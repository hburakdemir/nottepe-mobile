import React from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonGroup } from '../Skeleton';
import NoteCardSkeleton from '../NoteCardSkeleton';

// Profil'in yükleme durumu: ekranın ORTASINDA nabız atan tek bir ikon yerine,
// gelecek sayfanın yerleşimini önceden çizen iskelet.
//
// Eskiden burada `LoadingDeer` vardı — markalı ama jenerik bir spinner: "bir
// şey oluyor" demekten başka bilgi vermiyor ve içerik gelince ekran boş
// ortadan dolu sayfaya ZIPLIYOR. İskelet o zıplamayı kaldırıyor; algılanan hız
// farkının asıl kaynağı da bu (bkz. Skeleton.tsx).
//
// Not kartları BİLEREK dolu gösteriliyor — kullanıcı isteği: "not varmış gibi
// ekleyelim, skeletonda öyle gözüksün". Boş bir liste iskeleti "hiç notun yok"
// izlenimi verip yükleme bitene kadar yanlış bilgi vermiş olurdu.
//
// Kart işaretlemesi `NoteCardSkeleton`'dan geliyor — SavedPostsScreen ile aynı
// kaynak, bkz. o dosyadaki not.
export default function ProfileSkeleton() {
  return (
    <SkeletonGroup>
      <View className="flex-1 bg-ground">
        {/* Başlık: avatar + ad + alt satır. Avatar 80px, gerçek başlıktaki
            `AvatarDisplay size={80}` ile aynı — iskeletten içeriğe geçerken
            avatar yer değiştirmesin. */}
        <View className="items-center pt-8 gap-2.5">
          <Skeleton width={80} height={80} radius={40} />
          <Skeleton width={140} height={16} />
          <Skeleton width={96} height={12} />
        </View>

        {/* Sayaç şeridi (gönderi / kaydedilen / takip) */}
        <View className="flex-row justify-center gap-8 pt-5">
          {[0, 1, 2].map((i) => (
            <View key={i} className="items-center gap-1.5">
              <Skeleton width={32} height={15} />
              <Skeleton width={52} height={10} />
            </View>
          ))}
        </View>

        {/* Sekme şeridi */}
        <View className="flex-row gap-2 px-4 pt-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={72} height={30} radius={15} />
          ))}
        </View>

        {/* Notlar. Sarmalayıcıda artık dolgu/boşluk YOK: `NoteCardSkeleton`
            gerçek kartın metriklerini taşıyor (kendi `marginHorizontal: 12` ve
            `marginTop: 10`'u var), üstüne `p-4 gap-3` eklemek kartları içeriye
            iki kat kaydırıyordu. `showStatus`: profil sekmeleri gerçek kartı
            durum rozetiyle çiziyor (bkz. PostsTab), iskelet de öyle olmalı. */}
        <View className="pt-2">
          {[0, 1, 2].map((i) => (
            <NoteCardSkeleton key={i} showStatus />
          ))}
        </View>
      </View>
    </SkeletonGroup>
  );
}
