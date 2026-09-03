import type { AvatarData } from '../components/avatar/AvatarDisplay';
import type { AvatarConfig } from '../constants/avatarConfig';
import type { Post } from '../types/post';

// Kart üzerindeki yazar avatarı, gönderi yanıtıyla birlikte gelen alanlardan
// kuruluyor (ayrı istek yok — web'deki PostCard.jsx ile aynı desen).
//
// KURAL: yüklenen FOTOĞRAF yalnızca admin/moderatör yazarlarda gösteriliyor;
// normal kullanıcılarda her zaman çizim avatar render ediliyor. Bu yüzden
// `display_mode` staff olmayan herkes için 'avatar'a zorlanıyor.
export function buildPostAuthorAvatar(post: Post): AvatarData | null {
  const hasAvatar = !!post.avatar_config || !!post.avatar_photo_path;
  if (!hasAvatar) return null;

  const isStaffAuthor = post.user_role === 'admin' || post.user_role === 'moderator';

  return {
    config: (post.avatar_config as Partial<AvatarConfig> | null) ?? null,
    photo_path: isStaffAuthor ? post.avatar_photo_path ?? null : null,
    display_mode: isStaffAuthor ? post.avatar_display_mode ?? 'avatar' : 'avatar',
  };
}
