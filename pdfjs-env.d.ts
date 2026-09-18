// pdfjs-dist 6 worker'ı yalnızca .mjs olarak dağıtılıyor ve yanında tip dosyası
// gelmiyor (pdf.mjs'in aksine). Onu import etmemizin tek sebebi yan etkisi
// değil, `WorkerMessageHandler`'ı globalThis.pdfjsWorker'a koyup pdf.js'i ana
// iş parçacığında çalışmaya zorlamak — gerekçesi PdfDom.tsx'te.
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  const WorkerMessageHandler: unknown;
  export { WorkerMessageHandler };
}
