// Re-loads data when you come back to the tab, so it is never stale.

import { useEffect } from 'react'

// Re-reads when the reader comes back to the tab.
export function useRefreshOnFocus(refresh) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])
}
