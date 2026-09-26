'use dom';

// Bu dosya NATIVE'DE DEĞİL, bir WebView'ın içinde çalışıyor (Expo DOM
// Components). "use dom" direktifi Metro'ya bunu bir web paketi olarak
// derlemesini söylüyor; karşılığında pdfjs-dist'i sıradan bir npm paketi gibi
// import edebiliyoruz.
//
// Alternatif, pdf.js'i uygulamaya varlık olarak gömüp (assets/pdfjs/*.txt),
// expo-asset ile diske açıp, WebView'a file:// izinleriyle yüklemekti. O yol
// beş ayrı kırılgan halka demekti: Metro'nun assetExts'i, varlığın release
// APK'sında gerçekten file:// dönmesi, Android'de allowFileAccessFromFileURLs,
// sürüm damgalı bir kurulum dizini ve elle yazılmış bir viewer.html. DOM
// bileşeni bunların hepsini ortadan kaldırıyor.
//
// Dosya yine ÜÇÜNCÜ BİR SUNUCUYA GİTMİYOR: PDF cihazda çözülüyor, ne Google
// ne Microsoft görüntüleyicisi kullanılıyor.

import './pdfPolyfills'; // pdfjs'ten ÖNCE — gerekçesi o dosyada
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import { useEffect, useRef } from 'react';

// GERÇEK WEB WORKER KULLANILMIYOR — bilerek.
//
// pdf.js worker'ı `await import(workerSrc)` ile, yani çalışma anında bir URL'den
// yüklüyor; Metro böyle bir dinamik import'u çözemez. Ama pdf.js'in kendi kaçış
// yolu var: `globalThis.pdfjsWorker` tanımlıysa worker'ı ANA İŞ PARÇACIĞINDA
// kuruyor (pdf.mjs → PDFWorker.#mainThreadWorkerMessageHandler). Böylece worker
// modülü de normal bir import oluyor ve davranış her cihazda aynı.
//
// Bedeli, ayrıştırmanın UI'ı bir süre bloklaması. Yükleme sınırı 10 MB olduğu
// ve sayfalar tembel çizildiği için kabul edilebilir.
(globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = pdfjsWorker;

// Retina'da bile 2'nin üstüne çıkmıyoruz. A4 bir sayfa ölçek 3'te
// 2480×3508×4 bayt ≈ 35 MB; tek sayfa için bu, ucuz cihazlarda anında OOM.
const MAX_PIXEL_RATIO = 2;

export interface PdfDomProps {
  /**
   * Diske inmiş PDF'in `file://` adresi. Varsayılan yol bu: dosya WebView'ın
   * İÇİNDE okunuyor, ne Hermes'e ne köprüye bir bayt bile girmiyor (bkz.
   * `readLocalFile`).
   */
  uri?: string;
  /**
   * Yedek yol: PDF'in base64'ü. Yalnızca yerel okuma başarısız olursa ve dosya
   * küçükse PdfSlide bunu gönderiyor (bkz. PdfSlide `MAX_INLINE_BYTES`).
   */
  base64?: string;
  /** Belge açıldı; sayfa sayısıyla birlikte. */
  onReady: (pages: number) => Promise<void>;
  /** Açılamadı. `code` native tarafta mesaj seçmek için. */
  onFail: (code: string, message: string) => Promise<void>;
  /**
   * `'text'`: hiçbir şey ÇİZİLMİYOR; sayfaların metni satır satır ve soldan
   * sağa sıralı olarak `onText`'e veriliyor (transkript aktarma, bkz.
   * utils/transcript). Ayrı bir DOM bileşeni yerine bu dosyada bir mod, çünkü
   * her "use dom" dosyası kendi web paketi — pdf.js APK'ya ikinci kez girerdi.
   */
  mode?: 'render' | 'text';
  onText?: (rows: { page: number; items: { x: number; s: string }[] }[]) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
}

// Aynı satırdaki parçaların taban çizgisi birkaç birim oynayabiliyor
// (farklı yazı tipi/boyut); bu kadarı aynı satır sayılıyor.
const ROW_TOLERANCE = 2;

async function extractRows(doc: pdfjsLib.PDFDocumentProxy) {
  const out: { page: number; items: { x: number; s: string }[] }[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows: { y: number; items: { x: number; s: string }[] }[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = item.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) <= ROW_TOLERANCE);
      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }
      row.items.push({ x: item.transform[4], s: item.str });
    }
    // PDF'te y yukarı doğru artıyor: yukarıdan aşağı okumak için büyükten küçüğe.
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      out.push({ page: pageNumber, items: row.items });
    }
  }
  return out;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Dosya `fetch` ile DEĞİL XHR ile okunuyor: Chromium `fetch()`'i `file://`
// için hiç desteklemiyor, XHR ise sayfa da `file://`'dan geldiğinde
// (`file:///android_asset/www.bundle`) ve `allowFileAccessFromFileURLs` açıkken
// çalışıyor. İkisini de Expo'nun DOM sarmalayıcısı zaten açıyor
// (expo/src/dom/webview-wrapper.tsx). `file://`'da başarılı yanıtın durumu
// 200 değil 0 — o yüzden kontrol durum koduna değil yanıtın dolu olmasına.
class LocalReadError extends Error {
  name = 'LocalReadError';
}

function readLocalFile(uri: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', uri);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      const buffer = xhr.response as ArrayBuffer | null;
      if (buffer && buffer.byteLength > 0) resolve(new Uint8Array(buffer));
      else reject(new LocalReadError(`Boş yanıt (durum ${xhr.status})`));
    };
    xhr.onerror = () => reject(new LocalReadError('Yerel dosya okunamadı'));
    xhr.send();
  });
}

function classifyError(error: unknown): { code: string; message: string } {
  const name = (error as { name?: string })?.name ?? '';
  const message = (error as { message?: string })?.message ?? 'Bilinmeyen hata';
  // Ayrı kod: PdfSlide bunu görünce base64 yedeğine geçiyor.
  if (name === 'LocalReadError') return { code: 'local-read', message };
  if (name === 'PasswordException') return { code: 'password', message };
  if (name === 'InvalidPDFException') return { code: 'invalid', message };
  return { code: 'unknown', message };
}

export default function PdfDom({ uri, base64, onReady, onFail, mode = 'render', onText }: PdfDomProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    // Belgeyi `getDocument`'ın döndürdüğü GÖREV üzerinden kapatıyoruz:
    // yükleme yarıdayken de iptal edilebilen tek tutamaç bu. Yerel okuma
    // sürerken henüz görev yok; temizlik o durumda yalnızca bayrağı kaldırıyor.
    let task: ReturnType<typeof pdfjsLib.getDocument> | null = null;

    async function renderPage(doc: pdfjsLib.PDFDocumentProxy, pageNumber: number, holder: HTMLDivElement) {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;

        const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        const base = page.getViewport({ scale: 1 });
        // Sayfayı kabın genişliğine oturt, sonra ekran yoğunluğu kadar büyüt —
        // yakınlaştırmadan önce net, yakınlaştırınca kabul edilebilir.
        const fit = (holder.clientWidth || base.width) / base.width;
        const viewport = page.getViewport({ scale: fit * ratio });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        holder.appendChild(canvas);

        const context = canvas.getContext('2d');
        if (!context) return;
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (cancelled) return;

        // METİN KATMANI — kelime kelime seçip kopyalayabilmek için. Canvas
        // yalnızca bir resim; üstüne pdf.js'in görünmez (şeffaf) ama
        // SEÇİLEBİLİR metin katmanı biniyor. Katman CSS pikselinde çiziliyor
        // (`fit`, ekran yoğunluğu olmadan) çünkü canvas da CSS'te kabın
        // genişliğine oturuyor. Katman kurulamazsa sayfa yine görünür kalıyor;
        // yalnızca seçim çalışmaz.
        try {
          const textDiv = document.createElement('div');
          textDiv.className = 'textLayer';
          textDiv.style.setProperty('--total-scale-factor', String(fit));
          holder.appendChild(textDiv);
          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: page.streamTextContent(),
            container: textDiv,
            viewport: page.getViewport({ scale: fit }),
          });
          await textLayer.render();
        } catch {
          // Seçim olmadan devam.
        }
      } catch {
        // Tek bir sayfanın çizilememesi belgenin tamamını düşürmemeli.
      }
    }

    (async () => {
      try {
        const data = uri ? await readLocalFile(uri) : base64 ? base64ToBytes(base64) : null;
        if (cancelled || !data) return;
        task = pdfjsLib.getDocument({ data });
        const doc = await task.promise;
        if (cancelled) return;

        if (mode === 'text') {
          const rows = await extractRows(doc);
          if (!cancelled) await onText?.(rows);
          return;
        }

        // Her sayfa için bir tutucu; çizim, sayfa görünür alana YAKLAŞINCA
        // yapılıyor. 200 sayfalık bir ders notunu baştan çizmek belleği anında
        // tüketiyordu.
        const rendered = new Set<number>();

        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const holder = entry.target as HTMLDivElement;
              const pageNumber = Number(holder.dataset.page);
              if (rendered.has(pageNumber)) continue;
              rendered.add(pageNumber);
              void renderPage(doc, pageNumber, holder);
            }
          },
          { rootMargin: '600px 0px' }
        );

        for (let i = 1; i <= doc.numPages; i += 1) {
          const holder = document.createElement('div');
          holder.dataset.page = String(i);
          holder.className = 'page';
          host.appendChild(holder);
          observer.observe(holder);
        }

        await onReady(doc.numPages);
      } catch (error) {
        if (cancelled) return;
        const { code, message } = classifyError(error);
        await onFail(code, message);
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      void task?.destroy();
    };
  }, [uri, base64, onReady, onFail, mode, onText]);

  return (
    <>
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          background: #0B0E12;
          /* Yatayda kaydırma KAPALI: dıştaki dosya galerisi yatay dokunuşu
             ancak WebView "burada kaydıracak yerim yok" dediğinde alabiliyor.
             Yakınlaştırıldığında içerik yatayda kaydırılabilir hâle geliyor ve
             galeri kendiliğinden devreden çıkıyor — resim slaytındaki zoom
             kilidiyle aynı davranış. */
          overflow-x: hidden;
          touch-action: pan-y pinch-zoom;
          -webkit-text-size-adjust: 100%;
        }
        .pages { padding: 8px 0 24px; }
        .page {
          position: relative;
          margin: 0 auto 10px;
          width: 100%;
          /* Sayfa gelene kadar yerini tutan koyu blok: canvas eklendiğinde
             içerik zıplamıyor. */
          min-height: 40px;
        }
        canvas { display: block; }
        /* pdf.js metin katmanı — web/pdf_viewer.css'teki .textLayer kurallarının
           DÜZ (iç içe olmayan) karşılığı. Orijinali CSS nesting ve round()
           kullanıyor; ikisi de eski Android WebView'larında (Chrome < 112/125)
           yok ve kural tamamen düşüyordu. Genişlik/yükseklik pdf.js'in
           round()'lu satır içi değerleri yerine inset:0 ile kaptan geliyor. */
        .textLayer {
          position: absolute;
          inset: 0;
          width: 100% !important;
          height: 100% !important;
          overflow: hidden;
          line-height: 1;
          text-align: initial;
          letter-spacing: normal;
          word-spacing: normal;
          -webkit-text-size-adjust: none;
          text-size-adjust: none;
          forced-color-adjust: none;
          transform-origin: 0 0;
          z-index: 0;
          --min-font-size: 1;
          --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
          --min-font-size-inv: calc(1 / var(--min-font-size));
        }
        .textLayer span, .textLayer br {
          color: transparent;
          position: absolute;
          white-space: pre;
          cursor: text;
          transform-origin: 0% 0%;
          -webkit-user-select: text;
          user-select: text;
        }
        .textLayer > :not(.markedContent),
        .textLayer .markedContent span:not(.markedContent) {
          z-index: 1;
          --font-height: 0;
          font-size: calc(var(--text-scale-factor) * var(--font-height));
          --scale-x: 1;
          --rotate: 0deg;
          transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
        }
        .textLayer .markedContent { display: contents; }
        .textLayer span[role='img'] { -webkit-user-select: none; user-select: none; cursor: default; }
        .textLayer ::selection { background: rgba(0, 100, 255, 0.3); }
      `}</style>
      <div className="pages" ref={hostRef} />
    </>
  );
}
