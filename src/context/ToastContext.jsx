// Short-lived confirmations: they pop up, say what happened, and leave on their own.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ToastContext = createContext(null)

// How long a message stays on screen before it fades itself out.
const LIFETIME = 5000

// At most this many stack up; older ones are pushed off the bottom.
const STACK = 3

const TONES = {
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  error:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
  info: 'border-brass-200 bg-brass-50 text-brass-900 dark:border-brass-500/40 dark:bg-brass-500/10 dark:text-brass-200',
}

let counter = 0

// Holds the pop-up messages for every signed-in screen.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback(
    (id) => setToasts((list) => list.filter((item) => item.id !== id)),
    [],
  )

  const toast = useCallback((message, tone = 'success') => {
    if (!message) return null
    counter += 1
    const id = counter
    setToasts((list) => [...list, { id, message, tone }].slice(-STACK))
    return id
  }, [])

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        className="no-print pointer-events-none fixed bottom-6 left-4 z-40 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:left-6 sm:w-auto lg:left-[17.5rem]"
      >
        {toasts.map((item) => (
          <Toast key={item.id} {...item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// One message, which clears itself once its five seconds are up.
function Toast({ message, tone, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, LIFETIME)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      role="status"
      className={`animate-rise pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg sm:w-96 ${TONES[tone] ?? TONES.info}`}
    >
      <span className="min-w-0 flex-1">{message}</span>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-0.5 rounded-lg p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
          <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

// Raises a pop-up message from anywhere inside the shell.
export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside a ToastProvider')
  return value
}
