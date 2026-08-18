// The form for adding or editing a member.

import { useCallback, useEffect, useRef, useState } from 'react'
import TextField, { RequiredMark } from '../TextField.jsx'
import Alert from '../Alert.jsx'
import { useDismiss } from '../../hooks/useDismiss.js'
import { readAvatar } from '../../lib/image.js'
import { GENDERS, renewalExpiry } from '../../lib/members.js'
import { memberId } from '../../lib/ids.js'
import { validateEmail, validateName, validatePhone } from '../../lib/validation.js'

const todayValue = () => new Date().toISOString().slice(0, 10)

const expiryFor = (value) => renewalExpiry(value).toISOString().slice(0, 10)

const blank = () => ({
  name: '',
  email: '',
  phone: '',
  address: '',
  dob: '',
  gender: '',
  status: 'Active',
  joinedAt: todayValue(),
  expiresAt: expiryFor(todayValue()),
  idIssuedAt: '',
  avatar: null,
})

const toForm = (member) =>
  member
    ? {
        name: member.name ?? '',
        email: member.email ?? '',
        phone: member.phone ?? '',
        address: member.address ?? '',
        dob: member.dob?.slice(0, 10) ?? '',
        gender: member.gender ?? '',
        status: member.status ?? 'Active',
        joinedAt: member.joinedAt?.slice(0, 10) ?? todayValue(),
        expiresAt: member.expiresAt?.slice(0, 10) ?? expiryFor(todayValue()),
        idIssuedAt: member.idIssuedAt?.slice(0, 10) ?? '',
        avatar: member.avatar ?? null,
      }
    : blank()

// The card cannot be handed over before they joined, nor on a day yet to come.
const issueDateProblem = (issued, joined) => {
  if (!issued) return null
  if (issued > todayValue()) return 'The card cannot be issued in the future.'
  if (joined && issued < joined) return 'The card cannot be issued before the joining date.'
  return null
}

const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

const labelClass =
  'mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400'
const inputClass =
  'w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-white'

export default function MemberDialog({ open, member = null, onClose, onSubmit }) {
  const editing = Boolean(member)
  const [values, setValues] = useState(blank)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)
  const photoInput = useRef(null)

  useEffect(() => {
    if (open) {
      setValues(toForm(member))
      setErrors({})
      setFormError(null)
    }
  }, [open, member])

  const close = useCallback(() => {
    if (!saving) onClose()
  }, [onClose, saving])

  const ref = useDismiss(open, close)

  if (!open) return null

  const update = (field) => (event) => {
    const { value } = event.target
    setValues((current) => ({
      ...current,
      [field]: value,

      ...(field === 'joinedAt' && value ? { expiresAt: expiryFor(value) } : {}),
    }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }))
    setFormError(null)
  }

  async function handlePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const avatar = await readAvatar(file)
      setValues((current) => ({ ...current, avatar }))
    } catch (error) {
      setFormError(error.message)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = {
      name: validateName(values.name),
      email: validateEmail(values.email),
      phone: validatePhone(values.phone),
      joinedAt: values.joinedAt ? null : 'Choose the joining date.',
      idIssuedAt: issueDateProblem(values.idIssuedAt, values.joinedAt),
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    setSaving(true)
    try {
      const joined = new Date(values.joinedAt)
      await onSubmit({
        ...values,
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.replace(/\D/g, ''),
        joinedAt: joined.toISOString(),
        expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
        dob: values.dob ? new Date(values.dob).toISOString() : null,
        idIssuedAt: values.idIssuedAt ? new Date(values.idIssuedAt).toISOString() : null,

        gender: values.gender || null,

        ...(editing ? {} : { membershipNumber: memberId(Date.now() % 1000, joined) }),
      })
      onClose()
    } catch (error) {
      setFormError(error.message)
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
        className="animate-rise w-full max-w-2xl rounded-xl border border-ink-100 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900"
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <h2 className="font-display text-lg text-ink-900 dark:text-white">
            {editing ? `Edit ${member.name}` : 'Register a member'}
          </h2>
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
                aria-label="Add member photo"
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
                onChange={handlePhoto}
                className="sr-only"
              />
            </div>
            <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Member photo</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Full name"
              value={values.name}
              onChange={update('name')}
              error={errors.name}
              placeholder="Rahul Sharma"
              required
            />

            <TextField
              label="Email address"
              type="email"
              value={values.email}
              onChange={update('email')}
              error={errors.email}
              placeholder="rahul@gmail.com"
              required
            />

            <div>
              <label htmlFor="member-phone" className={labelClass}>
                Phone number
                <RequiredMark />
              </label>
              <div className="flex">
                <span className="inline-flex shrink-0 items-center rounded-l-lg border border-r-0 border-ink-200 bg-ink-50 px-3 text-[0.95rem] font-medium text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
                  +91
                </span>
                <input
                  id="member-phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={values.phone}
                  onChange={update('phone')}
                  required
                  className={`w-full rounded-r-lg border bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm focus:outline-none focus:ring-4 dark:bg-ink-800 dark:text-white ${
                    errors.phone
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                      : 'border-ink-200 focus:border-brass-500 focus:ring-brass-500/15 dark:border-ink-700'
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
              <label htmlFor="member-joined" className={labelClass}>
                Joined date
                <RequiredMark />
              </label>
              <input
                id="member-joined"
                type="date"
                value={values.joinedAt}
                onChange={update('joinedAt')}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="member-expires" className={labelClass}>
                Expiry date
              </label>

              <input
                id="member-expires"
                type="date"
                value={values.expiresAt}
                readOnly
                tabIndex={-1}
                aria-describedby="member-expires-hint"
                className="w-full cursor-not-allowed rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-[0.95rem] text-ink-500 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-400"
              />
              <p id="member-expires-hint" className="mt-1.5 text-sm text-ink-400">
                Six months from the joining date.
              </p>
            </div>

            <div>
              <label htmlFor="member-id-issued" className={labelClass}>
                ID issue date
              </label>
              <input
                id="member-id-issued"
                type="date"
                max={todayValue()}
                min={values.joinedAt || undefined}
                value={values.idIssuedAt}
                onChange={update('idIssuedAt')}
                aria-invalid={errors.idIssuedAt ? 'true' : undefined}
                aria-describedby={errors.idIssuedAt ? 'member-id-issued-error' : 'member-id-issued-hint'}
                className={inputClass}
              />
              {errors.idIssuedAt ? (
                <p id="member-id-issued-error" role="alert" className="mt-1.5 text-sm text-red-600">
                  {errors.idIssuedAt}
                </p>
              ) : (
                <p id="member-id-issued-hint" className="mt-1.5 text-sm text-ink-400">
                  The day the membership card was handed over. Renewing sets this again.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="member-dob" className={labelClass}>
                Date of birth
              </label>
              <input
                id="member-dob"
                type="date"
                value={values.dob}
                onChange={update('dob')}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="member-gender" className={labelClass}>
                Gender
              </label>
              <select
                id="member-gender"
                value={values.gender}
                onChange={update('gender')}
                className={inputClass}
              >
                <option value="">Not recorded</option>
                {GENDERS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="member-status" className={labelClass}>
                Status
              </label>
              <select
                id="member-status"
                value={values.status}
                onChange={update('status')}
                className={inputClass}
              >
                {['Active', 'Inactive'].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="member-address" className={labelClass}>
              Address
            </label>
            <textarea
              id="member-address"
              rows={2}
              value={values.address}
              onChange={update('address')}
              placeholder="House / street, area, city, PIN code"
              className={`${inputClass} resize-y`}
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-ink-100 pt-5 dark:border-ink-800">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500 disabled:bg-brass-200"
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Register member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
