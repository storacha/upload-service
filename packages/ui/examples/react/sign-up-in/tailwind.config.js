/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../components/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'hot-red': '#E91315',
        'hot-red-light': '#EFE3F3',
        'hot-yellow': '#FFC83F',
        'hot-yellow-light': '#FFE4AE',
        'hot-blue': '#0176CE',
        'hot-blue-light': '#BDE0FF'
      },
      fontFamily: {
        'epilogue': ['Epilogue', 'sans-serif'],
      },
      animation: {
        'spin': 'spin 1s linear infinite',
        'bgPosDrift': 'bgPosDrift 60s ease infinite',
      },
      keyframes: {
        bgPosDrift: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        }
      }
    },
  },
  plugins: [],
}
