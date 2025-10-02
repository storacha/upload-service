const plugin = require('tailwindcss/plugin')

const storachaUI = plugin(
  function ({ addBase, addComponents, addUtilities, theme }) {
    // Add CSS custom properties for theming
    addBase({
      ':root': {
        // Color tokens
        '--storacha-primary': '220 100% 50%',
        '--storacha-primary-foreground': '0 0% 100%',
        '--storacha-secondary': '220 14.3% 95.9%',
        '--storacha-secondary-foreground': '220.9 39.3% 11%',
        '--storacha-muted': '220 14.3% 95.9%',
        '--storacha-muted-foreground': '220 8.9% 46.1%',
        '--storacha-accent': '220 14.3% 95.9%',
        '--storacha-accent-foreground': '220.9 39.3% 11%',
        '--storacha-destructive': '0 84.2% 60.2%',
        '--storacha-destructive-foreground': '210 20% 98%',
        '--storacha-border': '220 13% 91%',
        '--storacha-input': '220 13% 91%',
        '--storacha-ring': '220 100% 50%',
        '--storacha-background': '0 0% 100%',
        '--storacha-foreground': '220.9 39.3% 11%',
        
        // Spacing tokens
        '--storacha-radius': '0.5rem',
      },
      '[data-theme="dark"]': {
        '--storacha-primary': '220 100% 50%',
        '--storacha-primary-foreground': '220.9 39.3% 11%',
        '--storacha-secondary': '220 14.3% 15.9%',
        '--storacha-secondary-foreground': '210 20% 98%',
        '--storacha-muted': '220 14.3% 15.9%',
        '--storacha-muted-foreground': '217.9 10.6% 64.9%',
        '--storacha-accent': '220 14.3% 15.9%',
        '--storacha-accent-foreground': '210 20% 98%',
        '--storacha-destructive': '0 62.8% 30.6%',
        '--storacha-destructive-foreground': '210 20% 98%',
        '--storacha-border': '220 14.3% 15.9%',
        '--storacha-input': '220 14.3% 15.9%',
        '--storacha-ring': '220 100% 50%',
        '--storacha-background': '220.9 39.3% 11%',
        '--storacha-foreground': '210 20% 98%',
      }
    })

    // Add component classes
    addComponents({
      '.storacha-button': {
        '@apply inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-storacha-ring disabled:pointer-events-none disabled:opacity-50': {},
        'background-color': 'hsl(var(--storacha-primary))',
        'color': 'hsl(var(--storacha-primary-foreground))',
        'padding': '0.5rem 1rem',
        '&:hover': {
          'background-color': 'hsl(var(--storacha-primary) / 0.9)',
        }
      },
      '.storacha-input': {
        '@apply flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-storacha-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-storacha-ring disabled:cursor-not-allowed disabled:opacity-50': {},
        'background-color': 'hsl(var(--storacha-background))',
        'border-color': 'hsl(var(--storacha-border))',
        'color': 'hsl(var(--storacha-foreground))',
      }
    })
  },
  {
    theme: {
      extend: {
        colors: {
          'storacha-primary': 'hsl(var(--storacha-primary))',
          'storacha-primary-foreground': 'hsl(var(--storacha-primary-foreground))',
          'storacha-secondary': 'hsl(var(--storacha-secondary))',
          'storacha-secondary-foreground': 'hsl(var(--storacha-secondary-foreground))',
          'storacha-muted': 'hsl(var(--storacha-muted))',
          'storacha-muted-foreground': 'hsl(var(--storacha-muted-foreground))',
          'storacha-accent': 'hsl(var(--storacha-accent))',
          'storacha-accent-foreground': 'hsl(var(--storacha-accent-foreground))',
          'storacha-destructive': 'hsl(var(--storacha-destructive))',
          'storacha-destructive-foreground': 'hsl(var(--storacha-destructive-foreground))',
          'storacha-border': 'hsl(var(--storacha-border))',
          'storacha-input': 'hsl(var(--storacha-input))',
          'storacha-ring': 'hsl(var(--storacha-ring))',
          'storacha-background': 'hsl(var(--storacha-background))',
          'storacha-foreground': 'hsl(var(--storacha-foreground))',
        },
        borderRadius: {
          'storacha': 'var(--storacha-radius)',
        },
        spacing: {
          'storacha-xs': '0.25rem',
          'storacha-sm': '0.5rem',
          'storacha-md': '1rem',
          'storacha-lg': '1.5rem',
          'storacha-xl': '2rem',
        }
      }
    }
  }
)

module.exports = storachaUI