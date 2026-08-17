// The member's own preferences and password.

import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { NOTIFICATION_EVENTS } from '../../lib/settings.js'
import { useSettings } from '../../context/SettingsContext.jsx'
import Switch from '../../components/Switch.jsx'
import * as memberAccess from '../../services/memberAccess.js'
import { INPUT, LABEL } from '../../components/circulation/Shared.jsx'
import { Card, PageHead } from './MemberKit.jsx'

export default function MySettings() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = usePreferences()
  const { settings } = useSettings()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const minimum = settings.security.minPasswordLength

  async function changePassword(event) {
    event.preventDefault()
    setError(null)

    if (next.length < minimum) {
      setError(`Your new password must be at least ${minimum} characters.`)
      return
    }
    if (next !== confirm) {
      setError('The two new passwords do not match.')
      return
    }

    setBusy(true)
    try {
      await memberAccess.changeOwnPassword(user.memberId, { current, next })
      setCurrent('')
      setNext('')
      setConfirm('')
      setNotice('Your password has been changed.')
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHead title="Account settings" subtitle="Your password and how this app looks." />

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {user.mustChange && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          <strong>Change your password.</strong> The library set the one you are using, which means
          somebody other than you knows it.
        </div>
      )}

      <Card title="Change password">
        <form onSubmit={changePassword} className="space-y-4 p-5" noValidate>
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="pw-current" className={LABEL}>
                Current password
              </label>
              <input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                className={INPUT}
                required
              />
            </div>
            <div>
              <label htmlFor="pw-next" className={LABEL}>
                New password
              </label>
              <input
                id="pw-next"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                className={INPUT}
                required
              />
              <p className="mt-1.5 text-xs text-ink-400">At least {minimum} characters.</p>
            </div>
            <div>
              <label htmlFor="pw-confirm" className={LABEL}>
                Confirm new password
              </label>
              <input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className={INPUT}
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy || !current || !next}
              className="rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500 disabled:cursor-not-allowed disabled:bg-brass-200"
            >
              {busy ? 'Changing…' : 'Change password'}
            </button>
          </div>
        </form>
      </Card>

      <Card title="Appearance">
        <div className="flex items-center justify-between gap-6 p-5">
          <div>
            <p className="text-sm font-medium text-ink-800 dark:text-ink-100">Dark mode</p>
            <p className="mt-0.5 text-xs text-ink-400">Applies to this device only.</p>
          </div>
          <Switch label="Dark mode" checked={theme === 'dark'} onChange={toggleTheme} />
        </div>
      </Card>

      <Card
        title="What the library sends you"
        subtitle="Set by the library. Ask at the desk if you would rather not receive one of these."
      >
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {NOTIFICATION_EVENTS.filter(
            (event) => settings.notifications.events[event.key]?.enabled,
          ).map((event) => (
            <li key={event.key} className="px-5 py-3">
              <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{event.label}</p>
              <p className="mt-0.5 text-xs text-ink-400">{event.hint}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Session">
        <div className="flex items-center justify-between gap-6 p-5">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            Signed in as {user.name} ({user.email}).
          </p>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            Sign out
          </button>
        </div>
      </Card>
    </div>
  )
}
