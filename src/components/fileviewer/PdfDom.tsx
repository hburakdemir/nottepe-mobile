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
  /** PDF'in base64'ü. Native taraf diske indirip buradan geçiriyor. */
  base64: string;
  /** Belge açıldı; sayfa sayısıyla birlikte. */
  onReady: (pages: number) => Promise<void>;
  /** Açılamadı. `code` native tarafta mesaj seçmek için. */
  onFail: (code: string, message: string) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function classifyError(error: unknown): { code: string; message: string } {
  const name = (error as { name?: string })?.name ?? '';
  const message = (error as { message?: string })?.message ?? 'Bilinmeyen hata';
  if (name === 'PasswordException') return { code: 'password', message };
  if (name === 'InvalidPDFException') return { code: 'invalid', message };
  return { code: 'unknown', message };
}

export default function PdfDom({ base64, onReady, onFail }: PdfDomProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    // Belgeyi `getDocument`'ın döndürdüğü GÖREV üzerinden kapatıyoruz:
    // yükleme yarıdayken de iptal edilebilen tek tutamaç bu.
    const task = pdfjsLib.getDocument({ data: base64ToBytes(base64) });

    async function renderPage(
      doc: pdfjsLib.PDFDocumentProxy,
      pageNumber: number,
      holder: HTMLDivElement
    ) {
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
      } catch {
        // Tek bir sayfanın çizilememesi belgenin tamamını düşürmemeli.
      }
    }

    (async () => {
      try {
        const doc = await task.promise;
        if (cancelled) return;

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
      void task.destroy();
    };
  }, [base64, onReady, onFail]);

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
          margin: 0 auto 10px;
          width: 100%;
          /* Sayfa gelene kadar yerini tutan koyu blok: canvas eklendiğinde
             içerik zıplamıyor. */
          min-height: 40px;
        }
        canvas { display: block; }
      `}</style>
      <div className="pages" ref={hostRef} />
    </>
  );
}
