// The sign-in screen for staff and members.

import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import TextField from '../components/TextField.jsx'
import PasswordField from '../components/PasswordField.jsx'
import Button from '../components/Button.jsx'
import Alert from '../components/Alert.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { validateEmail } from '../lib/validation.js'
import { ROLE_LABELS, SIGN_IN_ROLES } from '../lib/permissions.js'

const TAB_LABELS = {
  owner: 'Administrator',
  librarian: 'Assistant',
  member: 'Member',
}

const MAIL_ICON = (
  <svg viewBox="0 0 20 20" className="h-[1.05rem] w-[1.05rem]" fill="currentColor" aria-hidden="true">
    <path d="M3 5.5A1.5 1.5 0 014.5 4h11A1.5 1.5 0 0117 5.5v.4l-7 3.9-7-3.9v-.4z" />
    <path d="M17 7.7V14.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 14.5V7.7l6.6 3.7c.25.14.55.14.8 0L17 7.7z" />
  </svg>
)

export default function LoginPage() {
  const { signIn, needsSetup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [values, setValues] = useState({
    email: '',
    password: '',
    remember: false,
    expectedRole: 'owner',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [notice, setNotice] = useState(location.state?.notice ?? null)
  const [submitting, setSubmitting] = useState(false)

  const [badCredentials, setBadCredentials] = useState(false)

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setValues((current) => ({ ...current, [field]: value }))

    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }))
    setBadCredentials(false)
    setFormError(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const emailError = validateEmail(values.email)
    if (emailError) {
      setErrors({ email: emailError, password: null })
      return
    }

    if (!values.password) {
      setErrors({ email: null, password: 'Enter your password.' })
      return
    }

    setErrors({})

    setSubmitting(true)
    setBadCredentials(false)
    setFormError(null)
    setNotice(null)
    try {
      const signedIn = await signIn(values)

      const home = signedIn.role === 'member' ? '/my' : '/dashboard'
      const wanted = location.state?.from
      const allowed =
        wanted && (signedIn.role === 'member' ? wanted.startsWith('/my') : !wanted.startsWith('/my'))
      navigate(allowed ? wanted : home, { replace: true })
    } catch (error) {
      if (error.field) {
        setErrors((current) => ({ ...current, [error.field]: error.message }))
      } else {
        setBadCredentials(true)
        setErrors((current) => ({ ...current, password: error.message }))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Staff & member access"
      title="Sign in to your library"
      subtitle="Enter the credentials issued with your Athenaeum account."
      tabs={
        <div role="radiogroup" aria-label="Sign in as" className="flex border-b border-ink-100 dark:border-ink-800">
          {SIGN_IN_ROLES.map((role) => {
            const selected = values.expectedRole === role
            return (
              <label
                key={role}
                className={[
                  'flex-1 cursor-pointer px-2 py-4 text-center text-[0.8rem] font-semibold uppercase',
                  'tracking-[0.06em] transition-colors duration-150',
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-brass-500',
                  selected
                    ? 'bg-brass-600 text-white'
                    : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="expectedRole"
                  value={role}
                  checked={selected}
                  onChange={update('expectedRole')}
                  className="sr-only"
                />
                {TAB_LABELS[role]}
              </label>
            )
          })}
        </div>
      }
      footer={
        needsSetup ? (
          <p className="text-center text-sm text-ink-500">
            No accounts exist yet.{' '}
            <Link
              to="/setup"
              className="font-semibold text-brass-700 underline-offset-4 hover:underline"
            >
              Set up the administrator account
            </Link>
          </p>
        ) : null
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        {formError && <Alert>{formError}</Alert>}
        {notice && <Alert tone="info">{notice}</Alert>}

        <TextField
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@gmail.com"
          icon={MAIL_ICON}
          value={values.email}
          onChange={update('email')}
          error={errors.email}
          invalid={badCredentials}
          reserve
          required
        />

        <div>
          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={values.password}
            onChange={update('password')}
            error={errors.password}
            invalid={badCredentials}
            reserve
            required
          />

          <div className="mt-3.5 flex items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                name="remember"
                checked={values.remember}
                onChange={update('remember')}
                className="h-4 w-4 rounded border-ink-300 text-brass-600 accent-brass-600"
              />
              Keep me signed in
            </label>

            <button
              type="button"
              onClick={() =>
                setNotice(
                  'Password resets are handled at the circulation desk until email service is connected.',
                )
              }
              className="text-sm font-medium text-brass-700 underline-offset-4 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </div>

        <Button type="submit" variant="brass" loading={submitting} className="mt-7">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
