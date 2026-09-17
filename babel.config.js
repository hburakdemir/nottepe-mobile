module.exports = function (api) {
  // DOM bileşenleri (PdfDom.tsx, "use dom") AYRI bir web paketi olarak
  // derleniyor ve nativewind oraya girmemeli.
  //
  // Sebebi: `jsxImportSource: 'nativewind'` projedeki HER dosyaya uygulanıyor,
  // node_modules dahil. Web paketinde bu, Expo'nun kendi dom-entry'sini bile
  // `react-native-css-interop/jsx-runtime` üzerinden derliyor; o runtime da
  // `react-native-web`'e uzanıyor. Bu proje native-only, react-native-web
  // kurulu değil ve kurmanın tek faydası hatayı susturmak olurdu — karşılığında
  // WebView paketine sırf JSX için koca bir kütüphane girerdi.
  //
  // DOM bileşenleri zaten düz web React'i (div/canvas) yazıyor; nativewind'in
  // React Native odaklı JSX'iyle işleri yok.
  //
  // ⚠️ `api.cache(true)` BİLEREK kullanılmıyor: o, yapılandırmayı çağırandan
  // bağımsız olarak kalıcı önbelleğe alır ve aşağıdaki dallanma ilk derlemede
  // hangi tarafa düştüyse orada donardı. `api.caller` Babel'de önbellek
  // anahtarına kendiliğinden giriyor, yani native ve DOM için ayrı ayrı
  // önbelleklenip doğru dal seçiliyor.
  const isDomComponent = api.caller((caller) => Boolean(caller?.isDomComponent));

  if (isDomComponent) {
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
