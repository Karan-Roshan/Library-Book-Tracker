// Theme and language, stored against the account so they follow the person.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { storage } from '../services/storage.js'
import { useAuth } from './AuthContext.jsx'
import { useSettings } from './SettingsContext.jsx'

// The languages offered — this affects date and number formatting only.
export const LOCALES = [
  { value: 'en-IN', label: 'English (India)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'hi-IN', label: 'हिन्दी (India)' },
]

const PreferencesContext = createContext(null)

const systemPrefersDark = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

// Holds theme and locale, stored against the account.
export function PreferencesProvider({ children }) {
  const { settings } = useSettings()
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [theme, setTheme] = useState(() => (systemPrefersDark() ? 'dark' : 'light'))
  const [locale, setLocale] = useState('en-IN')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (touched) return
    if (settings.system.locale) setLocale(settings.system.locale)
  }, [settings.system.locale, touched])

  useEffect(() => {
    if (!userId) return
    let active = true

    storage
      .getValue('preferences')
      .then((all) => {
        if (!active) return
        const mine = all?.[userId]
        if (mine?.theme) setTheme(mine.theme)
        if (mine?.locale) {
          setLocale(mine.locale)
          setTouched(true)
        }
      })

      .catch(() => {})

    return () => {
      active = false
    }
  }, [userId])

  const save = useCallback(
    async (patch) => {
      if (!userId) return
      try {
        const all = (await storage.getValue('preferences')) ?? {}
        await storage.setValue('preferences', {
          ...all,
          [userId]: { ...(all[userId] ?? {}), ...patch },
        })
      } catch {
      }
    },
    [userId],
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      locale,

      system: settings.system,
      toggleTheme: () => {
        setTouched(true)
        setTheme((current) => {
          const next = current === 'dark' ? 'light' : 'dark'
          save({ theme: next })
          return next
        })
      },
      changeLocale: (next) => {
        setTouched(true)
        setLocale(next)
        save({ locale: next })
      },
    }),
    [theme, locale, settings.system, save],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

// Theme, locale and the system settings, from anywhere.
export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences must be used inside a <PreferencesProvider>.')
  return context
}
