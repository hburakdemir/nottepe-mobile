import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { avatarAPI, badgeAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { type Badge } from '../../components/BadgeChip';
import ProfileEditModal from '../../components/profile/ProfileEditModal';
import DeleteAccountModal from '../../components/profile/DeleteAccountModal';
import AvatarBuilderScreen from './AvatarBuilderScreen';
import { MY_AVATAR_KEY, useInvalidateMyAvatar, useMyAvatar } from '../../hooks/useMyAvatar';
import type { AvatarData } from '../../components/avatar/AvatarDisplay';
import type { MainTabParamList } from '../../navigation/types';
import HeaderCard, { type ProfileIdentity } from '../../components/profile/HeaderCard';
import ProfileTemplate from '../../components/profile/ProfileTemplate';
import type { ProfileScopeValue } from '../../components/profile/ProfileScope';
import { makeTabs } from '../../components/profile/profileCommon';
import { MY_BADGES_KEY, useMyBadges } from '../../hooks/profile/useProfileLists';

// Oturum sahibinin kendi profili.
//
// Pager, çöken başlık, sekme şeridi, sayaçlar ve iskelet artık
// `ProfileTemplate`'te (bkz. o dosyanın başındaki not) — başka bir kullanıcının
// profili de AYNI şablonu basıyor. Bu ekranda kalan tek iş, kendi profiline
// özgü olan: başlık kartını kurmak, avatar/rozet mutasyonları ve üç modal.
//
// `useMyBadges()` henüz veri döndürmediğinde `HeaderCard`'a (memo'lu) her
// render'da yeni bir `[]` gitmesin.
const NO_BADGES: Badge[] = [];

// Sekme listesi mod başına SABİT — modül seviyesinde kurulunca
// `TabStrip`/pager memo'su her render'da bozulmuyor.
const ME_TABS = makeTabs('me');

export default function ProfileScreen() {
  const route = useRoute<RouteProp<MainTabParamList, 'Profile'>>();
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'moderator';

  // Rozetler burada okunuyor çünkü `ProfileEditModal`'ı bu ekran render ediyor
  // (rozet görünürlüğü oradan değiştiriliyor); `HeaderCard`'a prop olarak iniyor.
  const { data: badges = NO_BADGES } = useMyBadges();

  // Avatar burada ayrıca çekilmiyor: üst bar ve tab bar ile aynı react-query
  // anahtarını (`MY_AVATAR_KEY`, bkz. hooks/useMyAvatar.ts) paylaşıyor —
  // böylece açılışta tek bir `avatarAPI.get()` isteği kalıyor.
  const avatar = useMyAvatar();
  const queryClient = useQueryClient();
  // Avatar değişince üst bar ve tab bar da tazelensin.
  const invalidateMyAvatar = useInvalidateMyAvatar();
  const [photoUploading, setPhotoUploading] = useState(false);

  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleToggleBadgeVisibility = useCallback(
    async (badge: Badge) => {
      const nextVisible = !(badge.is_visible !== false);
      // En az bir rozet görünür kalmalı — sayım her çağrıda taze cache'ten.
      if (!nextVisible && badges.filter((b) => b.is_visible !== false).length <= 1) {
        Alert.alert('Uyarı', 'En az bir rozet görünür kalmalı.');
        return;
      }
      try {
        await badgeAPI.setVisibility(badge.id, nextVisible);
        queryClient.setQueryData<Badge[]>(MY_BADGES_KEY, (prev) =>
          prev?.map((b) => (b.id === badge.id ? { ...b, is_visible: nextVisible } : b))
        );
      } catch (err: any) {
        Alert.alert('Hata', err.response?.data?.message || 'Rozet görünürlüğü güncellenemedi.');
      }
    },
    [badges, queryClient]
  );

  // `HeaderCard` memo'lu: satır içi ok fonksiyonu verseydik her render'da yeni
  // referans olur, memo hiçbir zaman bail-out yapamazdı.
  const openAvatarBuilder = useCallback(() => setShowAvatarBuilder(true), []);
  const openEditModal = useCallback(() => setShowEditModal(true), []);

  const handlePickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin gerekli', 'Fotoğraf seçmek için galeri izni vermelisiniz.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotoUploading(true);
    try {
      const res = await avatarAPI.uploadPhoto({
        uri: asset.uri,
        name: asset.fileName || 'photo.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      // Yanıttaki avatarı önbelleğe doğrudan yazıyoruz ki bu ekran, üst bar ve
      // tab bar ağ turunu beklemeden anında güncellensin; ardından gelen
      // invalidate sunucudaki son hâlle senkronu garantiliyor.
      queryClient.setQueryData(MY_AVATAR_KEY, (res.data.avatar as AvatarData | null) ?? null);
      invalidateMyAvatar();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error || 'Fotoğraf yüklenemedi.');
    } finally {
      setPhotoUploading(false);
    }
  }, [invalidateMyAvatar, queryClient]);

  // ⚠️ `profileId` ŞART: `ForumsTab` forum etkinliğini scope'taki kimlikle
  // çekiyor (eskiden kendi içinde `useAuth()` çağırıyordu). Geçilmezse kendi
  // profilindeki Forumlar sekmesi sessizce hiç yüklenmez.
  const scope = useMemo<ProfileScopeValue>(
    () => ({ mode: 'me', readOnly: false, profileId: user?.id }),
    [user?.id]
  );

  // `useMemo` ŞART: `HeaderCard` memo'lu, her render'da yeni bir `identity`
  // nesnesi memo'yu tamamen etkisizleştirirdi.
  const identity = useMemo<ProfileIdentity>(
    () => ({
      username: user?.username,
      fullName: user?.full_name,
      email: user?.email,
      phone: user?.phone,
      department: user?.department,
      faculty: user?.faculty,
      bio: user?.bio,
    }),
    [user]
  );

  return (
    <>
      <ProfileTemplate
        scope={scope}
        tabs={ME_TABS}
        requestedTab={route.params?.initialTab}
        header={
          <HeaderCard
            identity={identity}
            avatar={avatar}
            badges={badges}
            editable
            photoUploading={photoUploading}
            onPickPhoto={handlePickPhoto}
            onOpenAvatarBuilder={openAvatarBuilder}
            onOpenEdit={openEditModal}
          />
        }
      />

      {/* Checklist istatistik/düzenleme modalları artık ChecklistsTab'ın
          içinde: onları açan state de orada yaşıyor, bir kartı açmak bu ekrana
          hiç ulaşmıyor. */}
      {showEditModal && (
        <ProfileEditModal
          badges={badges}
          onToggleBadgeVisibility={handleToggleBadgeVisibility}
          onClose={() => setShowEditModal(false)}
          onDeleteAccountRequest={() => setShowDeleteModal(true)}
        />
      )}
      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}

      <Modal visible={showAvatarBuilder} animationType="slide" onRequestClose={() => setShowAvatarBuilder(false)}>
        {/* RN'in `Modal`ı iOS'ta içeriğini AYRI bir native pencerede sunuyor —
            uygulama kökündeki `SafeAreaProvider` (App.tsx) o pencere için insets'i
            (özellikle notch/Dynamic Island'ın üst boşluğu) doğru ölçemiyor,
            AvatarBuilderScreen içindeki `SafeAreaView edges={['top']}` bu yüzden
            iOS'ta 0'a yakın bir üst boşlukla çiziyordu ("avatar çok üstte
            kalıyor"). Modal'ın kendi `SafeAreaProvider`'ı içeride yeniden
            ölçüm yaptırıyor — bilinen bir react-native-safe-area-context deseni. */}
        <SafeAreaProvider>
          <AvatarBuilderScreen
            initialConfig={avatar?.config || {}}
            isStaff={isStaff}
            onClose={() => setShowAvatarBuilder(false)}
            onSaved={(newCfg) => {
              queryClient.setQueryData(MY_AVATAR_KEY, (prev: AvatarData | null | undefined) => ({
                ...(prev || {}),
                config: newCfg,
              }));
              invalidateMyAvatar();
            }}
          />
        </SafeAreaProvider>
      </Modal>
    </>
  );
}
