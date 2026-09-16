import React from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonGroup } from '../Skeleton';
import NoteCardSkeleton from '../NoteCardSkeleton';

// Ana sayfanın yükleme durumu. Eskiden ortada tek bir `StateView kind="loading"`
// spinner'ı vardı: "bir şey oluyor" demekten başka bilgi vermiyor ve içerik
// gelince ekran boş ortadan dolu sayfaya ZIPLIYOR.
//
// Yerleşim gerçek başlıkla (bkz. HomeScreen'deki `filterBar`) birebir aynı
// sırada: arama kutusu, fakülte seçici, iki kısayol karesi (124px, `flex-1`),
// sonra not kartları. İçerik geldiğinde hiçbir şey yer değiştirmiyor.
//
// Kart işaretlemesi `NoteCardSkeleton`'dan — Profil ve Kaydedilenler ile aynı
// kaynak (bkz. o dosyadaki not).
export default function HomeSkeleton() {
  return (
    <SkeletonGroup>
      <View className="flex-1 bg-ground">
        <View className="px-4 pt-3 gap-2.5">
          {/* Arama kutusu */}
          <Skeleton width="100%" height={42} radius={10} />
          {/* Fakülte seçici */}
          <Skeleton width="100%" height={42} radius={10} />
        </View>

        {/* İki kısayol karesi — gerçekteki gibi eşit genişlik, 124px yükseklik */}
        <View className="flex-row gap-3 px-4 pt-3">
          <View className="flex-1">
            <Skeleton width="100%" height={124} radius={16} />
          </View>
          <View className="flex-1">
            <Skeleton width="100%" height={124} radius={16} />
          </View>
        </View>

        {/* Notlar */}
        <View className="p-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <NoteCardSkeleton key={i} />
          ))}
        </View>
      </View>
    </SkeletonGroup>
  );
}
