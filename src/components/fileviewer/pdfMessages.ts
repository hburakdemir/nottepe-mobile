// PdfDom (WebView içi) → PdfHost (native) mesajları. Expo'nun fonksiyon
// prop'ları yerine bunlar kullanılıyor; gerekçesi PdfHost.tsx'te.
//
// `type` önekli: Expo'nun kendi köprü mesajları `$$` ile başlıyor ve bunlar
// `dom.onMessage`'a hiç düşmüyor; önek yalnızca karışıklığı önlemek için.

export type PdfRow = { page: number; items: { x: number; s: string }[] };

export type PdfMessage =
  /** Belge açıldı; sayfa sayısıyla birlikte. */
  | { type: 'pdfdom:ready'; pages: number }
  /** Açılamadı. `code` native tarafta mesaj seçmek için. */
  | { type: 'pdfdom:fail'; code: string; message: string }
  /** `mode="text"`: sayfaların metni satır satır, soldan sağa sıralı. */
  | { type: 'pdfdom:text'; rows: PdfRow[] };

export function parsePdfMessage(raw: string): PdfMessage | null {
  try {
    const message = JSON.parse(raw);
    return typeof message?.type === 'string' && message.type.startsWith('pdfdom:') ? message : null;
  } catch {
    return null;
  }
}
