import React, { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HelpCircle, Lightbulb, MessagesSquare } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { RootStackParamList } from '../../navigation/types';
import { useMyForumActivity, type ForumItem } from '../../hooks/profile/useProfileLists';
import PagerPage, { type ProfileTabProps } from './PagerPage';
import { EmptyState, SHADOW_SM, TabLoading, formatDate } from './profileCommon';

const ForumRow = React.memo(function ForumRow({
  item,
  onOpen,
  iconColor,
}: {
  item: ForumItem;
  onOpen: (item: ForumItem) => void;
  iconColor: string;
}) {
  return (
    <Pressable className="flex-row gap-2 bg-surface rounded-lg p-3.5 mb-3" style={SHADOW_SM} onPress={() => onOpen(item)}>
      {item.kind === 'faq' ? <HelpCircle size={15} color={iconColor} /> : <Lightbulb size={15} color={iconColor} />}
      <View className="flex-1">
        <Text className="text-[11.5px] font-semibold text-muted">{item.title}</Text>
        {!!item.body && (
          <Text className="text-sm text-ink2 mt-[3px]" numberOfLines={2}>
            {item.body}
          </Text>
        )}
        <Text className="text-[10.5px] text-muted2 mt-1">{formatDate(item.created_at)}</Text>
      </View>
    </Pressable>
  );
});

// Profil > Forumlar sekmesi — SSS yorumları ve öneri etkinliği tek listede.
function ForumsTab({ active, width, headerHeight, scrollY, onRememberOffset }: ProfileTabProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { theme } = useTheme();
  // `bg-brand` ile aynı marka rengi — temadan bağımsız olduğu için ham değer.
  const iconColor = theme === 'dark' ? '#5A9690' : '#2F5755';

  // Sorgu yalnızca sekme görünürken çalışıyor: forum etkinliği İKİ ağ isteği
  // (SSS + öneriler) ve sekme şeridinde sayacı yok — diğer beşinin aksine
  // açılışta çekilmesi için bir sebep yok.
  const { data: items, isPending } = useMyForumActivity(active ? user?.id : undefined);
  // bkz. ChecklistsTab.tsx — aynı gecikmeli yükleme kuralı.
  const showLoading = isPending;

  const handleOpen = useCallback(
    (item: ForumItem) =>
      item.kind === 'faq'
        ? navigation.navigate('FaqDetail', { id: item.targetId })
        : navigation.navigate('SuggestionDetail', { id: item.targetId }),
    [navigation]
  );

  return (
    <PagerPage
      tabKey="forums"
      width={width}
      headerHeight={headerHeight}
      scrollY={scrollY}
      onRememberOffset={onRememberOffset}
    >
      {active &&
        (showLoading ? (
          <TabLoading />
        ) : !items || items.length === 0 ? (
          <EmptyState icon={MessagesSquare} text="Henüz bir foruma katılmadı." />
        ) : (
          items.map((item) => <ForumRow key={item.key} item={item} onOpen={handleOpen} iconColor={iconColor} />)
        ))}
    </PagerPage>
  );
}

export default React.memo(ForumsTab);
