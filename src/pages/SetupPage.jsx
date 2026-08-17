// The one-time screen that creates the library's first administrator.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import TextField from '../components/TextField.jsx'
import PasswordField from '../components/PasswordField.jsx'
import Button from '../components/Button.jsx'
import Alert from '../components/Alert.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  validateConfirmation,
  validateEmail,
  validateName,
  validatePassword,
} from '../lib/validation.js'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../lib/permissions.js'

const USER_ICON = (
  <svg viewBox="0 0 20 20" className="h-[1.05rem] w-[1.05rem]" fill="currentColor" aria-hidden="true">
    <path d="M10 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm-7 6.6C3 13.9 6 12.3 10 12.3s7 1.6 7 4.3V18H3v-1.4z" />
  </svg>
)

const MAIL_ICON = (
  <svg viewBox="0 0 20 20" className="h-[1.05rem] w-[1.05rem]" fill="currentColor" aria-hidden="true">
    <path d="M3 5.5A1.5 1.5 0 014.5 4h11A1.5 1.5 0 0117 5.5v.4l-7 3.9-7-3.9v-.4z" />
    <path d="M17 7.7V14.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 14.5V7.7l6.6 3.7c.25.14.55.14.8 0L17 7.7z" />
  </svg>
)

export default function SetupPage() {
  const { claimLibrary } = useAuth()
  const navigate = useNavigate()

  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    confirmation: '',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }))
    setFormError(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = {
      name: validateName(values.name),
      email: validateEmail(values.email),
      password: validatePassword(values.password),
      confirmation: validateConfirmation(values.password, values.confirmation),
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    setSubmitting(true)
    setFormError(null)
    try {
      await claimLibrary(values)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setFormError(error.message)
      if (error.field) setErrors((current) => ({ ...current, [error.field]: error.message }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="First-time setup"
      title="Create the administrator account"
      subtitle="This is the account that runs the library. Every other account — assistants and members alike — is issued from inside the system by you."
      footer={
        <p className="text-center text-sm text-ink-500">
          Setting this up by mistake?{' '}
          <Link
            to="/login"
            className="font-semibold text-brass-700 underline-offset-4 hover:underline"
          >
            Return to sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Alert tone="info">
          This screen appears only while the library has no accounts. Once the administrator
          account exists it is sealed, and there is no public sign-up.
        </Alert>

        {formError && <Alert>{formError}</Alert>}

        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
            Account type
          </legend>
          <div className="space-y-2.5">
            <div className="rounded-lg border border-brass-500 bg-brass-50 p-3 ring-4 ring-brass-500/12">
              <p className="text-sm font-semibold text-brass-900">
                {ROLE_LABELS.owner}
                <span className="ml-2 text-xs font-medium text-brass-700">This account</span>
              </p>
              <p className="mt-0.5 text-xs leading-snug text-ink-600">
                {ROLE_DESCRIPTIONS.owner}
              </p>
            </div>

            <div className="rounded-lg border border-dashed border-ink-200 p-3 opacity-70">
              <p className="text-sm font-semibold text-ink-500">{ROLE_LABELS.librarian}</p>
              <p className="mt-0.5 text-xs leading-snug text-ink-400">
                {ROLE_DESCRIPTIONS.librarian} Created by the administrator afterwards, from
                Staff Accounts.
              </p>
            </div>
          </div>
        </fieldset>

        <TextField
          label="Administrator's full name"
          name="name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          icon={USER_ICON}
          value={values.name}
          onChange={update('name')}
          error={errors.name}
          required
        />

        <TextField
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="owner@gmail.com"
          icon={MAIL_ICON}
          value={values.email}
          onChange={update('email')}
          error={errors.email}
          hint="Used to sign in. There is no password reset yet, so record it somewhere safe."
          required
        />

        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          showMeter
          value={values.password}
          onChange={update('password')}
          error={errors.password}
          hint="Use upper and lower case letters plus a number."
          required
        />

        <PasswordField
          label="Confirm password"
          name="confirmation"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={values.confirmation}
          onChange={update('confirmation')}
          error={errors.confirmation}
          required
        />

        <Button type="submit" variant="brass" loading={submitting}>
          {submitting ? 'Creating administrator account…' : 'Create administrator account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
