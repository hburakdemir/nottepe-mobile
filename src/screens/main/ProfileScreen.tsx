import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bookmark } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/types';

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{user?.full_name}</Text>
      <Text style={styles.username}>@{user?.username}</Text>

      <Pressable style={styles.savedButton} onPress={() => navigation.navigate('SavedPosts')}>
        <Bookmark size={18} color="#1d4ed8" />
        <Text style={styles.savedButtonText}>Kaydedilenler</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Çıkış Yap</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
  },
  username: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 32,
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
