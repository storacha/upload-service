/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'gray-dark': '#1d2027',
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
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
