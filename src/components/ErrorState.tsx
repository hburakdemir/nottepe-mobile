import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RefreshCw, WifiOff } from 'lucide-react-native';
import { useNetwork } from '../context/NetworkContext';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { isConnected } = useNetwork();

  return (
    <View style={styles.container}>
      {!isConnected ? <WifiOff size={28} color="#9ca3af" /> : null}
      <Text style={styles.text}>
        {message || (isConnected ? 'Bir şeyler ters gitti.' : 'İnternet bağlantısı yok.')}
      </Text>
      {onRetry ? (
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <RefreshCw size={14} color="#2F5755" />
          <Text style={styles.retryText}>Tekrar dene</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  text: { color: '#6b7280', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#2F5755',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 4,
  },
  retryText: { color: '#2F5755', fontSize: 13.5, fontWeight: '700' },
});
