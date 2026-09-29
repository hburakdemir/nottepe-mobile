package __PACKAGE__

import android.app.Activity
import android.app.Application
import android.content.ComponentCallbacks2
import android.content.res.Configuration
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.facebook.react.MemoryPressureRouter
import com.facebook.react.ReactHost

// BU DOSYA ÜRETİLİYOR — elle düzenleme. Kaynağı:
// plugins/withDeferredTrimMemory/TrimMemoryDeferral.kt (bkz. oradaki index.js).
//
// React Native, Android'in onTrimMemory sinyallerinde (BACKGROUND / MODERATE /
// COMPLETE / RUNNING_CRITICAL) JS motoruna TAM GC yaptırıyor
// (ReactInstance::handleMemoryPressureJs → collectGarbage). Tam GC boyunca JS
// thread'i başka hiçbir iş yapamıyor.
//
// Sorun zamanlaması: uygulama arka planda dondurulduğunda (cached apps freezer)
// bu sinyaller birikiyor ve süreç çözülünce — yani kullanıcı uygulamaya
// döndüğü anda — arka arkaya çalışıyor. Sonuç testçilerin tarif ettiği tablo:
// liste kayıyor (native), basışlar birkaç saniye hiçbir şey yapmıyor (JS).
//
// Burada RN'in yönlendiricisi sistem kaydından çıkarılıyor ve sinyaller araya
// girilerek iletiliyor:
//   · Uygulama arka plandaysa → kısa bir gecikmeyle RN'e iletiliyor, GC
//     kullanıcı ekranda değilken çalışıyor. Bellek koruması aynen sürüyor.
//   · Uygulama ön plandaysa (dönüşte teslim edilen birikmiş sinyaller dahil) →
//     seviye saklanıyor, bir sonraki arka plana geçişte iletiliyor.
// GC iptal edilmiyor, yalnızca kullanıcı ekrandayken çalışmıyor.
object TrimMemoryDeferral {
  // Donmuş süreç çözüldüğünde birikmiş sinyaller etkinliğin onStart'ından ÖNCE
  // teslim edilebiliyor; o an uygulama hâlâ "arka planda" görünüyor. Karar bu
  // kadar geciktirilince dönüş netleşmiş oluyor (onStart çoktan çalışmış).
  // Canlı bir arka plan sinyali için bedeli yok: dondurucu uygulamayı arka
  // plana geçişten ~10 sn sonra donduruyor.
  private const val ROUTE_DELAY_MS = 1500L

  private val mainHandler = Handler(Looper.getMainLooper())
  private var router: MemoryPressureRouter? = null
  private var startedActivities = 0
  private var pendingLevel = 0

  fun register(app: Application, reactHostProvider: () -> ReactHost) {
    app.registerActivityLifecycleCallbacks(
        object : Application.ActivityLifecycleCallbacks {
          override fun onActivityStarted(activity: Activity) {
            startedActivities += 1
            if (router == null) {
              // İlk etkinlik başladığında ReactHost kesin kurulmuş oluyor
              // (ReactActivityDelegate onCreate'te kuruyor, Expo tek örnek
              // tutuyor). Yönlendiriciyi o an devralıyoruz; o ana kadar gelen
              // sinyalleri RN zaten doğrudan aldı.
              val r = reactHostProvider().memoryPressureRouter
              r.destroy(app)
              router = r
            }
          }

          override fun onActivityStopped(activity: Activity) {
            startedActivities = maxOf(0, startedActivities - 1)
            if (startedActivities == 0) flushPending()
          }

          override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit

          override fun onActivityResumed(activity: Activity) = Unit

          override fun onActivityPaused(activity: Activity) = Unit

          override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit

          override fun onActivityDestroyed(activity: Activity) = Unit
        })

    app.registerComponentCallbacks(
        object : ComponentCallbacks2 {
          override fun onTrimMemory(level: Int) {
            mainHandler.postDelayed({ route(level) }, ROUTE_DELAY_MS)
          }

          override fun onConfigurationChanged(newConfig: Configuration) = Unit

          @Deprecated("Deprecated in Java")
          override fun onLowMemory() = Unit
        })
  }

  private fun route(level: Int) {
    val r = router ?: return
    if (startedActivities == 0) {
      r.onTrimMemory(level)
    } else if (level > pendingLevel) {
      pendingLevel = level
    }
  }

  private fun flushPending() {
    val r = router ?: return
    if (pendingLevel == 0) return
    val level = pendingLevel
    pendingLevel = 0
    r.onTrimMemory(level)
  }
}
