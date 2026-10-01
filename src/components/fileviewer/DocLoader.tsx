import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ArrowDown } from 'lucide-react-native';
import { fileExtension, fileKind, type FileKind } from '../../theme/feedTokens';
import { VIEWER_INK, VIEWER_INK_DIM, VIEWER_LINE } from './viewerTokens';

// Görüntüleyicinin yükleme göstergesi — klasik spinner yerine dosyanın kendisi:
// köşesi kıvrık bir belge, indirme ilerledikçe ALTTAN dolan. Yüzde bilinmiyorsa
// (Content-Length yok, ya da indirme bitti ve dosya açılıyor) içinde yavaşça
// yükselip alçalan bir dolgu nefes alıyor.
//
// Renk dosya türünden: PDF kırmızı, Word mavi, Excel yeşil, PowerPoint turuncu —
// kullanıcının Dosyalar uygulamasından tanıdığı renkler.

const KIND_COLOR: Record<FileKind, string> = {
  pdf: '#E5534B',
  word: '#3B82F6',
  sheet: '#22A06B',
  slide: '#F28C38',
  image: '#8B5CF6',
  other: '#5A9690',
};

const DOC_W = 76;
const DOC_H = 96;
const FOLD = 22;
// Sıvı dalgası: belgeden çok büyük, köşeleri yuvarlatılmış bir kare DÖNÜYOR;
// yalnızca üst kenarı belgenin içinde görünüyor ve o kenar dönerken dalga gibi
// iniş çıkış yapıyor. İki katman farklı hız/yönde → derinlik.
const WAVE = 190;
const WAVE_RADIUS = WAVE * 0.42;

export function formatMegabytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
}

interface Props {
  fileName?: string;
  /** 0-1; null/undefined → belirsiz (dalga seviyesi yükselip alçalıyor). */
  progress?: number | null;
}

export default function DocLoader({ fileName, progress }: Props) {
  const color = KIND_COLOR[fileKind(fileName)];
  const ext = fileExtension(fileName).toUpperCase().slice(0, 4);
  const determinate = progress != null;

  const level = useSharedValue(determinate ? progress : 0.15);
  const float = useSharedValue(0);
  const spin = useSharedValue(0);
  const bounce = useSharedValue(0);

  useEffect(() => {
    if (determinate) {
      cancelAnimation(level);
      // İlerleme olayları basamaklı geliyor; dolgu aralarda yumuşak aksın.
      level.value = withTiming(progress, { duration: 320, easing: Easing.out(Easing.cubic) });
    } else {
      level.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.15, { duration: 1100, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      );
    }
  }, [determinate, progress, level]);

  // Sürekli hareket: belge süzülüyor, dalga dönüyor, ok zıplıyor.
  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    spin.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false);
    bounce.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => {
      cancelAnimation(float);
      cancelAnimation(spin);
      cancelAnimation(bounce);
    };
  }, [float, spin, bounce]);

  // Dalganın üst kenarı = dolgu seviyesi. Kare WAVE boyunda; üst kenarını
  // seviyeye oturtmak için kare (WAVE - kenar sarkması) kadar yukarı kaydırılıyor.
  const waveTop = (l: number) => {
    'worklet';
    const clamped = Math.max(0, Math.min(1, l));
    return DOC_H * (1 - clamped) - 8;
  };
  const backWaveStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: waveTop(level.value) - 3 }, { rotate: `${-spin.value * 360 + 40}deg` }],
  }));
  const frontWaveStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: waveTop(level.value) }, { rotate: `${spin.value * 360}deg` }],
  }));
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * float.value }] }));
  const arrowStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + 0.45 * bounce.value,
    transform: [{ translateY: 5 * bounce.value }],
  }));
  const downloading = determinate && progress < 1;

  return (
    <Animated.View style={[styles.doc, floatStyle]}>
      <View style={[styles.body, { borderColor: color }]}>
        <Animated.View style={[styles.wave, { backgroundColor: color, opacity: 0.45 }, backWaveStyle]} />
        <Animated.View style={[styles.wave, { backgroundColor: color, opacity: 0.9 }, frontWaveStyle]} />
        {!!ext && <Text style={styles.ext}>{ext}</Text>}
        {downloading && (
          <Animated.View style={[styles.arrow, arrowStyle]}>
            <ArrowDown size={16} color={VIEWER_INK} strokeWidth={2.5} />
          </Animated.View>
        )}
      </View>
      {/* Kıvrık köşe: gövdenin sağ üstünü zemin rengiyle "keser", üstüne
          katlanmış üçgeni çizer. */}
      <View style={styles.cornerMask} />
      <View style={[styles.corner, { borderLeftColor: color }]} />
    </Animated.View>
  );
}

/** Belgenin altında: "1,2 MB / 3,9 MB · %31" ya da yalnızca inen miktar. */
export function DownloadStats({ bytesWritten, totalBytes }: { bytesWritten?: number; totalBytes?: number | null }) {
  if (!bytesWritten) return null;
  const text =
    totalBytes && totalBytes > 0
      ? `${formatMegabytes(bytesWritten)} / ${formatMegabytes(totalBytes)} · %${Math.min(100, Math.floor((bytesWritten / totalBytes) * 100))}`
      : `${formatMegabytes(bytesWritten)} hazır`;
  return <Text style={styles.stats}>{text}</Text>;
}

const styles = StyleSheet.create({
  doc: { width: DOC_W, height: DOC_H, marginBottom: 6 },
  body: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderRadius: 10,
    borderTopRightRadius: 4,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: VIEWER_LINE,
  },
  wave: {
    position: 'absolute',
    top: 0,
    left: (DOC_W - 4 - WAVE) / 2,
    width: WAVE,
    height: WAVE,
    borderRadius: WAVE_RADIUS,
  },
  arrow: { marginTop: 4 },
  ext: { color: VIEWER_INK, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  cornerMask: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: FOLD + 2,
    height: FOLD + 2,
    backgroundColor: '#0B0E12',
  },
  corner: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    // Sıfır boyutlu kutunun sol + üst kenarlığı: köşegen sol üstten sağ alta
    // iniyor, renkli sol kenarlık ALT-SOL üçgeni (katlanmış kulak) dolduruyor.
    borderLeftWidth: FOLD,
    borderTopWidth: FOLD,
    borderTopColor: 'transparent',
  },
  stats: { color: VIEWER_INK_DIM, fontSize: 13, fontVariant: ['tabular-nums'], textAlign: 'center' },
});
