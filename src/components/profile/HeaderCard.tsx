import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Camera, Edit2, Palette } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import BadgeChip, { type Badge } from '../BadgeChip';
import DeerIcon from '../icons/DeerIcon';
import AvatarDisplay, { type AvatarData } from '../avatar/AvatarDisplay';
import { SHADOW_MD } from './profileCommon';

// Profil başlık kartı: avatar (+ iki eylem düğmesi), kimlik bilgileri,
// rozetler ve "Düzenle".
//
// `React.memo`: bu kart ProfileScreen'in gövdesindeyken bir sekme değişimi ya
// da bir sayaç güncellemesi onu da yeniden çiziyordu — AvatarDisplay bir SVG
// ağacı, ucuz değil. Artık yalnızca kendi prop'ları değişince çiziliyor.
function HeaderCard({
  avatar,
  badges,
  photoUploading,
  onPickPhoto,
  onOpenAvatarBuilder,
  onOpenEdit,
}: {
  avatar: AvatarData | null;
  badges: Badge[];
  photoUploading: boolean;
  onPickPhoto: () => void;
  onOpenAvatarBuilder: () => void;
  onOpenEdit: () => void;
}) {
  const { user } = useAuth();

  // Eskiden aynı `filter` tek render'da ÜÇ kez çalışıyordu (biri sayım, ikisi
  // render dalları için).
  const visibleBadges = useMemo(() => badges.filter((b) => b.is_visible !== false), [badges]);

  return (
    <View className="bg-surface p-4 m-4 mb-5 rounded-lg" style={SHADOW_MD}>
      <View className="flex-row gap-3.5">
        <View className="w-20 h-20">
          <View className="w-20 h-20 rounded-[20px] bg-brand items-center justify-center overflow-hidden">
            {avatar ? <AvatarDisplay avatar={avatar} size={80} /> : <DeerIcon size={32} color="#fff" />}
          </View>
          <Pressable
            className="absolute -bottom-[3px] -right-[3px] w-[22px] h-[22px] rounded-[11px] bg-indigo-600 items-center justify-center"
            onPress={onOpenAvatarBuilder}
          >
            <Palette size={12} color="#fff" />
          </Pressable>
          <Pressable
            className="absolute -bottom-[3px] -left-[3px] w-[22px] h-[22px] rounded-[11px] bg-brand items-center justify-center"
            onPress={onPickPhoto}
            disabled={photoUploading}
          >
            {photoUploading ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={12} color="#fff" />}
          </Pressable>
        </View>
        <View className="flex-1">
          <Text className="text-[19px] font-extrabold text-ink">{user?.username}</Text>
          <Text className="text-[13px] text-ink2 mt-0.5">{user?.full_name}</Text>
          <Text className="text-[12.5px] text-muted mt-px">{user?.email}</Text>
          {!!user?.phone && <Text className="text-xs text-muted2 mt-0.5">{user.phone}</Text>}
          {!!user?.department && (
            <Text className="text-xs text-muted2 mt-0.5">
              {user.department}
              {user.faculty ? ` · ${user.faculty}` : ''}
            </Text>
          )}
          {!!user?.bio && <Text className="text-[12.5px] text-ink2 mt-1.5 leading-[17px]">{user.bio}</Text>}
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2 mt-3.5">
        {visibleBadges.length === 0 ? (
          <Text className="text-[11.5px] text-muted2">Henüz rozet yok — not paylaşarak rozet kazanabilirsin!</Text>
        ) : (
          visibleBadges.map((badge) => <BadgeChip key={badge.id} badge={badge} />)
        )}
      </View>

      <Pressable
        className="flex-row items-center justify-center gap-1.5 bg-brand rounded-[10px] py-2.5 mt-3.5"
        onPress={onOpenEdit}
      >
        <Edit2 size={15} color="#fff" />
        <Text className="text-white text-[13px] font-bold">Düzenle</Text>
      </Pressable>
    </View>
  );
}

export default React.memo(HeaderCard);
