import React from 'react';
import { View } from 'react-native';
import { Bookmark, Calculator, FileText, ListChecks, MoreHorizontal } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { Skeleton, SkeletonGroup } from '../Skeleton';
import PostCardSkeleton from '../PostCardSkeleton';
import { SHADOW_MD } from './profileCommon';

// Başkasının profilinin yükleme durumu — GERÇEK SAYFANIN AYNISI, verisi gri
// (kendi profilindeki `ProfileSkeleton` ile aynı yaklaşım). Ölçüler
// `UserProfileScreen.tsx`'teki künye kartı ve sekme şeridinden alındı; o
// düzen değişirse burası da değişmeli.
//
// SABİT KALAN ÖGELER: moderasyon menüsünün "…" ikonu ve sekme ikonları. Sekme
// etiketleri çubuk, çünkü hangi sekmelerin görüneceği profilin görünürlük
// ayarına bağlı; yalnızca her zaman olan "Paylaştığı Notlar" ve ardından
// varsayılan sıradaki üç sekme temsil ediliyor.
export default function UserProfileSkeleton() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const activeIcon = isDark ? '#60a5fa' : '#1e3a8a';
  const idleIcon = isDark ? '#9ca3af' : '#6b7280';

  return (
    <SkeletonGroup>
      <View className="flex-1 bg-ground px-4 pt-8">
        {/* Künye kartı: p-4 mb-8, avatar solda, künye sağında. */}
        <View className="bg-surface rounded-lg p-4 mb-8" style={SHADOW_MD}>
          <View className="flex-row gap-3.5">
            <Skeleton width={80} height={80} radius={20} />
            {/* Kullanıcı adı, ad soyad, bölüm · fakülte, "N onaylı not". */}
            <View className="flex-1 gap-1.5">
              <View className="flex-row items-center gap-2">
                <Skeleton width={112} height={19} />
                <MoreHorizontal size={20} color={idleIcon} style={{ marginLeft: 'auto' }} />
              </View>
              <Skeleton width={128} height={13} />
              <Skeleton width={176} height={12} />
              <Skeleton width={84} height={12.5} />
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2 mt-3.5">
            <Skeleton width={104} height={24} radius={100} />
            <Skeleton width={82} height={24} radius={100} />
            <Skeleton width={68} height={24} radius={100} />
          </View>
        </View>

        {/* Sekme şeridi: mb-8, sekme py-3 mr-5, ikon 16. Etiket çubukları
            "Paylaştığı Notlar (4)", "Kaydettikleri (0)", "Checklistleri"
            genişliklerinde; dördüncü sekme gerçekte olduğu gibi kenarda kesiliyor. */}
        <View className="bg-surface rounded-lg mb-8 overflow-hidden" style={SHADOW_MD}>
          <View className="flex-row px-4 border-b border-line">
            <View className="flex-row items-center gap-1.5 py-3 mr-5 border-b-2 border-b-[#1e40af]">
              <FileText size={16} color={activeIcon} />
              <Skeleton width={94} height={12} />
            </View>
            <View className="flex-row items-center gap-1.5 py-3 mr-5">
              <Bookmark size={16} color={idleIcon} />
              <Skeleton width={75} height={12} />
            </View>
            <View className="flex-row items-center gap-1.5 py-3 mr-5">
              <ListChecks size={16} color={idleIcon} />
              <Skeleton width={59} height={12} />
            </View>
            <View className="flex-row items-center gap-1.5 py-3 mr-5">
              <Calculator size={16} color={idleIcon} />
              <Skeleton width={84} height={12} />
            </View>
          </View>
        </View>

        {/* Gönderiler — "not varmış gibi", kendi profilindeki gibi. */}
        <PostCardSkeleton files={1} />
        <PostCardSkeleton files={2} />
      </View>
    </SkeletonGroup>
  );
}
