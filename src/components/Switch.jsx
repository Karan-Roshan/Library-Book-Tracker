// The on/off switch used everywhere a setting is a yes or no.

export default function Switch({ checked, onChange, label, disabled = false, id }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'group relative inline-flex h-7 w-[3.25rem] shrink-0 items-center rounded-full',
        'transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brass-500/25',
        'disabled:cursor-not-allowed disabled:opacity-40',
        checked
          ? 'bg-brass-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)]'
          : 'bg-ink-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] dark:bg-ink-700',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'flex h-[1.375rem] w-[1.375rem] items-center justify-center rounded-full bg-white shadow-md',
          'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',

          'group-active:scale-90',
          checked ? 'translate-x-[1.75rem]' : 'translate-x-[0.1875rem]',
        ].join(' ')}
      >
        {checked ? (
          <svg viewBox="0 0 12 12" className="h-3 w-3 text-brass-600" fill="none" aria-hidden="true">
            <path
              d="M2.5 6.2l2.3 2.3L9.5 3.8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span className="h-[0.6rem] w-[1.5px] rounded-full bg-ink-300" />
        )}
      </span>
    </button>
  )
}
