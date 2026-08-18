// The panel every dashboard section sits in.

// Optional panel tints. Without a tone the panel stays the usual white.
const SURFACES = {
  brass: 'bg-brass-50 dark:bg-brass-500/10',
}

export default function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClass = '',
  tone,

  padded = true,
}) {
  const surface = SURFACES[tone] ?? 'bg-white dark:bg-ink-900'

  return (
    <section
      className={`flex flex-col rounded-xl border border-ink-100 shadow-sm dark:border-ink-800 ${surface} ${className}`}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-ink-50 px-5 py-4 dark:border-ink-800">
          <div className="min-w-0">
            <h2 className="font-display text-base leading-tight text-ink-900 dark:text-white">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={`flex-1 ${padded ? 'px-5 py-4' : ''} ${bodyClass}`}>{children}</div>
    </section>
  )
}

export function ViewToggle({ view, onChange }) {
  return (
    <div
      role="group"
      aria-label="Chart view"
      className="flex shrink-0 rounded-lg border border-ink-100 p-0.5 dark:border-ink-700"
    >
      {['chart', 'table'].map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={view === option}
          className={`rounded-[0.4rem] px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
            view === option
              ? 'bg-ink-900 text-white dark:bg-brass-600'
              : 'text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
