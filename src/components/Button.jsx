// The standard button, in its few tones.

const VARIANTS = {
  primary:
    'bg-ink-900 text-white shadow-sm hover:bg-ink-800 active:bg-ink-950 disabled:bg-ink-300',
  brass:
    'bg-brass-600 text-white shadow-sm hover:bg-brass-500 active:bg-brass-700 disabled:bg-brass-200',
  outline:
    'border border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50 disabled:text-ink-300',
}

export default function Button({
  variant = 'primary',
  loading = false,
  children,
  className = '',
  ...props
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
        'text-[0.95rem] font-semibold tracking-tight',
        'transition-colors duration-150 disabled:cursor-not-allowed',
        VARIANTS[variant],
        className,
      ].join(' ')}
    >
      {loading && (
        <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )}
      {children}
    </button>
  )
}
