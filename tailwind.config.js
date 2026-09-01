/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#2F5755', light: '#5A9690' },
        beige: '#E0D9D9',
        primary: '#FFFFFF',
        secondary: '#000000',
        darktext: '#DFD0B8',
        darkbgbutton: '#222831',
        darkhover: '#A78295',
        darkbg: '#393E46',
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
