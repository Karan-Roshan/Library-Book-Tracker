// The three-dot menu of actions at the end of a table row.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDismiss } from '../../hooks/useDismiss.js'

const MIN_WIDTH = 176
const ITEM_HEIGHT = 42

export default function RowMenu({ label, items }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, right: 0 })
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close, menuRef)

  const sorted = [...items].sort((a, b) => a.label.localeCompare(b.label))

  useEffect(() => {
    if (!open) return undefined
    const ownRow = buttonRef.current?.closest('tr')
    if (!ownRow) return undefined

    const handleHover = (event) => {
      const panel = menuRef.current?.getBoundingClientRect()
      if (
        panel &&
        event.clientX >= panel.left - 8 &&
        event.clientX <= panel.right + 8 &&
        event.clientY >= panel.top - 8 &&
        event.clientY <= panel.bottom + 8
      ) {
        return
      }

      const row = event.target instanceof Element ? event.target.closest('tr') : null
      if (row && row !== ownRow) close()
    }

    document.addEventListener('mousemove', handleHover)
    return () => document.removeEventListener('mousemove', handleHover)
  }, [open, close])

  // Nothing to offer on this row: no button, rather than one that opens on an
  // empty panel.
  if (sorted.length === 0) return null

  const toggle = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      const height = sorted.length * ITEM_HEIGHT + 12
      const roomBelow = window.innerHeight - rect.bottom

      const viewport = document.documentElement.clientWidth
      setPosition({
        top: roomBelow < height ? rect.top - height : rect.bottom + 6,
        right: Math.max(12, viewport - rect.right),
      })
    }
    setOpen((state) => !state)
  }

  return (
    <div ref={ref} className="absolute inset-0 flex items-center justify-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className={`rounded-lg bg-ink-900 p-1.5 text-white shadow-md transition-opacity hover:bg-ink-800 dark:bg-ink-700 dark:hover:bg-ink-600 ${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
        }`}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <circle cx="10" cy="4" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="10" cy="16" r="1.6" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            top: position.top,
            right: position.right,
            minWidth: MIN_WIDTH,

            maxWidth: 'calc(100vw - 24px)',
          }}
          className="fixed z-[60] overflow-hidden rounded-xl border border-ink-100 bg-white py-1 shadow-xl dark:border-ink-700 dark:bg-ink-800"
        >
          {sorted.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                close()
                item.onSelect()
              }}
              className={`block w-full whitespace-nowrap px-4 py-2.5 text-left text-sm transition-colors ${
                item.tone === 'danger'
                  ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10'
                  : 'text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

export const ACTION_CELL = 'sticky right-0 z-20 w-14 min-w-14 p-0'
export const ACTION_HEAD = 'sticky right-0 z-20 w-14 min-w-14 bg-ink-900 p-0 dark:bg-ink-950'
