// The pieces every settings section shares: fields, rows, save bar.

import { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../context/SettingsContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { DEFAULT_SETTINGS, diffSettings } from '../../lib/settings.js'
import Card from '../dashboard/Card.jsx'
import Switch from '../Switch.jsx'
import { INPUT, LABEL, SELECT, SELECT_ARROW } from '../circulation/Shared.jsx'

export function useSection(section) {
  const { settings, save, reset } = useSettings()
  const { user } = useAuth()

  const [draft, setDraft] = useState(settings[section])
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => setDraft(settings[section]), [settings, section])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  const changes = useMemo(
    () => diffSettings(settings[section], draft, section),
    [settings, section, draft],
  )

  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }))

  const setIn = (key, inner, value) =>
    setDraft((current) => ({ ...current, [key]: { ...current[key], [inner]: value } }))

  const toggleIn = (key, item, order = null) =>
    setDraft((current) => {
      const list = current[key] ?? []
      const next = list.includes(item)
        ? list.filter((entry) => entry !== item)
        : [...list, item]

      return { ...current, [key]: order ? order.filter((entry) => next.includes(entry)) : next }
    })

  async function commit() {
    setSaving(true)
    try {
      const applied = await save(section, draft, { actor: user })
      setNotice(
        applied.length
          ? `${applied.length} setting${applied.length === 1 ? '' : 's'} updated. Every module now works to these figures.`
          : 'Nothing had changed.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function restore() {
    setSaving(true)
    try {
      await reset(section, { actor: user, reason: 'Restored to defaults' })
      setNotice('Restored to the shipped defaults.')
    } finally {
      setSaving(false)
    }
  }

  return {
    draft,
    set,
    setIn,
    toggleIn,
    setDraft,
    changes,
    dirty: changes.length > 0,
    saving,
    notice,
    commit,
    restore,
    defaults: DEFAULT_SETTINGS[section],
  }
}

export function SaveBar({ state, title }) {
  return (
    <>
      <div className="sticky bottom-0 z-10 flex justify-center rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-lg dark:border-ink-800 dark:bg-ink-900">

        <button
          type="button"
          onClick={state.commit}
          disabled={state.saving || !state.dirty}
          className="rounded-lg bg-brass-600 px-8 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed"
        >
          {state.saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {state.notice && (
        <div
          role="status"
          aria-live="polite"
          className="animate-rise pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4"
        >
          <p className="flex items-center gap-2.5 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-900 shadow-xl dark:border-emerald-500/40 dark:bg-emerald-900 dark:text-emerald-100">
            <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            {state.notice}
          </p>
        </div>
      )}
    </>
  )
}

export function Fixed({ label, value, hint, className = '' }) {
  return (
    <div className={className}>
      <p className={LABEL}>{label}</p>
      <p className="rounded-lg border border-ink-100 bg-ink-50 px-3.5 py-2.5 text-[0.95rem] text-ink-700 dark:border-ink-800 dark:bg-ink-800/60 dark:text-ink-200">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-ink-400">{hint}</p>}
    </div>
  )
}

export function Field({ label, hint, children, htmlFor }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-400">{hint}</p>}
    </div>
  )
}

export function TextSetting({ label, hint, value, onChange, type = 'text', ...rest }) {
  const id = `set-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(type === 'number' ? Number(event.target.value) : event.target.value)}
        className={INPUT}
        {...rest}
      />
    </Field>
  )
}

export function SelectSetting({ label, hint, value, onChange, options }) {
  const id = `set-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        style={SELECT_ARROW}
        className={SELECT}
      >
        {options.map((option) => (
          <option key={option.value ?? option} value={option.value ?? option}>
            {option.label ?? option}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function Toggle({ label, hint, checked, onChange, disabled }) {
  return (
    <li className="flex items-start justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
      </div>
      <Switch label={label} checked={checked} onChange={onChange} disabled={disabled} />
    </li>
  )
}

export function ToggleList({ children }) {
  return <ul className="divide-y divide-ink-100 dark:divide-ink-800">{children}</ul>
}

export function Group({ title, subtitle, children, columns = 3 }) {
  const grid = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }
  return (
    <Card title={title} subtitle={subtitle}>
      <div className={`grid gap-4 p-5 ${grid[columns]}`}>{children}</div>
    </Card>
  )
}

export { Card }
