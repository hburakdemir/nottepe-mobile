// React Native'in bellek sinyali GC'sini kullanıcı ekrandayken çalıştırmayan
// Android eklentisi. Gerekçenin tamamı TrimMemoryDeferral.kt'nin başında.
//
// Neden eklenti: `android/` klasörü git'te yok (.gitignore), EAS her build'de
// `expo prebuild` ile sıfırdan üretiyor. MainApplication.kt'ye elle yapılan bir
// değişiklik bir sonraki build'de kaybolurdu.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withMainApplication } = require('expo/config-plugins');

const CALL = 'TrimMemoryDeferral.register(this) { reactHost }';

function withDeferredTrimMemory(config) {
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android?.package;
      if (!pkg) throw new Error('withDeferredTrimMemory: app.json içinde android.package yok');
      const template = fs.readFileSync(path.join(__dirname, 'TrimMemoryDeferral.kt'), 'utf8');
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', ...pkg.split('.'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'TrimMemoryDeferral.kt'), template.replace('__PACKAGE__', pkg));
      return cfg;
    },
  ]);

  config = withMainApplication(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error('withDeferredTrimMemory: MainApplication Kotlin bekleniyordu');
    }
    let src = cfg.modResults.contents;
    if (!src.includes(CALL)) {
      // `loadReactNative(this)` satırının hemen ardına, aynı girintiyle.
      src = src.replace(/^([ \t]*)loadReactNative\(this\)[ \t]*$/m, (line, indent) => `${line}\n${indent}${CALL}`);
      if (!src.includes(CALL)) {
        throw new Error('withDeferredTrimMemory: MainApplication.kt içinde loadReactNative(this) bulunamadı');
      }
    }
    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
}

module.exports = withDeferredTrimMemory;
