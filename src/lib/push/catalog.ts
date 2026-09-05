import { Bell, BookOpen, CheckCircle, HeartHandshake, Megaphone, MessageSquare, UtensilsCrossed, type LucideIcon } from 'lucide-react-native';
import type { PushTypeDescriptor } from '../api';

// Bu dosya bir FİLTRE DEĞİL, bir CİLA TABLOSU.
//
// Hangi push tiplerinin var olduğunun, hangi sırada durduğunun, hangi gruba
// düştüğünün ve varsayılanının TEK yetkili kaynağı sunucunun `available_types`
// dizisi (bkz. plan 3.4). Burası yalnızca bilinen anahtarlara Türkçe metin ve
// lucide ikonu ekliyor.
//
// Kritik sonuç: sunucu yarın yeni bir cron tipi eklediğinde katalogda karşılığı
// olmayan anahtar YOK SAYILMAZ — sunucunun kendi `label`/`description`'ı ve
// jenerik `Bell` ikonuyla zaten yayınlanmış APK'larda anında görünür. Katalog
// bir izin listesi olsaydı yeni her tip için uygulama sürümü çıkmak gerekirdi.

export interface PushTypeCatalogEntry {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Sunucu `group` göndermezse kullanılacak yedek grup. */
  group: string;
}

export const PUSH_TYPE_CATALOG: PushTypeCatalogEntry[] = [
  {
    key: 'comment_on_post',
    label: 'Gönderime yorum geldiğinde',
    description: 'Paylaştığın nota biri yorum yazarsa bildirim al.',
    // Aktivite listesindeki (NotificationsScreen ACTIVITY_TYPE_META) ikonun
    // aynısı: kullanıcı ayarda kapattığı satırı listede tanıyabilsin.
    icon: MessageSquare,
    group: 'activity',
  },
  {
    key: 'dept_new_post',
    label: 'Takip ettiğim bölümde yeni not',
    description: 'Takip ettiğin bölüme yeni bir not yüklenirse haber ver.',
    icon: BookOpen,
    group: 'activity',
  },
  {
    key: 'announcement',
    label: 'Duyurular',
    description: 'Nottepe ekibinin yayınladığı duyuruları bildirim olarak al.',
    icon: Megaphone,
    group: 'announcement',
  },
  {
    key: 'post_approved',
    label: 'Paylaştığım not onaylandığında',
    description: 'Paylaştığın bir not onaylanıp yayına girdiğinde bildirim al.',
    icon: CheckCircle,
    group: 'activity',
  },
  {
    key: 'request_fulfilled',
    label: 'Not isteğim karşılandığında',
    description: 'Açtığın bir not isteğine biri not paylaşırsa bildirim al.',
    icon: HeartHandshake,
    group: 'activity',
  },
  {
    key: 'cafeteria_daily',
    label: 'Günlük yemekhane menüsü',
    description: 'Her gün seçtiğin saatte o günün yemekhane menüsünü bildirim olarak al.',
    icon: UtensilsCrossed,
    group: 'daily',
  },
];

// Grup başlıkları da cila: bilinmeyen bir grup anahtarı geldiğinde ham anahtar
// başlık olarak yazılıyor — çirkin ama görünür, yani panel eksik çizilmiyor.
export const PUSH_GROUP_LABELS: Record<string, string> = {
  activity: 'Aktivite',
  announcement: 'Duyurular',
  daily: 'Günlük',
};

const CATALOG_BY_KEY = new Map(PUSH_TYPE_CATALOG.map((entry) => [entry.key, entry]));

export interface ResolvedPushType {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: string;
  default: boolean;
}

// Sunucu tanımı + istemci cilası. Metinlerde katalog önde: sunucunun etiketleri
// yönetim panelinden girildiği için ham/İngilizce olabiliyor, katalogdakiler
// gözden geçirilmiş Türkçe. Katalogda karşılığı olmayan anahtar sunucunun kendi
// metnine düşüyor (yukarıdaki not).
export function resolvePushType(descriptor: PushTypeDescriptor): ResolvedPushType {
  const entry = CATALOG_BY_KEY.get(descriptor.key);
  return {
    key: descriptor.key,
    label: entry?.label ?? descriptor.label ?? descriptor.key,
    description: entry?.description ?? descriptor.description ?? '',
    icon: entry?.icon ?? Bell,
    // Grupta ise sunucu önde: gruplama sıralamanın bir parçası ve sıra sunucunun.
    group: descriptor.group ?? entry?.group ?? 'other',
    default: descriptor.default,
  };
}

export function pushGroupLabel(group: string): string {
  return PUSH_GROUP_LABELS[group] ?? group;
}
