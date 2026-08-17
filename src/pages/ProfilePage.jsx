// Your own account: details, password and photo.

import { useEffect, useMemo, useRef, useState } from 'react'
import Card from '../components/dashboard/Card.jsx'
import TextField, { RequiredMark } from '../components/TextField.jsx'
import Alert from '../components/Alert.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { formatDate } from '../lib/format.js'
import { readAvatar } from '../lib/image.js'
import { validateEmail, validateName, validatePhone } from '../lib/validation.js'
import { CAPABILITIES, ROLE_LABELS, can } from '../lib/permissions.js'

const BASE_FIELDS = ['name', 'phone', 'avatar']

const initials = (name) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

export default function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const { locale } = usePreferences()
  const fileInput = useRef(null)

  const canEditEmail = can(user, CAPABILITIES.CHANGE_EMAIL)
  const fields = canEditEmail ? [...BASE_FIELDS, 'email'] : BASE_FIELDS

  const baseline = useMemo(
    () => ({
      name: user.name ?? '',
      phone: user.phone ?? '',
      email: user.email ?? '',
      avatar: user.avatar ?? null,
    }),
    [user],
  )

  const [values, setValues] = useState(baseline)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValues(baseline)
    setErrors({})
  }, [baseline])

  const dirty = fields.some((field) => values[field] !== baseline[field])

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const update = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }))
    setFormError(null)
    setSaved(false)
  }

  async function handleAvatarPick(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const dataUrl = await readAvatar(file)
      setValues((current) => ({ ...current, avatar: dataUrl }))
      setFormError(null)
      setSaved(false)
    } catch (error) {
      setFormError(error.message)
    }
  }

  function handleCancel() {
    setValues(baseline)
    setErrors({})
    setFormError(null)
    setSaved(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = {
      name: validateName(values.name),
      phone: validatePhone(values.phone),
      ...(canEditEmail && { email: validateEmail(values.email) }),
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) {
      setFormError('Some details need fixing before this can be saved.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const { email, ...rest } = values
      await updateProfile(user.id, {
        ...rest,
        phone: values.phone.replace(/\D/g, ''),
        ...(canEditEmail && { email }),
      })
      setSaved(true)
    } catch (error) {
      setFormError(error.message)
      if (error.field) setErrors((current) => ({ ...current, [error.field]: error.message }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-ink-900 dark:text-white">My profile</h1>
        {dirty && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            Unsaved changes
          </span>
        )}
      </header>

      {formError && <Alert>{formError}</Alert>}
      {saved && !dirty && <Alert tone="info">Profile updated.</Alert>}

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card title="Profile photo" subtitle="Shown beside your name across the system">
            <div className="flex flex-col items-center py-2">
              <div className="relative">
                {values.avatar ? (
                  <img
                    src={values.avatar}
                    alt=""
                    className="h-28 w-28 rounded-full object-cover ring-4 ring-ink-100 dark:ring-ink-800"
                  />
                ) : (
                  <span className="flex h-28 w-28 items-center justify-center rounded-full bg-ink-900 font-display text-3xl text-brass-200 ring-4 ring-ink-100 dark:bg-brass-600 dark:text-white dark:ring-ink-800">
                    {initials(values.name || user.name)}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  aria-label="Change profile photo"
                  title="Change profile photo"
                  className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-brass-600 text-white shadow-md transition-colors hover:bg-brass-500 dark:border-ink-900"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M13.6 2.9a1.6 1.6 0 012.3 0l1.2 1.2a1.6 1.6 0 010 2.3l-8.1 8.1-3.5.9a.8.8 0 01-1-1l.9-3.5 8.2-8zM12.5 5.2l2.3 2.3 1.2-1.2-2.3-2.3-1.2 1.2z" />
                  </svg>
                </button>

                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarPick}
                  className="sr-only"
                />
              </div>

              {values.avatar && (
                <button
                  type="button"
                  onClick={() => {
                    setValues((current) => ({ ...current, avatar: null }))
                    setSaved(false)
                  }}
                  className="mt-4 text-xs font-semibold text-red-600 underline-offset-4 hover:underline"
                >
                  Remove photo
                </button>
              )}
            </div>
          </Card>

          <Card title="Account" subtitle="Issued by the library — not editable here">
            <dl className="space-y-3 text-sm">
              {[
                ['Personnel ID', user.membershipNumber],
                ['Role', ROLE_LABELS[user.role] ?? 'Member'],
                ['Joined', user.createdAt ? formatDate(user.createdAt, locale) : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <dt className="text-ink-400">{label}</dt>
                  <dd className="font-semibold text-ink-800 dark:text-ink-100">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <Card title="Personal details">
          <div className="space-y-5">
            <TextField
              label="Full name"
              name="name"
              autoComplete="name"
              value={values.name}
              onChange={update('name')}
              error={errors.name}
              required
            />

            <div>
              <label
                htmlFor="profile-phone"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400"
              >
                Phone number
                <RequiredMark />
              </label>
              <div className="flex">

                <span className="inline-flex shrink-0 items-center rounded-l-lg border border-r-0 border-ink-200 bg-ink-50 px-3 text-[0.95rem] font-medium text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
                  +91
                </span>
                <input
                  id="profile-phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  value={values.phone}
                  onChange={update('phone')}
                  aria-invalid={errors.phone ? 'true' : undefined}
                  aria-describedby={errors.phone ? 'profile-phone-error' : undefined}
                  className={`w-full rounded-r-lg border bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm transition-[border-color,box-shadow] duration-150 placeholder:text-ink-300 focus:outline-none focus:ring-4 dark:bg-ink-800 dark:text-white dark:placeholder:text-ink-500 ${
                    errors.phone
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                      : 'border-ink-200 hover:border-ink-300 focus:border-brass-500 focus:ring-brass-500/15 dark:border-ink-700'
                  }`}
                />
              </div>
              {errors.phone && (
                <p id="profile-phone-error" role="alert" className="mt-1.5 text-sm text-red-600">
                  {errors.phone}
                </p>
              )}
            </div>

            {canEditEmail ? (
              <TextField
                label="Email address"
                type="email"
                name="email"
                autoComplete="email"
                value={values.email}
                onChange={update('email')}
                error={errors.email}
                hint="Your sign-in address. Changing it changes how you log in."
                required
              />
            ) : (
              <div>
                <label
                  htmlFor="profile-email"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400"
                >
                  Email address
                </label>
                <input
                  id="profile-email"
                  type="email"
                  value={user.email}
                  readOnly
                  aria-describedby="profile-email-hint"
                  className="w-full cursor-not-allowed rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-[0.95rem] text-ink-500 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-400"
                />
                <p id="profile-email-hint" className="mt-1.5 text-sm text-ink-400">
                  Your sign-in address. Fixed — the administrator can change it for you.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-ink-100 pt-5 dark:border-ink-800">

            <button
              type="button"
              onClick={handleCancel}
              disabled={!dirty || saving}
              className="rounded-lg border border-ink-200 px-5 py-2.5 text-[0.95rem] font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 disabled:cursor-not-allowed disabled:border-ink-100 disabled:text-ink-300 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800 dark:disabled:border-ink-800 dark:disabled:text-ink-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!dirty || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brass-600 px-5 py-2.5 text-[0.95rem] font-semibold text-white shadow-sm transition-colors hover:bg-brass-500 disabled:cursor-not-allowed disabled:bg-brass-200 dark:disabled:bg-ink-800 dark:disabled:text-ink-600"
            >
              {saving && (
                <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </Card>
      </div>
    </form>
  )
}
