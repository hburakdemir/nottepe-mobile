import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { getFileUrl } from '../../lib/config';
import { Avatar2SVG } from '../../avatar2/Avatar2SVG';

export interface AvatarData {
  // Sunucudan geldiği gibi: v1 (eski piksel avatar) ya da v2. Avatar2SVG
  // içeride toV2 ile okuyor; burada şekline bakılmıyor.
  config?: unknown;
  photo_path?: string | null;
  display_mode?: 'avatar' | 'photo' | 'both';
}

interface Props {
  avatar?: AvatarData | null;
  size?: number;
  showBg?: boolean;
}

// Fotoğraf daire kutuda kırpılıyor: yalnız Image'ın borderRadius'u iOS'ta
// köşeli görünebiliyor (kullanıcı raporu), overflow: hidden her iki platformda tutarlı.
function RoundPhoto({ path, size }: { path: string; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <Image
        source={{ uri: getFileUrl(`avatars/${path}`) }}
        style={{ width: size, height: size }}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={path}
      />
    </View>
  );
}

// 'both' modunda büyük boyutlarda dokunarak avatar/fotoğraf arasında geçiş —
// web'deki swipe carousel'in basitleştirilmiş dokunma eşdeğeri.
//
// `React.memo`: bu bileşen tab bar'ın profil yuvasında duruyor ve çoğu
// kullanıcıda `Avatar2SVG`'ye düşüyor — yani ~30-55 native SVG düğümü. Memo
// olmadan her sekme dokunuşunda hepsi yeniden kuruluyordu (bkz. avatar2/Avatar2SVG.tsx).
// İç state'i (`showPhotoInBoth`) memo'dan etkilenmiyor, korunuyor.
const AvatarDisplay = React.memo(function AvatarDisplay({ avatar, size = 40, showBg = true }: Props) {
  const [showPhotoInBoth, setShowPhotoInBoth] = useState(true);
  const config = avatar?.config ?? null;
  const hasPhoto = !!avatar?.photo_path;
  const showPhoto = avatar?.display_mode === 'photo' && hasPhoto;
  const showBoth = avatar?.display_mode === 'both' && hasPhoto;

  if (showPhoto) {
    return <RoundPhoto path={avatar!.photo_path!} size={size} />;
  }

  if (showBoth) {
    if (size < 60) return <RoundPhoto path={avatar!.photo_path!} size={size} />;
    return (
      <Pressable onPress={() => setShowPhotoInBoth((v) => !v)} style={{ width: size, height: size }}>
        {showPhotoInBoth ? (
          <RoundPhoto path={avatar!.photo_path!} size={size} />
        ) : (
          <Avatar2SVG config={config} size={size} showBg={showBg} />
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

  return <Avatar2SVG config={config} size={size} showBg={showBg} />;
});

export default AvatarDisplay;
