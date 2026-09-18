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

export {};
