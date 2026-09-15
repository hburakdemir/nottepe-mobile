import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Camera, Edit2, Palette } from 'lucide-react-native';
import BadgeChip, { type Badge } from '../BadgeChip';
import DeerIcon from '../icons/DeerIcon';
import AvatarDisplay, { type AvatarData } from '../avatar/AvatarDisplay';
import { SHADOW_MD } from './profileCommon';

/** Kartın çizdiği kimlik alanları. Hem `AuthContext`'teki oturum kullanıcısı
 *  hem de `userAPI.getProfile()`'ın herkese açık profili bu şekle indiriliyor —
 *  kart hangisinden geldiğini bilmiyor. */
/** Alanlar `null` da kabul ediyor: `AuthContext`'teki kullanıcı nesnesi boş
 *  alanları `null` olarak taşıyor, herkese açık profil ise `undefined`
 *  bırakıyor. Kart ikisini de "yok" sayıyor. */
export interface ProfileIdentity {
  username?: string | null;
  fullName?: string | null;
  /** Yalnızca kendi profilinde var; herkese açık profilde dönmüyor. */
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  faculty?: string | null;
  bio?: string | null;
}

// Profil başlık kartı: avatar (+ iki eylem düğmesi), kimlik bilgileri,
// rozetler ve "Düzenle".
//
// KİMLİK ARTIK PROP: eskiden kart `useAuth()`'u KENDİ İÇİNDE çağırıyordu, yani
// yapısal olarak yalnızca oturum sahibinin profilini çizebiliyordu.
// `UserProfileScreen` bu yüzden kartın kendi kopyasını taşıyordu ve iki profil
// sayfası zamanla birbirinden ayrıştı (farklı avatar yedeği, farklı çerçeve,
// farklı rozet metni). Tek şablona inmenin ön koşulu buydu.
//
// `React.memo`: bu kart şablonun gövdesindeyken bir sekme değişimi ya da bir
// sayaç güncellemesi onu da yeniden çiziyordu — AvatarDisplay bir SVG ağacı,
// ucuz değil. Artık yalnızca kendi prop'ları değişince çiziliyor. ÇAĞIRAN
// TARAF `identity` NESNESİNİ `useMemo`'LAMAK ZORUNDA, yoksa memo hiçbir zaman
// bail-out yapamaz.
function HeaderCard({
  identity,
  avatar,
  badges,
  editable,
  postCount,
  photoUploading = false,
  onPickPhoto,
  onOpenAvatarBuilder,
  onOpenEdit,
}: {
  identity: ProfileIdentity;
  avatar: AvatarData | null;
  /** `null` = rozet satırı HİÇ çizilmiyor (profil sahibi bölümü gizlemiş). */
  badges: Badge[] | null;
  /** `false` → avatar eylem düğmeleri ve "Düzenle" hiç render edilmiyor. */
  editable: boolean;
  /** Herkese açık profilde "N onaylı not" satırı; kendi profilinde sekme
   *  şeridindeki sayaç aynı bilgiyi verdiği için geçilmiyor. */
  postCount?: number;
  photoUploading?: boolean;
  onPickPhoto?: () => void;
  onOpenAvatarBuilder?: () => void;
  onOpenEdit?: () => void;
}) {
  // Eskiden aynı `filter` tek render'da ÜÇ kez çalışıyordu (biri sayım, ikisi
  // render dalları için).
  const visibleBadges = useMemo(
    () => (badges === null ? null : badges.filter((b) => b.is_visible !== false)),
    [badges]
  );

  return (
    <View className="bg-surface p-4 m-4 mb-5 rounded-lg" style={SHADOW_MD}>
      <View className="flex-row gap-3.5">
        <View className="w-20 h-20">
          {/* Avatar yedeği İKİ MODDA DA marka geyiği. Herkese açık profil
              eskiden lucide `User` ikonu çiziyordu — birleştirmenin kurbanı o
              oldu, çünkü "tek şablon" şikâyetinin somut parçalarından biriydi
              (aynı sebeple `border-2 border-avatar-ring` çerçevesi de gitti). */}
          <View className="w-20 h-20 rounded-[20px] bg-brand items-center justify-center overflow-hidden">
            {avatar ? <AvatarDisplay avatar={avatar} size={80} /> : <DeerIcon size={32} color="#fff" />}
          </View>
          {editable && (
            <>
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
            </>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-[19px] font-extrabold text-ink" numberOfLines={1}>
            {identity.username}
          </Text>
          {!!identity.fullName && <Text className="text-[13px] text-ink2 mt-0.5">{identity.fullName}</Text>}
          {!!identity.email && <Text className="text-[12.5px] text-muted mt-px">{identity.email}</Text>}
          {!!identity.phone && <Text className="text-xs text-muted2 mt-0.5">{identity.phone}</Text>}
          {!!identity.department && (
            <Text className="text-xs text-muted2 mt-0.5">
              {identity.department}
              {identity.faculty ? ` · ${identity.faculty}` : ''}
            </Text>
          )}
          {typeof postCount === 'number' && (
            <Text className="text-[12.5px] text-muted mt-1">{postCount} onaylı not</Text>
          )}
          {!!identity.bio && <Text className="text-[12.5px] text-ink2 mt-1.5 leading-[17px]">{identity.bio}</Text>}
        </View>
      </View>

      {visibleBadges !== null && (
        <View className="flex-row flex-wrap gap-2 mt-3.5">
          {visibleBadges.length === 0 ? (
            // Boş metin `editable`'dan türetiliyor: kendi profilinde bu bir
            // çağrı, başkasının profilinde sadece bir bilgi.
            <Text className="text-[11.5px] text-muted2">
              {editable ? 'Henüz rozet yok — not paylaşarak rozet kazanabilirsin!' : 'Henüz rozet yok.'}
            </Text>
          ) : (
            visibleBadges.map((badge) => <BadgeChip key={badge.id} badge={badge} />)
          )}
        </View>
      )}

      {editable && (
        <Pressable
          className="flex-row items-center justify-center gap-1.5 bg-brand rounded-[10px] py-2.5 mt-3.5"
          onPress={onOpenEdit}
        >
          <Edit2 size={15} color="#fff" />
          <Text className="text-white text-[13px] font-bold">Düzenle</Text>
        </Pressable>
      )}
    </View>
  );
}

export default React.memo(HeaderCard);
