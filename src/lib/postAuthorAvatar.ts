import type { AvatarData } from '../components/avatar/AvatarDisplay';
import type { AvatarConfig } from '../constants/avatarConfig';
import type { Post } from '../types/post';
import type { Comment } from '../types/comment';

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
    photo_path: isStaffAuthor ? (post.avatar_photo_path ?? null) : null,
    display_mode: isStaffAuthor ? (post.avatar_display_mode ?? 'avatar') : 'avatar',
  };
}

// Yorum yazarının avatarı — post'unkiyle birebir aynı kural (fotoğraf yalnızca
// admin/moderatör'de). `commentModel.js` yorumla birlikte aynı alanları
// (avatar_config/avatar_photo_path/avatar_display_mode) zaten döndürüyordu,
// mobil taraf bunları hiç kullanmayıp sabit bir "User" ikonu gösteriyordu.
export function buildCommentAuthorAvatar(comment: Comment): AvatarData | null {
  const hasAvatar = !!comment.avatar_config || !!comment.avatar_photo_path;
  if (!hasAvatar) return null;

  const isStaffAuthor = comment.role === 'admin' || comment.role === 'moderator';

  return {
    config: (comment.avatar_config as Partial<AvatarConfig> | null) ?? null,
    photo_path: isStaffAuthor ? (comment.avatar_photo_path ?? null) : null,
    display_mode: isStaffAuthor ? (comment.avatar_display_mode ?? 'avatar') : 'avatar',
  };
}
