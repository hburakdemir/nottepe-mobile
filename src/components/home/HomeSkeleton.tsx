import React from 'react';
import { View } from 'react-native';
import { ChevronDown, GraduationCap, HeartHandshake, Search } from 'lucide-react-native';
import { Skeleton, SkeletonGroup } from '../Skeleton';
import PostCardSkeleton from '../PostCardSkeleton';
import { useCardSurface, useFeedTokens } from '../../theme/feedTokens';

// Ana sayfanın yükleme durumu. Eskiden ortada tek bir `StateView kind="loading"`
// spinner'ı vardı: "bir şey oluyor" demekten başka bilgi vermiyor ve içerik
// gelince ekran boş ortadan dolu sayfaya ZIPLIYOR.
//
// YERLEŞİM `HomeScreen`in `filterBar`ından BİREBİR alındı: dış dolgu 12, arama
// kartı (p-3.5, radius 16) içinde arama kutusu ve fakülte seçici, altında iki
// adet 124px yüksekliğinde kısayol karesi (38px ikon yuvası + başlık + 30px
// sabit yükseklikli iki satır açıklama).
//
// Önceki hâli bu kısmı iki düz 42px çubuk ve iki boş 124px blokla geçiştiriyordu:
// arama kutusunun içi, fakülte oku ve kısayolların ikonları/başlıkları hiç
// temsil edilmiyordu.
//
// SABİT KALAN ÖGELER: arama, fakülte oku ve iki kısayolun ikonları — veriye
// bağlı değil, her zaman aynı. Yalnızca yazılar ve sayaçlar gri çubuk.
export default function HomeSkeleton() {
  const t = useFeedTokens();
  const cardSurface = useCardSurface();

  return (
    <SkeletonGroup>
      <View className="flex-1 bg-ground">
        <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
          <View className="p-3.5 mb-3" style={[cardSurface, { borderRadius: 16 }]}>
            <View className="flex-row items-center gap-2 bg-inset border border-line rounded-[10px] px-3 py-2.5">
              <Search size={16} color={t.line} />
              <Skeleton height={13.5} style={{ flex: 1, maxWidth: 190 }} />
            </View>

            <View className="flex-row items-center justify-between border border-line rounded-[10px] px-3 py-2.5 mt-2.5">
              <Skeleton width={104} height={13.5} />
              <ChevronDown size={16} color={t.line} />
            </View>
          </View>

          <View className="flex-row gap-3 mb-1">
            {[GraduationCap, HeartHandshake].map((Icon, i) => (
              <View key={i} className="flex-1 p-3.5 justify-between" style={[cardSurface, { borderRadius: 16, height: 124 }]}>
                <View className="w-[38px] h-[38px] rounded-[10px] bg-accent-soft items-center justify-center">
                  <Icon size={19} color={t.line} />
                </View>
                <View>
                  <Skeleton width={i === 0 ? 86 : 78} height={13.5} />
                  <View className="mt-1 gap-1.5" style={{ height: 30 }}>
                    <Skeleton width="100%" height={11} />
                    <Skeleton width={i === 0 ? '64%' : '52%'} height={11} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Notlar — kart dolgusunu/boşluğunu PostCardSkeleton kendi taşıyor
            (marginHorizontal 12, marginTop 10), sarmalayıcı dolgu yok. */}
        <PostCardSkeleton files={2} />
        <PostCardSkeleton files={1} />
      </View>
    </SkeletonGroup>
  );
}
