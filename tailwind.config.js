/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // TEMAYA GÖRE DEĞİŞEN renkler — hepsi CSS değişkeni (bkz. theme/palette.ts).
        // `dark:` varyantı artık HİÇBİR YERDE kullanılmıyor: değişkenleri kökteki
        // tek bir View'a ThemeProvider basıyor, tema değişimi saf JS oluyor.
        ground: 'var(--ground)',
        surface: 'var(--surface)',
        inset: 'var(--inset)',
        ink: 'var(--ink)',
        ink2: 'var(--ink2)',
        muted: 'var(--muted)',
        muted2: 'var(--muted2)',
        line: 'var(--line)',
        'line-soft': 'var(--line-soft)',
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          line: 'var(--accent-line)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-soft)',
          line: 'var(--danger-line)',
        },
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
          line: 'var(--success-line)',
        },
        info: 'var(--info)',
        warn: {
          DEFAULT: 'var(--warn)',
          soft: 'var(--warn-soft)',
          ink: 'var(--warn-ink)',
        },
        'on-badge': 'var(--on-badge)',
        'avatar-ring': 'var(--avatar-ring)',
        fail: { DEFAULT: 'var(--fail)', soft: 'var(--fail-soft)' },

        // TEMADAN BAĞIMSIZ sabitler — her iki temada aynı kalan renkler.
        // `bg-brand` dolgulu birincil butonların (üstünde her zaman beyaz yazı)
        // rengi; tema ile açılıp koyulaşan her şey yukarıdaki token'lardan
        // geliyor. Eski `darktext`/`darkbgbutton`/`darkbg`/`appground`/
        // `primary`/`secondary` girdileri kaldırıldı: hepsi `dark:` çiftlerinin
        // yarısıydı, artık tek bir kullanan bile yok (bkz. theme/palette.ts).
        brand: { DEFAULT: '#2F5755', light: '#5A9690' },
        beige: '#E0D9D9',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(40px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'gradient-x': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '-200% 50%' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
        'gradient-x': 'gradient-x 3s linear infinite',
      },
    },
  },
  plugins: [],
};
