import PostCardClassic from './PostCardClassic';
import PostCardModern from './PostCardModern';

// Kart tasarımının tek anahtarı. Yeni (onaylanan) düzeni beğenmezsen tek
// yapman gereken burayı 'classic' yapmak — kartı kullanan 6 ekranın hiçbiri
// değişmiyor, iki varyantın prop sözleşmesi birebir aynı:
//   { post, showStatus?, showRating?, onDelete? }
//
//   'modern'  → PostCardModern.tsx  (tarih solda / avatar+isim sağda, tek
//                                    yıldız + basınca açılan oy paneli)
//   'classic' → PostCardClassic.tsx (eski tasarım, olduğu gibi korundu)
const POSTCARD_VARIANT: 'modern' | 'classic' = 'modern';

const PostCard = POSTCARD_VARIANT === 'modern' ? PostCardModern : PostCardClassic;

export default PostCard;
