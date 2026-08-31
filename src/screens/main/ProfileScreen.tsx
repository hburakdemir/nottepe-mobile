import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{user?.full_name}</Text>
      <Text style={styles.username}>@{user?.username}</Text>

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
