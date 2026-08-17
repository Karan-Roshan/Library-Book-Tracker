// The form for adding or editing a member of staff.

import { useCallback, useEffect, useRef, useState } from 'react'
import TextField, { RequiredMark } from '../TextField.jsx'
import PasswordField from '../PasswordField.jsx'
import Alert from '../Alert.jsx'
import { useDismiss } from '../../hooks/useDismiss.js'
import { readAvatar } from '../../lib/image.js'
import { PERSONNEL_ROLES, ROLE_LABELS } from '../../lib/permissions.js'
import {
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
} from '../../lib/validation.js'

const EMPTY = {
  name: '',
  role: 'shelving',
  phone: '',
  email: '',
  avatar: null,

  shift: '',
  password: '',
  joinedAt: '',
}

const todayValue = () => new Date().toISOString().slice(0, 10)

export const SHIFTS = ['Day', 'Night']

const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

const toForm = (personnel) =>
  personnel
    ? {
        name: personnel.name ?? '',
        role: personnel.role ?? 'shelving',
        phone: personnel.phone ?? '',
        email: personnel.email ?? '',
        avatar: personnel.avatar ?? null,
        shift: personnel.shift ?? '',

        password: '',
        joinedAt: personnel.createdAt?.slice(0, 10) ?? todayValue(),
      }
    : { ...EMPTY, joinedAt: todayValue() }

export default function PersonnelDialog({
  open,
  personnel = null,
  onClose,
  onSubmit,

  desk = false,
}) {
  const editing = Boolean(personnel)
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)
  const photoInput = useRef(null)

  useEffect(() => {
    if (open) {
      const form = toForm(personnel)
      setValues(desk ? { ...form, role: 'librarian' } : form)
      setErrors({})
      setFormError(null)
    }
  }, [open, personnel, desk])

  const close = useCallback(() => {
    if (saving) return
    onClose()
  }, [onClose, saving])

  const ref = useDismiss(open, close)

  if (!open) return null

  const update = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }))
    setFormError(null)
  }

  async function handlePhotoPick(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const avatar = await readAvatar(file)
      setValues((current) => ({ ...current, avatar }))
      setFormError(null)
    } catch (error) {
      setFormError(error.message)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = {
      name: validateName(values.name),

      phone: validatePhone(values.phone),
      email: validateEmail(values.email),
      joinedAt: values.joinedAt ? null : 'Choose the joining date.',
      shift: desk && !values.shift ? 'Choose a shift.' : null,

      password: desk && values.password ? validatePassword(values.password) : null,
    }
    if (desk && values.password && !values.email.trim()) {
      nextErrors.email = 'An email is needed for them to sign in with.'
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    setSaving(true)
    try {
      await onSubmit({
        name: values.name,
        role: values.role,
        phone: values.phone,
        email: values.email,
        avatar: values.avatar,
        joinedAt: values.joinedAt,

        ...(desk && { shift: values.shift, password: values.password }),
      })
      onClose()
    } catch (error) {
      setFormError(error.message)
      if (error.field) setErrors((current) => ({ ...current, [error.field]: error.message }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 py-10 backdrop-blur-sm">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-personnel-title"
        className="animate-rise w-full max-w-lg rounded-xl border border-ink-100 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900"
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <div>
            <h2
              id="add-personnel-title"
              className="font-display text-lg text-ink-900 dark:text-white"
            >
              {editing
                ? `Edit ${personnel.name}`
                : desk
                  ? 'Add Library Assistant'
                  : 'Add personnel'}
            </h2>
            <p className="mt-0.5 text-xs text-ink-400">
              {editing
                ? 'Changes apply to the register immediately.'
                : 'Creates a register entry. Sign-in accounts are issued separately.'}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <form onSubmit={handleSubmit} noValidate className="space-y-5 px-5 py-5">
          {formError && <Alert>{formError}</Alert>}

          <div className="flex items-center gap-4">
            <div className="relative">
              {values.avatar ? (
                <img
                  src={values.avatar}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover ring-4 ring-ink-100 dark:ring-ink-800"
                />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-ink-900 font-display text-xl text-brass-200 ring-4 ring-ink-100 dark:bg-brass-600 dark:text-white dark:ring-ink-800">
                  {initials(values.name) || '—'}
                </span>
              )}
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                aria-label="Add profile photo"
                title="Add profile photo"
                className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brass-600 text-white shadow-md transition-colors hover:bg-brass-500 dark:border-ink-900"
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                  <path d="M13.6 2.9a1.6 1.6 0 012.3 0l1.2 1.2a1.6 1.6 0 010 2.3l-8.1 8.1-3.5.9a.8.8 0 01-1-1l.9-3.5 8.2-8zM12.5 5.2l2.3 2.3 1.2-1.2-2.3-2.3-1.2 1.2z" />
                </svg>
              </button>
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                onChange={handlePhotoPick}
                className="sr-only"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Profile photo</p>
              {values.avatar && (
                <button
                  type="button"
                  onClick={() => setValues((current) => ({ ...current, avatar: null }))}
                  className="mt-1.5 text-xs font-semibold text-red-600 underline-offset-4 hover:underline"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

          <TextField
            label="Full name"
            name="name"
            value={values.name}
            onChange={update('name')}
            error={errors.name}
            placeholder="Priya Sharma"
            autoFocus
            required
          />

          <div>
            <label
              htmlFor="personnel-role"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400"
            >
              Role
              <RequiredMark />
            </label>
            {desk ? (

              <p className="rounded-lg border border-brass-500 bg-brass-50 px-3.5 py-2.5 text-sm font-semibold text-brass-900 ring-4 ring-brass-500/12 dark:bg-brass-500/10 dark:text-brass-200">
                {ROLE_LABELS.librarian}
              </p>
            ) : (
              <select
                id="personnel-role"
                value={values.role}
                onChange={update('role')}
                className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-white"
              >
                {PERSONNEL_ROLES.map((key) => (
                  <option key={key} value={key}>
                    {ROLE_LABELS[key]}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label
              htmlFor="personnel-phone"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400"
            >
              Contact number
              <RequiredMark />
            </label>
            <div className="flex">
              <span className="inline-flex shrink-0 items-center rounded-l-lg border border-r-0 border-ink-200 bg-ink-50 px-3 text-[0.95rem] font-medium text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
                +91
              </span>
              <input
                id="personnel-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="98765 43210"
                value={values.phone}
                onChange={update('phone')}
                required
                aria-invalid={errors.phone ? 'true' : undefined}
                className={`w-full rounded-r-lg border bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm placeholder:text-ink-300 focus:outline-none focus:ring-4 dark:bg-ink-800 dark:text-white dark:placeholder:text-ink-500 ${
                  errors.phone
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                    : 'border-ink-200 hover:border-ink-300 focus:border-brass-500 focus:ring-brass-500/15 dark:border-ink-700'
                }`}
              />
            </div>
            {errors.phone && (
              <p role="alert" className="mt-1.5 text-sm text-red-600">
                {errors.phone}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="personnel-joined"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400"
            >
              Joined date
              <RequiredMark />
            </label>
            <input
              id="personnel-joined"
              type="date"
              value={values.joinedAt}
              onChange={update('joinedAt')}
              required
              aria-invalid={errors.joinedAt ? 'true' : undefined}
              aria-describedby="personnel-joined-hint"
              className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm focus:outline-none focus:ring-4 dark:bg-ink-800 dark:text-white ${
                errors.joinedAt
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                  : 'border-ink-200 focus:border-brass-500 focus:ring-brass-500/15 dark:border-ink-700'
              }`}
            />
            {errors.joinedAt ? (
              <p role="alert" className="mt-1.5 text-sm text-red-600">
                {errors.joinedAt}
              </p>
            ) : (
              <p id="personnel-joined-hint" className="mt-1.5 text-sm text-ink-400">
                Back-date it for someone who started before this system did.
              </p>
            )}
          </div>

          <TextField
            label="Email address"
            type="email"
            name="email"
            value={values.email}
            onChange={update('email')}
            error={errors.email}
            placeholder="priya@gmail.com"
            required
          />

          {desk && (
            <>
              <div>
                <label
                  htmlFor="personnel-shift"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400"
                >
                  Shift
                  <RequiredMark />
                </label>
                <select
                  id="personnel-shift"
                  value={values.shift}
                  onChange={update('shift')}
                  required
                  aria-invalid={errors.shift ? 'true' : undefined}
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm focus:outline-none focus:ring-4 dark:bg-ink-800 dark:text-white ${
                    errors.shift
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                      : 'border-ink-200 focus:border-brass-500 focus:ring-brass-500/15 dark:border-ink-700'
                  }`}
                >
                  <option value="" disabled>
                    Select a shift
                  </option>
                  {SHIFTS.map((shift) => (
                    <option key={shift} value={shift}>
                      {shift}
                    </option>
                  ))}
                </select>
                {errors.shift && (
                  <p role="alert" className="mt-1.5 text-sm text-red-600">
                    {errors.shift}
                  </p>
                )}
              </div>

              <PasswordField
                label={editing ? 'New password' : 'Password'}
                name="password"
                autoComplete="new-password"
                showMeter
                value={values.password}
                onChange={update('password')}
                error={errors.password}
                hint={
                  editing
                    ? 'Leave blank to keep their current password.'
                    : 'They sign in with the email above and this password. Leave blank for no login.'
                }
              />
            </>
          )}

          <div className="flex justify-end gap-3 border-t border-ink-100 pt-5 dark:border-ink-800">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 disabled:cursor-not-allowed dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500 disabled:cursor-not-allowed disabled:bg-brass-200"
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add personnel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
