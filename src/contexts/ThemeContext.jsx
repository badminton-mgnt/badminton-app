import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const THEME_STORAGE_KEY = 'badminton-app.theme'
const SUPPORTED_THEMES = ['light', 'dark']
const DEFAULT_THEME = 'light'

const ThemeContext = createContext()

const getStoredTheme = () => {
  const raw = String(localStorage.getItem(THEME_STORAGE_KEY) || '').trim().toLowerCase()
  return SUPPORTED_THEMES.includes(raw) ? raw : DEFAULT_THEME
}

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getStoredTheme)

  const setTheme = (nextTheme) => {
    const normalized = String(nextTheme || '').trim().toLowerCase()
    const resolvedTheme = SUPPORTED_THEMES.includes(normalized) ? normalized : DEFAULT_THEME
    setThemeState(resolvedTheme)
    localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme)
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    const isDark = theme === 'dark'
    document.documentElement.classList.toggle('dark', isDark)
    document.body.classList.toggle('dark', isDark)
  }, [theme])

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme,
    isDarkMode: theme === 'dark',
  }), [theme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return context
}
