import React from 'react';
import { Text, View } from 'react-native';
import { Bookmark, Camera, Edit2, FileText, ListChecks, Palette } from 'lucide-react-native';
import { Skeleton, SkeletonGroup } from '../Skeleton';
import PostCardSkeleton from '../PostCardSkeleton';
import { SHADOW_MD } from './profileCommon';

// Profil'in yükleme durumu — GERÇEK SAYFANIN AYNISI, verisi gri.
//
// Önceki hâli ortalanmış bir avatar, tek satır ad ve ÜÇ SÜTUNLU BİR SAYAÇ
// ŞERİDİ çiziyordu; o şerit bu ekranda hiç yok (eski bir tasarımdan kalmış),
// buna karşılık gerçekte olan kullanıcı kartı, rozetler, "Düzenle" butonu ve
// yedi sekmelik şerit iskelette hiç temsil edilmiyordu. Yerleşim baştan
// `HeaderCard.tsx` + `TabStrip.tsx` ölçüleriyle kuruldu.
//
// SABİT KALAN ÖGELER: avatarın üstündeki iki düğme (palet/kamera), "Düzenle"
// butonu ve sekme etiketleri+ikonları. Bunlar veriye bağlı değil — her zaman
// aynı; yalnızca kimlik satırları, rozetler ve sekme sayaçları gri blok.
export default function ProfileSkeleton() {
  return (
    <SkeletonGroup>
      <View className="flex-1 bg-ground">
        {/* HeaderCard: p-4 m-4 mb-5 rounded-lg */}
        <View className="bg-surface p-4 m-4 mb-5 rounded-lg" style={SHADOW_MD}>
          <View className="flex-row gap-3.5">
            <View className="w-20 h-20">
              <Skeleton width={80} height={80} radius={20} />
              <View className="absolute -bottom-[3px] -right-[3px] w-[22px] h-[22px] rounded-[11px] bg-indigo-600 items-center justify-center">
                <Palette size={12} color="#fff" />
              </View>
              <View className="absolute -bottom-[3px] -left-[3px] w-[22px] h-[22px] rounded-[11px] bg-brand items-center justify-center">
                <Camera size={12} color="#fff" />
              </View>
            </View>
            {/* Kimlik: kullanıcı adı, ad soyad, e-posta, bölüm, biyografi. */}
            <View className="flex-1 gap-1.5">
              <Skeleton width={104} height={19} />
              <Skeleton width={128} height={13} />
              <Skeleton width={164} height={12} />
              <Skeleton width={112} height={12} />
              <Skeleton width="100%" height={12} />
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2 mt-3.5">
            <Skeleton width={104} height={24} radius={100} />
            <Skeleton width={82} height={24} radius={100} />
            <Skeleton width={68} height={24} radius={100} />
          </View>

          <View className="flex-row items-center justify-center gap-1.5 bg-brand rounded-[10px] py-2.5 mt-3.5">
            <Edit2 size={15} color="#fff" />
            <Text className="text-white text-[13px] font-bold">Düzenle</Text>
          </View>
        </View>

        {/* TabStrip: mx-4 mb-5, sekme py-3 mr-[18px] */}
        <View className="bg-surface rounded-lg mx-4 mb-5 border-b border-line-soft overflow-hidden" style={SHADOW_MD}>
          <View className="flex-row px-3">
            <View className="flex-row items-center gap-[5px] py-3 mr-[18px] border-b-2 border-b-brand">
              <FileText size={14} color="#2F5755" />
              <Text className="text-[12.5px] font-semibold text-accent">Postlar</Text>
              <Skeleton width={22} height={12} />
            </View>
            <View className="flex-row items-center gap-[5px] py-3 mr-[18px]">
              <Bookmark size={14} color="#9ca3af" />
              <Text className="text-[12.5px] font-semibold text-muted2">Kayıtlı</Text>
              <Skeleton width={20} height={12} />
            </View>
            <View className="flex-row items-center gap-[5px] py-3 mr-[18px]">
              <ListChecks size={14} color="#9ca3af" />
              <Text className="text-[12.5px] font-semibold text-muted2">Checklistler</Text>
              <Skeleton width={20} height={12} />
            </View>
          </View>
        </View>

        {/* Gönderiler — "not varmış gibi" (kullanıcı isteği): boş liste iskeleti
            "hiç notun yok" izlenimi verirdi. */}
        <PostCardSkeleton files={1} />
        <PostCardSkeleton files={2} />
      </View>
    </SkeletonGroup>
  );
}
