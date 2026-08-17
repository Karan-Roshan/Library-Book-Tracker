// Where a new member of staff sets their password from an invite link.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Logo, { Wordmark } from '../components/Logo.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { ROLE_LABELS } from '../lib/permissions.js'
import * as onboarding from '../services/onboarding.js'

export default function ActivatePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { settings } = useSettings()

  const [check, setCheck] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    onboarding.checkToken(token).then(setCheck)
  }, [token])

  const minimum = settings.security.minPasswordLength

  async function submit(event) {
    event.preventDefault()
    setError(null)

    if (password.length < minimum) return setError(`Choose at least ${minimum} characters.`)
    if (password !== confirm) return setError('The two passwords do not match.')

    setBusy(true)
    try {
      await onboarding.activate(token, password, { settings })
      setDone(true)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  const shell =
    'flex min-h-dvh items-center justify-center bg-parchment px-4 py-10 dark:bg-ink-950'
  const card =
    'w-full max-w-md rounded-xl border border-ink-100 bg-white p-8 shadow-lg dark:border-ink-800 dark:bg-ink-900'
  const input =
    'w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-white'
  const label =
    'mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400'

  if (!check) {
    return (
      <div className={shell}>
        <Logo className="h-9 w-9 animate-pulse text-brass-500" />
      </div>
    )
  }

  if (!check.ok) {
    return (
      <div className={shell}>
        <div className={card}>
          <Wordmark />
          <h1 className="mt-6 font-display text-xl text-ink-900 dark:text-white">
            This link cannot be used
          </h1>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">{check.reason}</p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className={shell}>
        <div className={card}>
          <Wordmark />
          <h1 className="mt-6 font-display text-xl text-ink-900 dark:text-white">
            Your account is active
          </h1>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
            Welcome to {settings.library.name}, {check.user.name.split(' ')[0]}. You can sign in now
            with your email address and the password you just chose.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="mt-6 w-full rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500"
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={shell}>
      <form onSubmit={submit} noValidate className={card}>
        <Wordmark />

        <h1 className="mt-6 font-display text-xl text-ink-900 dark:text-white">
          Welcome, {check.user.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          Choose a password to activate your {ROLE_LABELS[check.user.role]} account.
        </p>

        <dl className="mt-5 space-y-1.5 rounded-lg border border-ink-100 p-4 dark:border-ink-800">
          {[
            ['Staff ID', check.user.membershipNumber],
            ['Role', ROLE_LABELS[check.user.role]],
            ['Email', check.user.email],
          ].map(([key, value]) => (
            <div key={key} className="flex justify-between gap-3 text-sm">
              <dt className="text-ink-400">{key}</dt>
              <dd className="font-medium text-ink-800 dark:text-ink-100">{value}</dd>
            </div>
          ))}
        </dl>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="activate-password" className={label}>
              Choose a password
            </label>
            <input
              id="activate-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={input}
              required
            />
            <p className="mt-1.5 text-xs text-ink-400">
              At least {minimum} characters. Nobody at the library can see it.
            </p>
          </div>

          <div>
            <label htmlFor="activate-confirm" className={label}>
              Confirm it
            </label>
            <input
              id="activate-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className={input}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || !password || !confirm}
          className="mt-6 w-full rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500 disabled:cursor-not-allowed disabled:bg-brass-200"
        >
          {busy ? 'Activating…' : 'Activate my account'}
        </button>
      </form>
    </div>
  )
}
