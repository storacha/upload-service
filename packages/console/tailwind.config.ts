import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'logo': 'url("/w3.svg")'
      },
      colors: {
        'gray-dark': '#1d2027',
        'hot-red': '#E91315',
        'hot-red-light': '#EFE3F3',
        'hot-yellow': '#FFC83F',
        'hot-yellow-light': '#FFE4AE',
        'hot-blue': '#0176CE',
        'hot-blue-light': '#BDE0FF'
      },
      backdropBlur: {
        tooltip: '60px',
      }  
    }
  },
  plugins: [],
}
export default config
