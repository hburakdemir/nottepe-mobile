import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Camera, Edit2, Palette } from 'lucide-react-native';
import BadgeChip, { type Badge } from '../BadgeChip';
import DeerIcon from '../icons/DeerIcon';
import AvatarDisplay, { type AvatarData } from '../avatar/AvatarDisplay';
import { SHADOW_MD } from './profileCommon';
import { useCoachTarget } from '../coach/CoachMarks';
import { impact } from '../../lib/haptics';

export interface ProfileIdentity {
  username?: string | null;
  full_name?: string | null;
  /** Yalnızca kendi profilinde var — sunucu başkasının e-posta/telefonunu döndürmüyor. */
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  faculty?: string | null;
  bio?: string | null;
}

/** Yalnızca kendi profilinde verilen düzenleme eylemleri. */
export interface HeaderOwnerActions {
  photoUploading: boolean;
  onPickPhoto: () => void;
  onOpenAvatarBuilder: () => void;
  onOpenEdit: () => void;
}

// Profil başlık kartı: avatar, kimlik bilgileri, rozetler — kendi profili ve
// başkasının profili AYNI kartı kullanıyor, farklar yalnızca:
//  - `ownerActions` (kendi profili): avatarın üstündeki palet/kamera ve "Düzenle"
//  - `nameAccessory` / `belowName` (başkasının profili): şikâyet/engelle menüsü
//    ve "seni engelledi" etiketi
//
// `React.memo`: bu kart ProfileScreen'in gövdesindeyken bir sekme değişimi ya
// da bir sayaç güncellemesi onu da yeniden çiziyordu — AvatarDisplay bir SVG
// ağacı, ucuz değil. Artık yalnızca kendi prop'ları değişince çiziliyor.
function HeaderCard({
  identity,
  avatar,
  badges,
  showBadges = true,
  ownerActions,
  nameAccessory,
  belowName,
}: {
  identity: ProfileIdentity | null | undefined;
  avatar: AvatarData | null;
  badges: Badge[];
  /** Başkası rozetlerini gizlediyse rozet satırı hiç çizilmiyor. */
  showBadges?: boolean;
  ownerActions?: HeaderOwnerActions;
  nameAccessory?: React.ReactNode;
  belowName?: React.ReactNode;
}) {
  // Eskiden aynı `filter` tek render'da ÜÇ kez çalışıyordu (biri sayım, ikisi
  // render dalları için).
  // İlk kullanım rehberi — yalnızca kendi profilinde (ownerActions varken).
  const avatarTarget = useCoachTarget('profile-avatar', !!ownerActions);
  const editTarget = useCoachTarget('profile-edit', !!ownerActions);
  const visibleBadges = useMemo(() => badges.filter((b) => b.is_visible !== false), [badges]);
  // Avatara dokununca büyütülmüş hâli (kullanıcı isteği), hafif titreşimle.
  const [zoomed, setZoomed] = useState(false);
  const { width } = useWindowDimensions();
  const zoomSize = Math.min(width - 64, 320);

  return (
    // Kart listenin ÜSTÜNDE ayrı bir katman (bkz. ProfileScreen); düğme
    // olmayan her yer `box-none` / `none` ki kart üzerinden çekince dokunuş
    // alttaki listeye geçsin — aşağı çekerek yenileme ve kaydırma kartın
    // üstünden de çalışsın (kullanıcı isteği).
    <View pointerEvents="box-none" className="bg-surface p-4 m-4 mb-5 rounded-lg" style={SHADOW_MD}>
      <View pointerEvents="box-none" className="flex-row gap-3.5">
        <View ref={avatarTarget} pointerEvents="box-none" className="w-20 h-20">
          <Pressable
            disabled={!avatar}
            onPress={() => {
              impact();
              setZoomed(true);
            }}
            accessibilityRole="imagebutton"
            accessibilityLabel="Avatarı büyüt"
          >
            {/* İç kısım dokunuş almıyor: AvatarDisplay'in kendi "fotoğraf/avatar"
                geçişi büyütülmüş görünümde çalışıyor. */}
            <View pointerEvents="none" className="w-20 h-20 rounded-[20px] bg-brand items-center justify-center overflow-hidden">
              {avatar ? <AvatarDisplay avatar={avatar} size={80} /> : <DeerIcon size={32} color="#fff" />}
            </View>
          </Pressable>
          {!!ownerActions && (
            <>
              <Pressable
                className="absolute -bottom-[3px] -right-[3px] w-[22px] h-[22px] rounded-[11px] bg-indigo-600 items-center justify-center"
                onPress={ownerActions.onOpenAvatarBuilder}
              >
                <Palette size={12} color="#fff" />
              </Pressable>
              <Pressable
                className="absolute -bottom-[3px] -left-[3px] w-[22px] h-[22px] rounded-[11px] bg-brand items-center justify-center"
                onPress={ownerActions.onPickPhoto}
                disabled={ownerActions.photoUploading}
              >
                {ownerActions.photoUploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Camera size={12} color="#fff" />
                )}
              </Pressable>
            </>
          )}
        </View>
        <View pointerEvents="box-none" className="flex-1">
          <View pointerEvents="box-none" className="flex-row items-center gap-2">
            <Text pointerEvents="none" className="text-[19px] font-extrabold text-ink flex-shrink" numberOfLines={1}>
              {identity?.username}
            </Text>
            {nameAccessory}
          </View>
          {!!identity?.full_name && <Text pointerEvents="none" className="text-[13px] text-ink2 mt-0.5">{identity.full_name}</Text>}
          {belowName}
          {!!identity?.email && <Text pointerEvents="none" className="text-[12.5px] text-muted mt-px">{identity.email}</Text>}
          {!!identity?.phone && <Text pointerEvents="none" className="text-xs text-muted2 mt-0.5">{identity.phone}</Text>}
          {!!identity?.department && (
            <Text pointerEvents="none" className="text-xs text-muted2 mt-0.5">
              {identity.department}
              {identity.faculty ? ` · ${identity.faculty}` : ''}
            </Text>
          )}
          {!!identity?.bio && <Text pointerEvents="none" className="text-[12.5px] text-ink2 mt-1.5 leading-[17px]">{identity.bio}</Text>}
        </View>
      </View>

      {showBadges && (
        <View pointerEvents="box-none" className="flex-row flex-wrap gap-2 mt-3.5">
          {visibleBadges.length === 0 ? (
            <Text pointerEvents="none" className="text-[11.5px] text-muted2">
              {ownerActions ? 'Henüz rozet yok — not paylaşarak rozet kazanabilirsin!' : 'Henüz rozet yok.'}
            </Text>
          ) : (
            visibleBadges.map((badge) => <BadgeChip key={badge.id} badge={badge} />)
          )}
        </View>
      )}

      {!!ownerActions && (
        <Pressable
          ref={editTarget}
          className="flex-row items-center justify-center gap-1.5 bg-brand rounded-[10px] py-2.5 mt-3.5"
          onPress={ownerActions.onOpenEdit}
        >
          <Edit2 size={15} color="#fff" />
          <Text className="text-white text-[13px] font-bold">Düzenle</Text>
        </Pressable>
      )}

      {!!avatar && (
        <Modal visible={zoomed} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setZoomed(false)}>
          <Pressable
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.82)' }}
            onPress={() => setZoomed(false)}
            accessibilityLabel="Kapat"
          >
            <Animated.View entering={ZoomIn.duration(220)} className="items-center">
              <View
                className="bg-brand items-center justify-center overflow-hidden"
                style={{ width: zoomSize, height: zoomSize, borderRadius: zoomSize / 4 }}
              >
                <AvatarDisplay avatar={avatar} size={zoomSize} />
              </View>
              {!!identity?.username && <Text className="text-white text-lg font-bold mt-4">{identity.username}</Text>}
            </Animated.View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

export default React.memo(HeaderCard);
