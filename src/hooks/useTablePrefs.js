// Remembers how many rows a table shows, and asks before destructive actions.

import { useCallback, useEffect, useState } from 'react'
import { useSettings } from '../context/SettingsContext.jsx'

// How many rows a table shows, seeded from Settings.
export function usePageSize(sizes = [10, 25, 50, 100]) {
  const { settings } = useSettings()
  const preferred = settings.system.pageSize

  const nearest = useCallback(
    (value) =>
      sizes.includes(value)
        ? value
        : sizes.reduce((best, size) =>
            Math.abs(size - value) < Math.abs(best - value) ? size : best,
          ),
    [sizes],
  )

  const [pageSize, setPageSize] = useState(() => nearest(preferred))
  useEffect(() => setPageSize(nearest(preferred)), [preferred, nearest])

  return [pageSize, setPageSize]
}

// Asks before something destructive, if the administrator wants asking.
export function useConfirm() {
  const { settings } = useSettings()
  const ask = settings.system.confirmDestructive

  return useCallback(
    (message, run) => {
      if (ask && !window.confirm(message)) return false
      run()
      return true
    },
    [ask],
  )
}
