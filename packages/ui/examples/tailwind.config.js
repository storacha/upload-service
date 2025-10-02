// Example Tailwind configuration using Storacha UI plugin
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Additional customizations can be added here
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    // Storacha UI plugin provides design tokens and components
    require('@storacha/ui-tailwind'),
    
    // Optional: Add other plugins
    // require('@tailwindcss/forms'),
    // require('@tailwindcss/typography'),
  ],
}