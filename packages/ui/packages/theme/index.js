// Theme utilities for Storacha UI
export const themes = {
  light: {
    primary: 'hsl(220, 100%, 50%)',
    primaryForeground: 'hsl(0, 0%, 100%)',
    secondary: 'hsl(220, 14.3%, 95.9%)',
    secondaryForeground: 'hsl(220.9, 39.3%, 11%)',
    muted: 'hsl(220, 14.3%, 95.9%)',
    mutedForeground: 'hsl(220, 8.9%, 46.1%)',
    accent: 'hsl(220, 14.3%, 95.9%)',
    accentForeground: 'hsl(220.9, 39.3%, 11%)',
    destructive: 'hsl(0, 84.2%, 60.2%)',
    destructiveForeground: 'hsl(210, 20%, 98%)',
    border: 'hsl(220, 13%, 91%)',
    input: 'hsl(220, 13%, 91%)',
    ring: 'hsl(220, 100%, 50%)',
    background: 'hsl(0, 0%, 100%)',
    foreground: 'hsl(220.9, 39.3%, 11%)',
  },
  dark: {
    primary: 'hsl(220, 100%, 50%)',
    primaryForeground: 'hsl(220.9, 39.3%, 11%)',
    secondary: 'hsl(220, 14.3%, 15.9%)',
    secondaryForeground: 'hsl(210, 20%, 98%)',
    muted: 'hsl(220, 14.3%, 15.9%)',
    mutedForeground: 'hsl(217.9, 10.6%, 64.9%)',
    accent: 'hsl(220, 14.3%, 15.9%)',
    accentForeground: 'hsl(210, 20%, 98%)',
    destructive: 'hsl(0, 62.8%, 30.6%)',
    destructiveForeground: 'hsl(210, 20%, 98%)',
    border: 'hsl(220, 14.3%, 15.9%)',
    input: 'hsl(220, 14.3%, 15.9%)',
    ring: 'hsl(220, 100%, 50%)',
    background: 'hsl(220.9, 39.3%, 11%)',
    foreground: 'hsl(210, 20%, 98%)',
  }
}

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
}

export const radius = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
}

// Theme provider utility
export function applyTheme(theme = 'light') {
  const root = document.documentElement
  const themeColors = themes[theme]
  
  if (!themeColors) {
    console.warn(`Theme "${theme}" not found. Available themes:`, Object.keys(themes))
    return
  }
  
  // Set data attribute for CSS targeting
  root.setAttribute('data-theme', theme)
  
  // Apply CSS custom properties
  Object.entries(themeColors).forEach(([key, value]) => {
    const cssVar = `--storacha-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
    root.style.setProperty(cssVar, value.replace('hsl(', '').replace(')', ''))
  })
}

// Theme detection utility
export function getSystemTheme() {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Auto theme utility
export function useAutoTheme() {
  if (typeof window === 'undefined') return
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  
  function updateTheme() {
    applyTheme(mediaQuery.matches ? 'dark' : 'light')
  }
  
  // Apply initial theme
  updateTheme()
  
  // Listen for changes
  mediaQuery.addEventListener('change', updateTheme)
  
  // Return cleanup function
  return () => mediaQuery.removeEventListener('change', updateTheme)
}