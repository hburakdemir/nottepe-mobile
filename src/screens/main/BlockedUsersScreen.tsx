import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ban } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { moderationAPI } from '../../lib/api';
import { emitBlockChanged } from '../../lib/moderationEvents';
import { useThemeColors } from '../../context/ThemeContext';
import type { RootStackParamList } from '../../navigation/types';

interface BlockedUser {
  id: number;
  username: string;
  full_name?: string;
}

// Ayarlar → Engellenen kullanıcılar. Eskiden Profil → Düzenle modalının
// altında küçük bir kutuydu; Ayarlar sayfası gelince kendi ekranına taşındı.
// Engel çift yönlü (bkz. server/utils/blockFilter.js) — üstteki not bunu
// kullanıcıya anlatıyor.
export default function BlockedUsersScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [users, setUsers] = useState<BlockedUser[] | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  // Bir profilden engel kaldırıp geri dönülünce liste bayat kalmasın.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      moderationAPI
        .myBlocks()
        .then((res) => alive && setUsers(res.data?.users ?? []))
        .catch(() => alive && setUsers([]));
      return () => {
        alive = false;
      };
    }, [])
  );

  const unblock = (u: BlockedUser) => {
    Alert.alert('Engeli kaldır', `@${u.username} kullanıcısının engelini kaldırmak istiyor musun?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Engeli kaldır',
        onPress: async () => {
          setPendingId(u.id);
          try {
            await moderationAPI.unblock(u.id);
            setUsers((prev) => (prev ? prev.filter((x) => x.id !== u.id) : prev));
            emitBlockChanged(u.id, false);
            queryClient.invalidateQueries();
          } catch {
            Alert.alert('Hata', 'Engel kaldırılamadı.');
          } finally {
            setPendingId(null);
          }
        },
      },
    ]);
  };

  const intro = (
    <Text className="text-muted text-[13px] leading-[19px] mb-4">
      Engellediğin kişiler senin içeriklerini, sen de onlarınkini göremezsiniz. Birbirinizin gönderilerine yorum yapamaz,
      puan veremezsiniz. Engellediğin kişiye bildirim gitmez.
    </Text>
  );

  if (users === null) {
    return (
      <View className="flex-1 bg-ground items-center justify-center">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-ground"
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      data={users}
      keyExtractor={(u) => String(u.id)}
      ListHeaderComponent={intro}
      ListEmptyComponent={
        <View className="items-center py-12 gap-3">
          <Ban size={36} color={colors.muted2} />
          <Text className="text-muted text-[14px]">Engellediğin kimse yok.</Text>
        </View>
      }
      renderItem={({ item: u, index }) => (
        <View
          className={`flex-row items-center gap-3 bg-surface border-line-soft px-4 py-3 ${
            index === 0 ? 'rounded-t-[14px] border' : 'border-x border-b'
          } ${index === users.length - 1 ? 'rounded-b-[14px]' : ''}`}
        >
          <Pressable className="flex-1" onPress={() => navigation.navigate('UserProfile', { username: u.username })}>
            {!!u.full_name && (
              <Text className="text-ink text-[15px] font-semibold" numberOfLines={1}>
                {u.full_name}
              </Text>
            )}
            <Text className="text-muted text-[13px]" numberOfLines={1}>
              @{u.username}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => unblock(u)}
            disabled={pendingId === u.id}
            hitSlop={8}
            className="px-3 py-1.5 rounded-full bg-inset"
          >
            {pendingId === u.id ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text className="text-accent text-[13px] font-bold">Engeli kaldır</Text>
            )}
          </Pressable>
        </View>
      )}
    />
  );
}
