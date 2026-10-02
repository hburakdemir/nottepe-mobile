// pdfjs-dist 6'nın "legacy" derlemesi bile `Promise.withResolvers` kullanıyor
// ve onu POLYFILL ETMİYOR (core-js'i içeriyor ama bu metot listesinde yok —
// `Promise.try` var, `withResolvers` yok). Metot Chrome 119 / Safari 17.4 ile
// geldi; Android'de System WebView sürümü cihaza ve kullanıcının Play Store
// güncellemelerine bağlı olduğundan ucuz ya da güncellenmemiş telefonlarda
// Chrome 90-110 hâlâ çok yaygın. Polyfill olmadan orada PDF açmak yerine boş
// bir ekran ve `Promise.withResolvers is not a function` hatası çıkıyor.
//
// ⚠️ Bu dosya pdfjs'ten ÖNCE import edilmek zorunda: pdf.mjs metodu bir sınıf
// alanı başlatıcısında (`#capability = Promise.withResolvers()`) çağırıyor,
// yani modül değerlendirilir değerlendirilmez. ES modüllerinde import'lar
// yazıldıkları sırayla değerlendirildiği için tek gereken, PdfDom.tsx'te bu
// satırın pdfjs satırlarının üstünde durması.
//
// `structuredClone` de kullanılıyor ama o Chrome 98'den beri var ve doğru bir
// polyfill'i (transfer listesi, ImageBitmap) ucuz değil — bilerek shim'lenmiyor.

if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// `ArrayBuffer.prototype.transferToFixedLength` — Chrome 114 / Safari 17.4.
// pdf.js 6'nın worker'ı sayfa çizerken (getOperatorList) kullanıyor ve legacy
// derleme bunu da yamalamıyor. Olmayan WebView'da (emülatörde 113 görüldü)
// her sayfa "buffer.transferToFixedLength is not a function" ile düşüyor,
// pdf.js hatayı yutuyor ve sayfalar boş/siyah kalıyor. Gerçek `transfer`
// kaynağı ayırıyor (detach); yama bunu yapamıyor ama pdf.js eski tamponu
// sonradan kullanmadığı için kopya yeterli.
type TransferableBuffer = ArrayBuffer & { transferToFixedLength?: (length?: number) => ArrayBuffer };
const bufferProto = ArrayBuffer.prototype as TransferableBuffer;
if (typeof bufferProto.transferToFixedLength !== 'function') {
  Object.defineProperty(ArrayBuffer.prototype, 'transferToFixedLength', {
    configurable: true,
    writable: true,
    value: function transferToFixedLength(this: ArrayBuffer, length?: number) {
      const next = new ArrayBuffer(length ?? this.byteLength);
      new Uint8Array(next).set(new Uint8Array(this, 0, Math.min(this.byteLength, next.byteLength)));
      return next;
    },
  });
}

// `import.meta` babel'de `globalThis.__ExpoImportMetaRegistry`'ye çevriliyor
// (bkz. babel.config.js). Expo o nesneyi `expo/src/winter/runtime.ts`'te
// tanımlıyor ama DOM paketine o dosyanın girdiği garanti değil. Tanımsız
// kalırsa pdf.worker.mjs'in JBig2/OpenJPEG yükleyicisi (`var _scriptName =
// import.meta.url`) taranmış belgelerde TypeError fırlatır. Yalnızca `url`
// okunuyor ve o da temel dizini bulmak için — sayfanın kendi adresi yeterli.
const globals = globalThis as unknown as { __ExpoImportMetaRegistry?: { url: string } };
if (!globals.__ExpoImportMetaRegistry) {
  globals.__ExpoImportMetaRegistry = { url: location.href };
}

export {};
