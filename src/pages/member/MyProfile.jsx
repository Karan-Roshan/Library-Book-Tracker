// The member's own details, photo and membership dates.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '../../components/Alert.jsx'
import TextField from '../../components/TextField.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatDate } from '../../lib/format.js'
import { ageFrom } from '../../lib/members.js'
import { readAvatar } from '../../lib/image.js'
import {
  normalizeName,
  validateAddress,
  validateDateOfBirth,
  validateName,
  validatePhone,
} from '../../lib/validation.js'
import * as membersService from '../../services/members.js'
import * as memberAccess from '../../services/memberAccess.js'
import { useMyLibrary } from '../../hooks/useMyLibrary.js'
import { INPUT, LABEL } from '../../components/circulation/Shared.jsx'
import { Card, PageHead } from './MemberKit.jsx'

const FIELDS = ['name', 'dob', 'phone', 'address', 'avatar']

const initials = (name = '') =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

// Label and value, the way the staff profile lists account facts.
function Fact({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-ink-400">{label}</dt>
      <dd className="text-right font-semibold text-ink-800 dark:text-ink-100">{value}</dd>
    </div>
  )
}

export default function MyProfile() {
  const { user, refreshUser } = useAuth()
  const { locale, system } = usePreferences()
  const my = useMyLibrary()
  const fileInput = useRef(null)

  const baseline = useMemo(
    () => ({
      name: my.me?.name ?? '',
      dob: my.me?.dob?.slice(0, 10) ?? '',
      phone: my.me?.phone ?? '',
      address: my.me?.address ?? '',
      avatar: my.me?.avatar ?? null,
    }),
    [my.me],
  )

  const [values, setValues] = useState(baseline)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const [password, setPassword] = useState({ current: '', next: '', confirm: '' })
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState(null)
  const [passwordNotice, setPasswordNotice] = useState(null)

  useEffect(() => {
    setValues(baseline)
    setErrors({})
  }, [baseline])

  const dirty = FIELDS.some((field) => values[field] !== baseline[field])

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Success banners say their piece and go, the way the rest of the app does.
  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), 5000)
    return () => clearTimeout(timer)
  }, [saved])

  useEffect(() => {
    if (!passwordNotice) return undefined
    const timer = setTimeout(() => setPasswordNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [passwordNotice])

  if (my.loading) return <p className="py-20 text-center text-sm text-ink-400">Reading your account…</p>
  if (!my.me) return <p className="py-20 text-center text-sm text-ink-400">Membership record not found.</p>

  const me = my.me
  const expired = me.expiresAt && new Date(me.expiresAt) < my.now

  // Follows the date being edited, so the membership card answers before the
  // form is even saved.
  const age = errors.dob ? null : ageFrom(values.dob, my.now)
  const todayISO = my.now.toISOString().slice(0, 10)

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
    } catch (problem) {
      setFormError(problem.message)
    }
  }

  function handleCancel() {
    setValues(baseline)
    setErrors({})
    setFormError(null)
    setSaved(false)
  }

  const minimum = my.settings.security.minPasswordLength

  const editPassword = (field) => (event) => {
    const { value } = event.target
    setPassword((current) => ({ ...current, [field]: value }))
    setPasswordError(null)
    setPasswordNotice(null)
  }

  async function changePassword(event) {
    event.preventDefault()
    setPasswordError(null)

    if (password.next.length < minimum) {
      setPasswordError(`Your new password must be at least ${minimum} characters.`)
      return
    }
    if (password.next !== password.confirm) {
      setPasswordError('The two new passwords do not match.')
      return
    }

    setPasswordBusy(true)
    try {
      await memberAccess.changeOwnPassword(user.memberId, {
        current: password.current,
        next: password.next,
      })
      setPassword({ current: '', next: '', confirm: '' })
      setPasswordNotice('Your password has been changed.')
    } catch (problem) {
      setPasswordError(problem.message)
    } finally {
      setPasswordBusy(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = {
      name: validateName(values.name),
      dob: validateDateOfBirth(values.dob),
      phone: values.phone ? validatePhone(values.phone) : null,
      address: values.address ? validateAddress(values.address) : null,
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) {
      setFormError('Some details need fixing before this can be saved.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const name = normalizeName(values.name)

      await membersService.patchMember(
        me.id,
        {
          name,
          dob: values.dob ? new Date(values.dob).toISOString() : null,
          phone: values.phone.replace(/\D/g, ''),
          address: values.address,
          avatar: values.avatar,
        },
        { name: me.name, memberId: me.membershipNumber },
      )

      // The register is only half of it: the sign-in record carries the name
      // the session and the audit trail use, so it has to move too.
      if (name !== me.name) {
        await memberAccess.renameLogin(me.id, name)
        await refreshUser()
      }

      await my.refresh()
      setSaved(true)
    } catch (problem) {
      setFormError(problem.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHead
        title="Profile & Membership"
        subtitle="Your library account."
        action={
          dirty && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              Unsaved changes
            </span>
          )
        }
      />

      {formError && <Alert>{formError}</Alert>}
      {saved && !dirty && <Alert tone="info">Profile updated.</Alert>}
      {passwordNotice && <Alert tone="info">{passwordNotice}</Alert>}
      {user.mustChange && (
        <Alert>
          <strong>Change your password.</strong> The library set the one you are using, which means
          somebody other than you knows it.
        </Alert>
      )}
      {expired && (
        <Alert>
          Your membership has lapsed. Bring your card to the desk to renew it — you cannot borrow
          until it is renewed, though you can still{' '}
          <Link to="/my/browse" className="font-semibold underline">
            browse the catalogue
          </Link>
          .
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card title="Profile photo" subtitle="Shown beside your name across the library">
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
                    {initials(me.name || user.name)}
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

          <Card title="Membership" subtitle="Set by the library, apart from your age">
            <dl className="space-y-3 text-sm">
              <Fact label="Member ID" value={me.membershipNumber} />
              <Fact label="Member type" value={me.type} />
              <Fact label="Status" value={expired ? 'Expired' : me.status} />
              <Fact label="Age" value={age ?? '—'} />
              <Fact label="Member since" value={formatDate(me.joinedAt, locale, system)} />
              <Fact
                label="Card issued"
                value={me.idIssuedAt ? formatDate(me.idIssuedAt, locale, system) : '—'}
              />
              <Fact
                label="Last renewed"
                value={me.renewedAt ? formatDate(me.renewedAt, locale, system) : 'Never'}
              />
              <Fact
                label="Valid until"
                value={me.expiresAt ? formatDate(me.expiresAt, locale, system) : '—'}
              />
            </dl>
          </Card>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <Card title="Personal details">
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="my-name"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400"
                >
                  Full name
                </label>
                <input
                  id="my-name"
                  name="name"
                  autoComplete="name"
                  value={values.name}
                  onChange={update('name')}
                  aria-invalid={errors.name ? 'true' : undefined}
                  aria-describedby={errors.name ? 'my-name-error' : 'my-name-hint'}
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-4 dark:bg-ink-800 dark:text-white ${
                    errors.name
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                      : 'border-ink-200 hover:border-ink-300 focus:border-brass-500 focus:ring-brass-500/15 dark:border-ink-700'
                  }`}
                />
                {errors.name ? (
                  <p id="my-name-error" role="alert" className="mt-1.5 text-sm text-red-600">
                    {errors.name}
                  </p>
                ) : (
                  <p id="my-name-hint" className="mt-1.5 text-sm text-ink-400">
                    The name the desk sees on your membership. Your member ID does not change.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="my-email"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400"
                >
                  Email address
                </label>
                <input
                  id="my-email"
                  type="email"
                  value={me.email}
                  readOnly
                  aria-describedby="my-email-hint"
                  className="w-full cursor-not-allowed rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-[0.95rem] text-ink-500 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-400"
                />
                <p id="my-email-hint" className="mt-1.5 text-sm text-ink-400">
                  Your sign-in address. Fixed — the library can change it for you.
                </p>
              </div>

              <div>
                <label
                  htmlFor="my-dob"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400"
                >
                  Date of birth
                </label>
                <input
                  id="my-dob"
                  name="dob"
                  type="date"
                  max={todayISO}
                  value={values.dob}
                  onChange={update('dob')}
                  aria-invalid={errors.dob ? 'true' : undefined}
                  aria-describedby={errors.dob ? 'my-dob-error' : 'my-dob-hint'}
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-4 dark:bg-ink-800 dark:text-white ${
                    errors.dob
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                      : 'border-ink-200 hover:border-ink-300 focus:border-brass-500 focus:ring-brass-500/15 dark:border-ink-700'
                  }`}
                />
                {errors.dob ? (
                  <p id="my-dob-error" role="alert" className="mt-1.5 text-sm text-red-600">
                    {errors.dob}
                  </p>
                ) : (
                  <p id="my-dob-hint" className="mt-1.5 text-sm text-ink-400">
                    Your age is worked out from this, and shown on your membership.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="my-phone"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400"
                >
                  Phone number
                </label>
                <div className="flex">
                  <span className="inline-flex shrink-0 items-center rounded-l-lg border border-r-0 border-ink-200 bg-ink-50 px-3 text-[0.95rem] font-medium text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
                    +91
                  </span>
                  <input
                    id="my-phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="tel-national"
                    placeholder="98765 43210"
                    value={values.phone}
                    onChange={update('phone')}
                    aria-invalid={errors.phone ? 'true' : undefined}
                    aria-describedby={errors.phone ? 'my-phone-error' : undefined}
                    className={`w-full rounded-r-lg border bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm transition-[border-color,box-shadow] duration-150 placeholder:text-ink-300 focus:outline-none focus:ring-4 dark:bg-ink-800 dark:text-white dark:placeholder:text-ink-500 ${
                      errors.phone
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                        : 'border-ink-200 hover:border-ink-300 focus:border-brass-500 focus:ring-brass-500/15 dark:border-ink-700'
                    }`}
                  />
                </div>
                {errors.phone && (
                  <p id="my-phone-error" role="alert" className="mt-1.5 text-sm text-red-600">
                    {errors.phone}
                  </p>
                )}
              </div>

              <TextField
                label="Address"
                id="my-address"
                name="address"
                autoComplete="street-address"
                value={values.address}
                onChange={update('address')}
                error={errors.address}
                hint="The library uses this to reach you about your books."
              />
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
        </form>
      </div>

      <Card tone="brass" title="Change password" subtitle="Used to sign in to your library account">
        <form onSubmit={changePassword} className="space-y-4 p-5" noValidate>
          {passwordError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
            >
              {passwordError}
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
                value={password.current}
                onChange={editPassword('current')}
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
                value={password.next}
                onChange={editPassword('next')}
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
                value={password.confirm}
                onChange={editPassword('confirm')}
                className={INPUT}
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordBusy || !password.current || !password.next}
              className="rounded-lg bg-brass-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brass-400 disabled:cursor-not-allowed disabled:bg-brass-300"
            >
              {passwordBusy ? 'Changing…' : 'Change password'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
