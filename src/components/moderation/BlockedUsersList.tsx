import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ban } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { moderationAPI } from '../../lib/api';
import { emitBlockChanged } from '../../lib/moderationEvents';
import { useThemeColors } from '../../context/ThemeContext';

interface BlockedUser {
  id: number;
  username: string;
  full_name?: string;
}

// Profil → Düzenle → Görünürlük altında: engellenen kullanıcılar ve engel kaldırma.
export default function BlockedUsersList() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<BlockedUser[] | null>(null);

  useEffect(() => {
    let alive = true;
    moderationAPI
      .myBlocks()
      .then((res) => alive && setUsers(res.data?.users ?? []))
      .catch(() => alive && setUsers([]));
    return () => {
      alive = false;
    };
  }, []);

  const unblock = async (u: BlockedUser) => {
    try {
      await moderationAPI.unblock(u.id);
      setUsers((prev) => (prev ? prev.filter((x) => x.id !== u.id) : prev));
      emitBlockChanged(u.id, false);
      queryClient.invalidateQueries();
    } catch {
      Alert.alert('Hata', 'Engel kaldırılamadı.');
    }
  };

  return (
    <View style={[styles.box, { borderColor: colors.lineSoft }]}>
      <View style={styles.header}>
        <Ban size={15} color={colors.muted} />
        <Text style={[styles.title, { color: colors.ink2 }]}>Engellenen kullanıcılar</Text>
      </View>
      {users === null ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 6 }} />
      ) : users.length === 0 ? (
        <Text style={[styles.empty, { color: colors.muted2 }]}>Engellediğin kimse yok.</Text>
      ) : (
        users.map((u) => (
          <View key={u.id} style={[styles.row, { borderTopColor: colors.lineSoft }]}>
            <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
              @{u.username}
            </Text>
            <Pressable onPress={() => unblock(u)} hitSlop={8}>
              <Text style={[styles.action, { color: colors.accent }]}>Engeli kaldır</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontSize: 13, fontWeight: '600' },
  empty: { fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1, fontSize: 13.5 },
  action: { fontSize: 12.5, fontWeight: '700' },
});
