// Closes a menu when you click outside it or press Escape.

import { useEffect, useRef } from 'react'

// Closes a menu on an outside click or Escape.
export function useDismiss(isOpen, onDismiss, alsoInside = null) {
  const ref = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    const handlePointer = (event) => {
      const inTrigger = ref.current?.contains(event.target)
      const inPanel = alsoInside?.current?.contains(event.target)
      if (!inTrigger && !inPanel) onDismiss()
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onDismiss, alsoInside])

  return ref
}
