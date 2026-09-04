import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { getFileUrl } from '../../lib/config';
import type { AvatarConfig } from '../../constants/avatarConfig';
import { AvatarSVG } from './AvatarSVG';

export interface AvatarData {
  config?: Partial<AvatarConfig> | null;
  photo_path?: string | null;
  display_mode?: 'avatar' | 'photo' | 'both';
}

interface Props {
  avatar?: AvatarData | null;
  size?: number;
  showBg?: boolean;
}

// 'both' modunda büyük boyutlarda dokunarak avatar/fotoğraf arasında geçiş —
// web'deki swipe carousel'in basitleştirilmiş dokunma eşdeğeri.
export default function AvatarDisplay({ avatar, size = 40, showBg = true }: Props) {
  const [showPhotoInBoth, setShowPhotoInBoth] = useState(true);
  const config = avatar?.config ?? null;
  const hasPhoto = !!avatar?.photo_path;
  const showPhoto = avatar?.display_mode === 'photo' && hasPhoto;
  const showBoth = avatar?.display_mode === 'both' && hasPhoto;

  if (showPhoto) {
    return (
      <Image source={{ uri: getFileUrl(`avatars/${avatar!.photo_path}`) }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    );
  }

  if (showBoth) {
    if (size < 60) {
      return (
        <Image
          source={{ uri: getFileUrl(`avatars/${avatar!.photo_path}`) }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      );
    }
    return (
      <Pressable onPress={() => setShowPhotoInBoth((v) => !v)} style={{ width: size, height: size }}>
        {showPhotoInBoth ? (
          <Image
            source={{ uri: getFileUrl(`avatars/${avatar!.photo_path}`) }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
          />
        ) : (
          <AvatarSVG config={config} size={size} showBg={showBg} />
        )}
        <View
          style={{
            position: 'absolute',
            bottom: 2,
            alignSelf: 'center',
            flexDirection: 'row',
            gap: 3,
          }}
        >
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: showPhotoInBoth ? '#fff' : 'rgba(255,255,255,0.5)' }} />
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: !showPhotoInBoth ? '#fff' : 'rgba(255,255,255,0.5)' }} />
        </View>
      </Pressable>
    );
  }

  return <AvatarSVG config={config} size={size} showBg={showBg} />;
}
