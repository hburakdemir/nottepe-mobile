module.exports = function (api) {
  // DOM bileşenleri (PdfDom.tsx, "use dom") AYRI bir web paketi olarak
  // derleniyor ve nativewind oraya girmemeli.
  //
  // Sebebi: `jsxImportSource: 'nativewind'` projedeki HER dosyaya uygulanıyor,
  // node_modules dahil. Web paketinde bu, Expo'nun kendi dom-entry'sini bile
  // `react-native-css-interop/jsx-runtime` üzerinden derliyor; o runtime da
  // `react-native-web`'e uzanıyor ve paket çöküyor.
  //
  // DOM bileşenleri zaten düz web React'i (div/canvas) yazıyor; nativewind'in
  // React Native odaklı JSX'iyle işleri yok.
  //
  // AYIRT EDİCİ OLARAK `platform` KULLANILIYOR, `isDomComponent` DEĞİL.
  // `isDomComponent` bayrağını `@expo/metro-config` yalnızca SDK 57'den
  // itibaren üretiyor; bu proje SDK 54'te ve orada o alan hiç yok, yani koşul
  // sessizce hep `false` dönerdi. SDK 54'te DOM paketi `platform: 'web'`
  // olarak isteniyor — kaynak:
  //   expo/node_modules/@expo/cli/build/src/export/exportDomComponents.js:84,119
  // ve `platform` babel caller'ına giriyor:
  //   expo/node_modules/@expo/metro-config/build/babel-transformer.js
  //     → getBabelCaller() → `platform: options.platform`
  //
  // Yan etkisi: `expo start --web` de nativewind'siz derlenir. Bu proje
  // native-only (react-native-web yalnızca DOM paketinin bağımlılık zinciri
  // için var), o yüzden bedelsiz.
  //
  // ⚠️ `api.cache(true)` BİLEREK KALDIRILDI: o, yapılandırmayı çağırandan
  // bağımsız olarak kalıcı önbelleğe alır ve aşağıdaki dallanma ilk derlemede
  // hangi tarafa düştüyse orada donardı. `api.caller` Babel'de önbellek
  // anahtarına kendiliğinden giriyor, yani native ve web için ayrı ayrı
  // önbelleklenip doğru dal seçiliyor.
  const isWebBundle = api.caller((caller) => caller?.platform === 'web');

  if (isWebBundle) {
    return { presets: ['babel-preset-expo'] };
  }

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-worklets/plugin'],
  };
};
