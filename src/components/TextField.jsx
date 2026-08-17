// A labelled text box that shows its own error underneath.

import { useId } from 'react'

export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-red-600">
      *
    </span>
  )
}

export default function TextField({
  label,
  error,

  reserve = false,

  invalid = false,
  hint,
  icon,
  trailing,
  className = '',
  ...props
}) {
  const generatedId = useId()
  const id = props.id ?? generatedId
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400"
      >
        {label}
        {props.required && <RequiredMark />}
      </label>

      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-ink-400">
            {icon}
          </span>
        )}

        <input
          {...props}
          id={id}
          aria-invalid={error || invalid ? 'true' : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={[
            'w-full rounded-lg border bg-white py-2.5 text-[0.95rem] text-ink-900 shadow-sm',
            'placeholder:text-ink-300 dark:bg-ink-800 dark:text-white dark:placeholder:text-ink-500',
            'transition-[border-color,box-shadow] duration-150',
            'focus:outline-none focus:ring-4',
            icon ? 'pl-11' : 'pl-3.5',
            trailing ? 'pr-11' : 'pr-3.5',
            error || invalid
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
              : 'border-ink-200 hover:border-ink-300 focus:border-brass-500 focus:ring-brass-500/15 dark:border-ink-700',
          ].join(' ')}
        />

        {trailing && (
          <span className="absolute inset-y-0 right-0 flex w-11 items-center justify-center">
            {trailing}
          </span>
        )}
      </div>

      <div className={reserve ? 'mt-1 min-h-[1.25rem]' : undefined}>
        {error ? (
          <p
            id={errorId}
            role="alert"
            className={`flex items-start gap-1.5 text-sm text-red-600 ${reserve ? '' : 'mt-1.5'}`}
          >
            <svg viewBox="0 0 20 20" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 112 0 1 1 0 01-2 0zm.25-7.25a.75.75 0 011.5 0v4.5a.75.75 0 01-1.5 0v-4.5z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className={`text-sm text-ink-400 ${reserve ? '' : 'mt-1.5'}`}>
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  )
}
