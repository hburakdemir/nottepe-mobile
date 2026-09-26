import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export type UnblockReason = 'regret' | 'reconciled';

interface Props {
  // 'them': profil sahibi BENİ engelledi — sadece mesaj.
  // 'me': ben onu engelledim — "Engeli aç" → "Pişmanım" / "Barıştık".
  mode: 'them' | 'me';
  onUnblock?: (reason: UnblockReason) => Promise<void>;
}

const COPY = {
  them: {
    top: "Nottepe'den engel yiyecek kadar ne yaşadınız be, Spotify engelinin bir üstü burasıdır -_-",
    middle: 'Üzgünüm, engellendiğin için bu profili sana gösteremem.',
  },
  me: {
    top: "Nottepe'den engelleyecek kadar ne yapmış olabilir sana?",
    middle: 'Kararımdan vazgeçiyorum ya, engeli açacağım.',
  },
} as const;

// Engelli profil ekranı (kullanıcı isteği): dil çıkaran geyik fotoğrafı
// arkada, üstte espri, ortada asıl mesaj ve altında düğmeler. Metinler
// fotoğrafın üstünde okunsun diye üstte ve ortada koyu gradyan var. Web karşılığı:
// client/src/components/moderation/BlockedDeerCard.jsx.
export default function BlockedDeerCard({ mode, onUnblock }: Props) {
  const [step, setStep] = useState<'idle' | 'choose'>('idle');
  const [pending, setPending] = useState<UnblockReason | null>(null);
  const copy = COPY[mode];

  const choose = async (reason: UnblockReason) => {
    if (!onUnblock) return;
    setPending(reason);
    try {
      await onUnblock(reason);
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={styles.card}>
      <Image
        source={require('../../../assets/images/blocked-deer.webp')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessibilityLabel="Dil çıkaran geyik"
      />
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
        <Defs>
          <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity="0.75" />
            <Stop offset="0.24" stopColor="#000" stopOpacity="0.1" />
            <Stop offset="0.42" stopColor="#000" stopOpacity="0.15" />
            <Stop offset="0.62" stopColor="#000" stopOpacity="0.6" />
            <Stop offset="0.8" stopColor="#000" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill="url(#scrim)" />
      </Svg>

      <Text style={styles.top}>{copy.top}</Text>

      <View style={styles.center}>
        <Text style={styles.middle}>{copy.middle}</Text>

        {mode === 'me' &&
          (step === 'idle' ? (
            <Pressable style={styles.primary} onPress={() => setStep('choose')} accessibilityRole="button">
              <Text style={styles.primaryText}>Engeli aç</Text>
            </Pressable>
          ) : (
            <View style={styles.row}>
              {(
                [
                  ['regret', 'Pişmanım'],
                  ['reconciled', 'Barıştık'],
                ] as const
              ).map(([reason, label]) => (
                <Pressable
                  key={reason}
                  style={[styles.choice, pending && pending !== reason ? { opacity: 0.5 } : null]}
                  onPress={() => choose(reason)}
                  disabled={!!pending}
                  accessibilityRole="button"
                >
                  {pending === reason ? (
                    <ActivityIndicator color="#1f2937" />
                  ) : (
                    <Text style={styles.choiceText}>{label}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fotoğraf dikey (2:3); kart da aynı oranda, genişliği ebeveyn belirliyor.
  card: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1f2a1c',
  },
  top: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  // Kartın dikey ortası (kullanıcı isteği: mesaj "ortada", düğme altında) —
  // biraz aşağıda, geyiğin dil çıkaran ağzını örtmesin.
  center: {
    ...StyleSheet.absoluteFillObject,
    top: '50%',
    bottom: undefined,
    paddingHorizontal: 20,
    gap: 14,
    alignItems: 'center',
  },
  middle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  primary: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 28, paddingVertical: 12 },
  primaryText: { color: '#1f2937', fontSize: 15, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12 },
  choice: {
    backgroundColor: '#fff',
    borderRadius: 999,
    minWidth: 120,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  choiceText: { color: '#1f2937', fontSize: 15, fontWeight: '800' },
});
