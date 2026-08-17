// The library's own settings, loaded once and shared with every screen.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as settingsService from '../services/settings.js'
import { DEFAULT_SETTINGS, circulationRules, withDefaults } from '../lib/settings.js'
import { setPermissionOverrides } from '../lib/permissions.js'
import { setRuleSource } from '../services/circulation.js'

const SettingsContext = createContext(null)

// Loads the library's settings and pushes permission changes into the guard.
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => withDefaults(null))
  const [loading, setLoading] = useState(true)

  const apply = useCallback((next) => {
    setSettings(next)

    setPermissionOverrides(next.security.grants)
    setRuleSource(() => circulationRules(next))
  }, [])

  useEffect(() => {
    let active = true
    settingsService
      .getSettings()
      .then((loaded) => {
        if (active) apply(loaded)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [apply])

  const save = useCallback(
    async (section, values, options) => {
      const { settings: next, changes } = await settingsService.saveSection(section, values, options)
      apply(next)
      return changes
    },
    [apply],
  )

  const reset = useCallback(
    async (section, options) => {
      const { settings: next, changes } = await settingsService.resetSection(section, options)
      apply(next)
      return changes
    },
    [apply],
  )

  const reload = useCallback(
    () => settingsService.getSettings().then(apply),
    [apply],
  )

  const value = useMemo(
    () => ({ settings, loading, save, reset, reload, rules: circulationRules(settings) }),
    [settings, loading, save, reset, reload],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

// The library's settings, from anywhere.
export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used inside a <SettingsProvider>.')
  return context
}

export { DEFAULT_SETTINGS }
