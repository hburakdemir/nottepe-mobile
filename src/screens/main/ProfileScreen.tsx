import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bookmark, User as UserIcon } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { badgeAPI } from '../../lib/api';
import BadgeChip, { type Badge } from '../../components/BadgeChip';
import type { RootStackParamList } from '../../navigation/types';

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    badgeAPI
      .getMine()
      .then((res) => setBadges(res.data?.badges || []))
      .catch(() => setBadges([]));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarFallback}>
        <UserIcon size={32} color="#fff" />
      </View>
      <Text style={styles.name}>{user?.full_name}</Text>
      <Text style={styles.username}>@{user?.username}</Text>
      {!!user?.department && (
        <Text style={styles.dept}>
          {user.department}
          {user.faculty ? ` · ${user.faculty}` : ''}
        </Text>
      )}
      {!!user?.bio && <Text style={styles.bio}>{user.bio}</Text>}

      {badges.length > 0 && (
        <View style={styles.badgeRow}>
          {badges.map((badge) => (
            <BadgeChip key={badge.id} badge={badge} />
          ))}
        </View>
      )}

      <Pressable style={styles.savedButton} onPress={() => navigation.navigate('SavedPosts')}>
        <Bookmark size={18} color="#1d4ed8" />
        <Text style={styles.savedButtonText}>Kaydedilenler</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Çıkış Yap</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  avatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: '#2F5755',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
  },
  username: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  dept: {
    fontSize: 12.5,
    color: '#9ca3af',
    marginTop: 6,
    textAlign: 'center',
  },
  bio: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 19,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    justifyContent: 'center',
  },
  savedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#1d4ed8',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 32,
    marginBottom: 14,
  },
  savedButtonText: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  button: {
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#dc2626',
    fontWeight: '600',
  },
});
