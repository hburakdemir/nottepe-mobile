import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Lock, ShieldOff, User as UserIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import type { Badge } from '../../components/BadgeChip';
import StateView from '../../components/StateView';
import HeaderCard, { type ProfileIdentity } from '../../components/profile/HeaderCard';
import ProfileSkeleton from '../../components/profile/ProfileSkeleton';
import ProfileTemplate from '../../components/profile/ProfileTemplate';
import type { ProfileScopeValue } from '../../components/profile/ProfileScope';
import { DEFAULT_SECTION_VISIBILITY, SHADOW_MD, visibleTabs } from '../../components/profile/profileCommon';
import { useUserAvatar, useUserBadges, useUserProfile } from '../../hooks/profile/useUserProfile';
import type { RootStackParamList } from '../../navigation/types';

// Başka bir kullanıcının herkese açık profili.
//
// ⚠️ BU EKRAN ARTIK KENDİ DÜZENİNİ ÇİZMİYOR. Eskiden 606 satırdı: 16 `useState`,
// üç ham `useEffect` veri yükleyici, kendi sekme şeridi, kendi boş-durum
// bileşeni, kendi `SHADOW_MD`/`formatDate` kopyası ve yedi sekmenin içeriğinin
// satır içi kopyası. İki profil sayfası birbirinden bağımsız geliştiği için
// zamanla ayrıştı ve testçi bunu bildirdi: "başka bir kullanıcı profili
// görüntülendiği zaman tablardaki renkler, loading vs. kendi profilini
// görüntülediğin gibi olmalı, profil için tek şablon olmalı."
//
// Somut ayrışmalar ve nerede kapandıkları:
//   · Aktif sekme lacivert (`border-b-[#1e40af]`, `#60a5fa`/`#1e3a8a`,
//     `text-info`) → şerit tek dosyada ve renk daima marka teal (TabStrip.tsx).
//   · Yükleme tam ekran spinner + sekme başına `ActivityIndicator` →
//     `ProfileSkeleton` (iki modda da aynı iskelet).
//   · Ok düğmeli sayfalama ("Sayfa 2 / 5") → şablonun sonsuz kaydırması.
//     Davranış değişikliği, bilerek kabul edildi.
//   · Avatar yedeği lucide `User` + `border-2 border-avatar-ring` → marka
//     `DeerIcon`, çerçevesiz (HeaderCard.tsx).
//   · Çöken başlık ve sekme başına kaydırma konumu burada HİÇ yoktu; şablonla
//     birlikte bedavaya geldi.
//
// Geriye kalan dört şey gerçekten bu ekrana ait: profil başlığının veri
// katmanı, dört erken dönüş dalı (yasaklı / ağ hatası / bulunamadı / gizli) ve
// hangi sekmelerin görünür olduğu.

// Rozet verisi gelmeden `HeaderCard`'a (memo'lu) her render'da yeni bir `[]`
// gitmesin.
const NO_BADGES: Badge[] = [];

export default function UserProfileScreen() {
  const route = useRoute<any>();
  const { username } = route.params as RootStackParamList['UserProfile'];
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { data: profile, isPending, error, refetch } = useUserProfile(username);

  // Profil sahibi bölümleri tek tek gizleyebiliyor; sunucu yalnızca
  // DEĞİŞTİRİLEN anahtarları döndürdüğü için varsayılanla birleşiyor.
  const sectionVisibility = useMemo(
    () => ({ ...DEFAULT_SECTION_VISIBILITY, ...(profile?.profile_section_visibility || {}) }),
    [profile]
  );
  const badgesVisible = sectionVisibility.badges !== false;

  const { data: avatar = null } = useUserAvatar(profile?.id);
  const { data: badges = NO_BADGES } = useUserBadges(profile?.id, badgesVisible);

  // Üçü de `useMemo`: `HeaderCard` ve `TabStrip` memo'lu, şablonun context
  // değeri de her render'da yenilenirse yedi sekmeyi birden render ederdi.
  const identity = useMemo<ProfileIdentity>(
    () => ({
      username: profile?.username,
      fullName: profile?.full_name,
      department: profile?.department,
      faculty: profile?.faculty,
      bio: profile?.bio,
    }),
    [profile]
  );

  const scope = useMemo<ProfileScopeValue>(
    () => ({ mode: 'user', username, profileId: profile?.id, readOnly: true }),
    [username, profile?.id]
  );

  const tabs = useMemo(() => visibleTabs('user', sectionVisibility), [sectionVisibility]);

  // --- Erken dönüşler ------------------------------------------------------
  // Hepsi şablonun ÖNÜNDE: hiçbirinde pager, çöken başlık ya da sekme verisi
  // kurulmuyor.

  // Yükleme artık kendi profiliyle AYNI iskelet — R1'in yükleme tarafı bu.
  // `editable={false}`: "Düzenle" düğmesi gelmeyeceği için iskelette de yer
  // ayrılmıyor, yoksa içerik gelince kart kısalıp zıplardı.
  if (isPending) {
    return <ProfileSkeleton editable={false} />;
  }

  if (error) {
    const status = (error as any)?.response?.status;
    if (status === 403) {
      return (
        <View className="flex-1 items-center justify-center gap-3 px-8 bg-ground">
          <ShieldOff size={48} color="#f87171" />
          <Text className="text-[15px] font-semibold text-ink2 text-center">
            Profil görüntülemeniz admin tarafından yasaklanmıştır
          </Text>
        </View>
      );
    }
    // Sunucudan yanıt gelmeden başarısız olan istekler (zaman aşımı, bağlantı
    // kopması) eskiden de "Kullanıcı bulunamadı" gösteriyordu — yanıltıcıydı.
    // `err.response` yoksa bu bir ağ hatası, gerçek bir 404 değil.
    if (!(error as any)?.response) {
      return (
        <View className="flex-1 items-center justify-center gap-3 px-8 bg-ground">
          <StateView kind="error" title="Profil yüklenemedi." onAction={() => refetch()} />
        </View>
      );
    }
  }

  if (error || !profile) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-8 bg-ground">
        <UserIcon size={48} color={isDark ? '#4b5563' : '#d1d5db'} />
        <Text className="text-[15px] font-semibold text-ink2 text-center">Kullanıcı bulunamadı</Text>
      </View>
    );
  }

  const header = (
    <HeaderCard
      identity={identity}
      avatar={avatar}
      // `null` → rozet satırı hiç çizilmiyor (bölüm gizli). Boş dizi ise
      // "Henüz rozet yok." yazıyor — ikisi aynı şey değil.
      badges={badgesVisible ? badges : null}
      editable={false}
      postCount={profile.post_count}
    />
  );

  // GİZLİ PROFİL: şablon hiç mount olmuyor. (Alternatif — `tabs={[]}` geçip
  // şablona bir `notice` prop'u eklemek — şablona yalnızca burada kullanılacak
  // bir dal eklerdi; başlık kartı zaten `header` olarak elimizde.)
  if (profile.is_public === false) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-ground" contentContainerClassName="pb-[110px]">
        {header}
        <View className="items-center gap-2 py-8 px-[30px] mx-4 bg-surface rounded-lg" style={SHADOW_MD}>
          <Lock size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
          <Text className="text-lg text-muted font-semibold">Bu profil gizli.</Text>
          <Text className="text-sm text-muted2 text-center">
            Kullanıcı postlarını ve listelerini yalnızca kendisi görebilir.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return <ProfileTemplate scope={scope} tabs={tabs} header={header} />;
}
