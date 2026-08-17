// One figure with its label, as used across the top of every page.

const TONES = {
  neutral: 'bg-ink-50 dark:bg-ink-800',
  brass: 'bg-brass-50 dark:bg-brass-500/10',
  alert: 'bg-red-50 dark:bg-red-500/10',
  good: 'bg-emerald-50 dark:bg-emerald-500/10',
}

export default function StatCard({
  emoji,
  label,
  value,
  hint,
  tone = 'neutral',
  align = 'left',

  className = '',
}) {
  const centred = align === 'center'

  return (
    <div
      className={`rounded-xl border border-ink-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-ink-800 dark:bg-ink-900 ${
        centred ? 'text-center' : ''
      } ${className}`}
    >
      <div className={`flex items-start gap-3 ${centred ? 'justify-center' : 'justify-between'}`}>
        <p className="text-sm font-bold leading-snug text-ink-600 dark:text-ink-300">{label}</p>

        {emoji && (
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base ${TONES[tone]}`}
          >
            {emoji}
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-semibold leading-none text-ink-900 dark:text-white">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-ink-400">{hint}</p>}
    </div>
  )
}
