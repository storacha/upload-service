// Example: Theme system usage
import React, { useEffect, useState } from 'react'
import { applyTheme, useAutoTheme, getSystemTheme } from '@storacha/ui/theme'

export function ThemeExample() {
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light')

  // Auto-apply system theme on mount
  useEffect(() => {
    const cleanup = useAutoTheme()
    setCurrentTheme(getSystemTheme())
    return cleanup
  }, [])

  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light'
    setCurrentTheme(newTheme)
    applyTheme(newTheme)
  }

  return (
    <div className="p-storacha-lg bg-storacha-background text-storacha-foreground">
      <h2 className="text-xl font-bold mb-storacha-md">Theme System Example</h2>
      
      <div className="space-y-storacha-sm">
        <p>Current theme: <span className="font-mono">{currentTheme}</span></p>
        
        <button 
          onClick={toggleTheme}
          className="storacha-button"
        >
          Toggle to {currentTheme === 'light' ? 'Dark' : 'Light'} Mode
        </button>
        
        <div className="grid grid-cols-2 gap-storacha-sm mt-storacha-md">
          <div className="p-storacha-sm bg-storacha-secondary rounded-storacha">
            <h3 className="text-storacha-secondary-foreground font-semibold">Secondary</h3>
            <p className="text-storacha-muted-foreground text-sm">Muted text</p>
          </div>
          
          <div className="p-storacha-sm bg-storacha-accent rounded-storacha">
            <h3 className="text-storacha-accent-foreground font-semibold">Accent</h3>
            <input 
              className="storacha-input mt-2" 
              placeholder="Themed input"
            />
          </div>
        </div>
      </div>
    </div>
  )
}