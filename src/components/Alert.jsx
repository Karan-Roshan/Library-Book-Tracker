// A message that stays on screen until it is dealt with.

const TONES = {
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-brass-200 bg-brass-50 text-brass-900',
}

export default function Alert({ tone = 'error', children, onDismiss }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`animate-fade relative flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${TONES[tone]}`}
    >
      <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 112 0 1 1 0 01-2 0zm.25-7.25a.75.75 0 011.5 0v4.5a.75.75 0 01-1.5 0v-4.5z"
          clipRule="evenodd"
        />
      </svg>

      <span className={`min-w-0 flex-1 ${onDismiss ? 'pr-6' : ''}`}>{children}</span>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 rounded-lg p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
