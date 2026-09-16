import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Bookmark, FileText, MessageSquare, Star } from 'lucide-react-native';
import { Skeleton } from './Skeleton';
import { useCardSurface, useFeedTokens } from '../theme/feedTokens';

// `PostCardModern`ın iskeleti. ÖLÇÜLER O DOSYADAN BİREBİR alındı (kart dolgusu,
// başlık 18px, dosya kutucuğu 54×54, alt satırdaki 24px avatar) — iskeletten
// içeriğe geçerken hiçbir şey yer değiştirmesin diye.
//
// Bunun yerine eskiden `NoteCardSkeleton` kullanılıyordu: avatarı ÜSTTE,
// başlığı hiç olmayan bir kart. O işaretleme artık kullanılmayan
// `PostCardClassic`ın düzeniydi; akışta, kaydedilenlerde ve profilde asıl
// çizilen kart Modern. Tek satırlık bir uyumsuzluk değil, kartın tamamı
// farklıydı.
//
// SABİT KALAN ÖGELER: kaydet / yıldız / yorum / dosya ikonları. Bunlar veriye
// bağlı değil, her kartta var — gri bloğa çevirmek iskeleti gerçek sayfadan
// uzaklaştırırdı. Yalnızca veriden gelen metinler ve avatar gri.
export default function PostCardSkeleton({ files = 1 }: { files?: number }) {
  const t = useFeedTokens();
  const cardSurface = useCardSurface();

  return (
    <View style={[styles.card, cardSurface]}>
      <View style={styles.crumbRow}>
        <Skeleton height={12} style={{ flex: 1, maxWidth: 210 }} />
        <View style={styles.save}>
          <Bookmark size={18} color={t.line} strokeWidth={2} />
        </View>
      </View>

      {/* Başlık iki satır: gerçek kartların ortalama yüksekliği. */}
      <View style={styles.titleBlock}>
        <Skeleton width="88%" height={18} />
        <Skeleton width="52%" height={18} />
      </View>

      <View style={styles.bodyBlock}>
        <Skeleton width="100%" height={13} />
        <Skeleton width="94%" height={13} />
        <Skeleton width="64%" height={13} />
      </View>

      {files > 0 && (
        <View style={styles.files}>
          {Array.from({ length: files }).map((_, i) => (
            <View key={i} style={styles.fileItem}>
              <View style={[styles.tile, { backgroundColor: t.inset }]}>
                <FileText size={22} color={t.line} strokeWidth={2} />
              </View>
              <Skeleton width={34} height={11} />
            </View>
          ))}
        </View>
      )}

      <View style={styles.foot}>
        <Skeleton width={24} height={24} radius={12} />
        <Skeleton width={74} height={12} />
        <Skeleton width={42} height={12} />
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Star size={14} color={t.line} strokeWidth={1.6} />
            <Skeleton width={22} height={12} />
          </View>
          <View style={styles.stat}>
            <MessageSquare size={14} color={t.line} strokeWidth={2} />
            <Skeleton width={16} height={12} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // PostCardModern.tsx `styles.card` ile aynı.
  card: { marginHorizontal: 12, marginTop: 10, paddingHorizontal: 16, paddingVertical: 18, borderRadius: 16, gap: 11 },
  crumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  save: { padding: 8 },
  titleBlock: { gap: 6 },
  bodyBlock: { gap: 8 },
  files: { flexDirection: 'row', gap: 14 },
  fileItem: { alignItems: 'center', gap: 6, width: 54 },
  tile: { width: 54, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  stats: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 13 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
