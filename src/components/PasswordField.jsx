// A password box with an eye to show what was typed.

import { useState } from 'react'
import TextField from './TextField.jsx'
import { scorePassword } from '../lib/validation.js'

const METER_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-emerald-600',
]

const LOCK_ICON = (
  <svg viewBox="0 0 20 20" className="h-[1.05rem] w-[1.05rem]" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M10 1.5A3.75 3.75 0 006.25 5.25V8H6a2 2 0 00-2 2v6a2 2 0 002 2h8a2 2 0 002-2v-6a2 2 0 00-2-2h-.25V5.25A3.75 3.75 0 0010 1.5zm2.25 6.5V5.25a2.25 2.25 0 10-4.5 0V8h4.5z"
      clipRule="evenodd"
    />
  </svg>
)

export default function PasswordField({
  reserve = false,
  invalid = false, showMeter = false, value = '', ...props }) {
  const [visible, setVisible] = useState(false)
  const strength = showMeter ? scorePassword(value) : null

  return (
    <div>
      <TextField
        {...props}
        value={value}
        type={visible ? 'text' : 'password'}
        icon={LOCK_ICON}
      reserve={reserve}
      invalid={invalid}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((shown) => !shown)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            className="rounded p-1 text-ink-400 transition-colors hover:text-ink-700"
          >
            {visible ? (
              <svg viewBox="0 0 20 20" className="h-[1.05rem] w-[1.05rem]" fill="currentColor" aria-hidden="true">
                <path d="M3.28 2.22a.75.75 0 10-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-2.3-2.3A9.9 9.9 0 0019 10c-1.6-3.6-5-6-9-6a9.3 9.3 0 00-3.6.72L3.28 2.22zM10 6.5c1.93 0 3.5 1.57 3.5 3.5 0 .5-.1.96-.29 1.39l-4.6-4.6c.43-.19.9-.29 1.39-.29z" />
                <path d="M1 10c.9-2.02 2.5-3.7 4.5-4.7l1.62 1.62A3.5 3.5 0 0011.9 12.6l2.03 2.03A9.4 9.4 0 0110 16c-4 0-7.4-2.4-9-6z" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" className="h-[1.05rem] w-[1.05rem]" fill="currentColor" aria-hidden="true">
                <path d="M10 4c-4 0-7.4 2.4-9 6 1.6 3.6 5 6 9 6s7.4-2.4 9-6c-1.6-3.6-5-6-9-6zm0 10a4 4 0 110-8 4 4 0 010 8zm0-1.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              </svg>
            )}
          </button>
        }
      />

      {showMeter && value && (
        <div className="mt-2.5" aria-live="polite">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((segment) => (
              <span
                key={segment}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  segment <= strength.score ? METER_COLORS[strength.score] : 'bg-ink-100'
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-500">
            Password strength: <span className="font-semibold text-ink-700">{strength.label}</span>
          </p>
        </div>
      )}
    </div>
  )
}
