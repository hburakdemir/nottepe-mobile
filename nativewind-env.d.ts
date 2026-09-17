/// <reference types="nativewind/types" />

// TypeScript 6 yan etkili import'larda (App.tsx'teki `import './global.css'`)
// modülün tanımlı olmasını şart koşuyor; nativewind kendi tip paketinde `.css`
// için bir tanım vermiyor. Stil dosyasının JS tarafında dışa verdiği bir şey
// yok, tanım da o yüzden boş.
declare module '*.css' {}
