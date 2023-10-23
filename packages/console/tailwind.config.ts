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
        'gray-dark': '#1d2027'
      }
    }
  },
  plugins: [],
}
export default config
