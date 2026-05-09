import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, translate } from '../lib/i18n'

const LANGUAGE_STORAGE_KEY = 'badminton-app.language'
const LanguageContext = createContext()

const getStoredLanguage = () => {
  const raw = String(localStorage.getItem(LANGUAGE_STORAGE_KEY) || '').trim().toLowerCase()
  return SUPPORTED_LANGUAGES.includes(raw) ? raw : DEFAULT_LANGUAGE
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(getStoredLanguage)

  const setLanguage = (nextLanguage) => {
    const normalized = String(nextLanguage || '').trim().toLowerCase()
    const resolvedLanguage = SUPPORTED_LANGUAGES.includes(normalized)
      ? normalized
      : DEFAULT_LANGUAGE

    setLanguageState(resolvedLanguage)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, resolvedLanguage)
  }

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key, params) => translate(language, key, params),
  }), [language])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }

  return context
}
