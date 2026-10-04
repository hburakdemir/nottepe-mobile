import React, { useCallback, useRef } from 'react';
import type { DOMProps } from 'expo/dom';
import PdfDom from './PdfDom';
import { parsePdfMessage, type PdfRow } from './pdfMessages';

interface Props {
  /** Diske inmiş PDF'in `file://` adresi (bkz. PdfDom `uri`). */
  uri?: string;
  /** Yedek yol: PDF'in base64'ü (bkz. PdfDom `base64`). */
  base64?: string;
  mode?: 'render' | 'text';
  /** Belge açıldı; sayfa sayısıyla birlikte. */
  onReady?: (pages: number) => void;
  /** Açılamadı. `code` mesaj seçmek için (bkz. PdfDom `classifyError`). */
  onFail: (code: string, message: string) => void;
  /** `mode="text"`: sayfaların metni satır satır. */
  onText?: (rows: PdfRow[]) => void;
  dom?: DOMProps;
}

// PdfDom'un native yüzü. PdfDom fonksiyon prop'u ALMIYOR; sonucunu
// `pdfdom:*` mesajlarıyla gönderiyor, burada `dom.onMessage` ile alınıp eski
// geri çağrı arayüzüne çevriliyor.
//
// Neden Expo'nun kendi fonksiyon prop'ları değil: köprüleri soğuk açılışta
// kalıcı olarak kopabiliyor ve native çağrılar sessizce düşüyor (ayrıntısı
// PdfDom.tsx `post`). Expo'nun PROP GÜNCELLEMELERİ de aynı köprüden geçtiği
// için bu bileşen belge değiştiğinde WebView'ı `key` ile yeniden kuruyor:
// ilk prop'lar sayfa yüklenmeden önce gömülüyor (`$$EXPO_INITIAL_PROPS`), o
// yol köprüye bağlı değil.
export default function PdfHost({ uri, base64, mode, onReady, onFail, onText, dom }: Props) {
  // Mesaj işleyicisi her render'da yeniden kuruluyor; en güncel geri
  // çağrıları ref'ten okuyor ki çağıranın useCallback kullanması gerekmesin.
  const handlers = useRef({ onReady, onFail, onText });
  handlers.current = { onReady, onFail, onText };

  const onMessage = useCallback<NonNullable<DOMProps['onMessage']>>((event) => {
    const message = parsePdfMessage(event.nativeEvent.data);
    if (!message) return;
    if (message.type === 'pdfdom:ready') handlers.current.onReady?.(message.pages);
    else if (message.type === 'pdfdom:fail') handlers.current.onFail(message.code, message.message);
    else handlers.current.onText?.(message.rows);
  }, []);

  return (
    <PdfDom
      key={uri ?? (base64 ? `b64:${base64.length}` : 'empty')}
      uri={uri}
      base64={base64}
      mode={mode}
      dom={{ ...dom, onMessage }}
    />
  );
}
