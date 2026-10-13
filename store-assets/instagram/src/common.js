// Beş tasarımın ortak işleri. Sayfanın en sonunda yüklenir.
//   ?f=post  → 1080×1350 (4:5)      ?f=story → 1080×1920 (9:16)
// Yer tutucular:
//   <div data-iphone="iphone_ana_sayfa.png"></div>   → iPhone çerçevesi
//   <div data-ipad="ipad_yemek.jpg"></div>            → iPad çerçevesi (yatay)
//   <div data-badges></div>                           → App Store + Google Play düğmeleri
// Her tasarım konum/boyutu kendi CSS'inde verir; hikâye için [data-f="story"] seçicisi.

document.documentElement.dataset.f = new URLSearchParams(location.search).get('f') || 'post';

// iPhone durum çubuğu — 1170 px genişlikli ekran görüntüsünün koordinatlarında;
// orijinaldeki 20:37 / LTE / %69'un üstüne 9:41 + tam pil çizer.
document.body.insertAdjacentHTML('afterbegin', `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="sb-iphone" viewBox="0 0 1170 139">
    <rect width="1170" height="139" fill="#fff"/>
    <text x="190" y="99" text-anchor="middle" font-family="Inter Display" font-size="52" font-weight="600" fill="#000">9:41</text>
    <g fill="#000">
      <rect x="852" y="80" width="13" height="14" rx="3"/>
      <rect x="870" y="73" width="13" height="21" rx="3"/>
      <rect x="888" y="66" width="13" height="28" rx="3"/>
      <rect x="906" y="59" width="13" height="35" rx="3"/>
    </g>
    <g fill="none" stroke="#000" stroke-width="7.5" stroke-linecap="round">
      <path d="M940.4 69.7 A30 30 0 0 1 982.6 69.7"/>
      <path d="M949.6 78.9 A17 17 0 0 1 973.4 78.9"/>
    </g>
    <circle cx="961.5" cy="89" r="5.8" fill="#000"/>
    <rect x="1002" y="61" width="70" height="34" rx="10" fill="none" stroke="#000" stroke-opacity=".38" stroke-width="3"/>
    <rect x="1007" y="66" width="60" height="24" rx="6" fill="#000"/>
    <rect x="1075" y="71" width="5" height="14" rx="2.5" fill="#000" fill-opacity=".4"/>
  </symbol>
</svg>`);

for (const el of document.querySelectorAll('[data-iphone]')) {
  el.classList.add('dev', 'iphone');
  el.innerHTML = `
    <i class="btn l" style="top:17%;height:5%"></i>
    <i class="btn l" style="top:25%;height:9%"></i>
    <i class="btn l" style="top:36%;height:9%"></i>
    <i class="btn r" style="top:28%;height:13%"></i>
    <div class="screen">
      <img src="${el.dataset.iphone}" alt="">
      <svg class="sb" viewBox="0 0 1170 139"><use href="#sb-iphone"/></svg>
    </div>
    <div class="island"></div>`;
}

for (const el of document.querySelectorAll('[data-ipad]')) {
  el.classList.add('dev', 'ipad');
  // iPad durum çubuğu: 1600 px genişlikli ekran görüntüsü koordinatlarında (orijinal %33 pil yerine).
  el.innerHTML = `
    <div class="screen">
      <img src="${el.dataset.ipad}" alt="">
      <svg class="sb" viewBox="0 0 1600 36" aria-hidden="true">
        <rect width="1600" height="36" fill="#fefefe"/>
        <text x="22" y="23" font-family="Inter Display" font-size="17" fill="#000"><tspan font-weight="600">9:41</tspan><tspan dx="12" font-weight="500">13 Eyl Paz</tspan></text>
        <g fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round">
          <path d="M1482.6 15.1 A12 12 0 0 1 1499.4 15.1"/>
          <path d="M1486.1 18.6 A7 7 0 0 1 1495.9 18.6"/>
        </g>
        <circle cx="1491" cy="22.2" r="2.2" fill="#000"/>
        <text x="1544" y="23" text-anchor="end" font-family="Inter Display" font-size="15" font-weight="600" fill="#000">%100</text>
        <rect x="1550" y="10" width="30" height="14" rx="4" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="1.6"/>
        <rect x="1552.5" y="12.5" width="25" height="9" rx="2.2" fill="#000"/>
        <rect x="1581.5" y="14.5" width="2" height="5" rx="1" fill="#000" fill-opacity=".4"/>
      </svg>
    </div>
    <i class="cam"></i>`;
}

const APPLE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="apple" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>`;
const PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <path fill="#4285F4" d="M1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924z"/>
  <path fill="#34A853" d="M13.544 10.989l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973z"/>
  <path fill="#EA4335" d="M13.544 13.056l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z"/>
  <path fill="#FBBC04" d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594z"/></svg>`;

for (const el of document.querySelectorAll('[data-badges]')) {
  el.classList.add('badges');
  const top = el.dataset.badges || 'Hemen indir';
  el.innerHTML = `
    <div class="badge">${APPLE}<div><small>${top}</small><b>App Store</b></div></div>
    <div class="badge">${PLAY}<div><small>${top}</small><b>Google Play</b></div></div>`;
}
