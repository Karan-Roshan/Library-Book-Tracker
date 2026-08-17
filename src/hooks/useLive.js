// Re-loads a screen when someone else changes the data.

import { useEffect, useRef } from 'react'
import { subscribe } from '../services/live.js'

// Re-reads this screen when one of the named collections changes.
export function useLive(collections, refresh, { settle = 150 } = {}) {
  const latest = useRef(refresh)
  latest.current = refresh

  const names = Array.isArray(collections) ? collections : [collections]
  const key = names.join(',')

  useEffect(() => {
    let timer = null

    const onChange = () => {
      clearTimeout(timer)
      timer = setTimeout(() => latest.current?.(), settle)
    }

    const stop = subscribe(key.split(','), onChange)
    return () => {
      clearTimeout(timer)
      stop()
    }
  }, [key, settle])
}
