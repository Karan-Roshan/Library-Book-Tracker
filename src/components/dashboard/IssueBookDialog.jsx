// Issue a book without leaving the dashboard.

import { useCallback, useEffect, useMemo, useState } from 'react'
import TextField, { RequiredMark } from '../TextField.jsx'
import Alert from '../Alert.jsx'
import { useDismiss } from '../../hooks/useDismiss.js'
import { DEFAULT_RULES, dueDateFor, borrowDaysFor } from '../../lib/circulation.js'
import { getRules } from '../../services/circulation.js'

const dateValue = (date) => new Date(date).toISOString().slice(0, 10)

const LABEL =
  'mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400'
const READONLY =
  'w-full cursor-not-allowed rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-[0.95rem] text-ink-600 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-300'

export default function IssueBookDialog({ open, book, members, onClose, onIssue }) {
  const [memberId, setMemberId] = useState('')
  const [memberName, setMemberName] = useState('')
  const [issuedAt, setIssuedAt] = useState(dateValue(new Date()))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [rules, setRules] = useState(DEFAULT_RULES)

  useEffect(() => {
    if (open) getRules().then(setRules)
  }, [open])

  useEffect(() => {
    if (open) {
      setMemberId('')
      setMemberName('')
      setIssuedAt(dateValue(new Date()))
      setErrors({})
      setFormError(null)
    }
  }, [open, book])

  const close = useCallback(() => {
    if (!saving) onClose()
  }, [onClose, saving])

  const ref = useDismiss(open, close)
  const member = useMemo(
    () =>
      members.find((row) => row.membershipNumber.toLowerCase() === memberId.trim().toLowerCase()) ??
      null,
    [members, memberId],
  )
  const dueAt = useMemo(() => dueDateFor(member, rules, issuedAt), [member, rules, issuedAt])

  if (!open || !book) return null

  const setById = (value) => {
    setMemberId(value)
    const match = members.find(
      (row) => row.membershipNumber.toLowerCase() === value.trim().toLowerCase(),
    )
    if (match) setMemberName(match.name)
    setErrors((current) => ({ ...current, memberId: null }))
  }

  const setByName = (value) => {
    setMemberName(value)
    const match = members.find((row) => row.name.toLowerCase() === value.trim().toLowerCase())
    if (match) setMemberId(match.membershipNumber)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const next = {
      memberId: member ? null : 'No member with that ID.',
      issuedAt: issuedAt ? null : 'Choose the issue date.',
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    if (book.available <= 0) {
      setFormError('Every copy of this title is already out.')
      return
    }

    setSaving(true)
    try {
      await onIssue({ book, member, issuedAt: new Date(issuedAt).toISOString() })
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
          <div>
            <h2 className="font-display text-lg text-ink-900 dark:text-white">Issue book</h2>
            <p className="mt-0.5 text-xs text-ink-400">
              {book.available} of {book.copies} copies on the shelf
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

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Member ID"
              list="issue-member-ids"
              value={memberId}
              onChange={(event) => setById(event.target.value)}
              error={errors.memberId}
              placeholder="Athena-03.08.2026-001"
              autoFocus
              required
            />
            <TextField
              label="Member name"
              list="issue-member-names"
              value={memberName}
              onChange={(event) => setByName(event.target.value)}
              placeholder="Fills in from the ID"
            />
          </div>

          <datalist id="issue-member-ids">
            {members.slice(0, 200).map((member) => (
              <option key={member.id} value={member.membershipNumber}>
                {member.name}
              </option>
            ))}
          </datalist>
          <datalist id="issue-member-names">
            {members.slice(0, 200).map((member) => (
              <option key={member.id} value={member.name} />
            ))}
          </datalist>

          <fieldset className="rounded-lg border border-ink-100 p-4 dark:border-ink-800">
            <legend className="px-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
              The copy in hand
            </legend>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['Book ID', book.code],
                ['Book name', book.title],
                ['Author', book.author],
                ['Category', book.category],
                ['Shelf', book.shelf],
                ['Condition', book.condition],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-ink-400">{label}</dt>
                  <dd className="text-sm font-medium text-ink-800 dark:text-ink-100">{value}</dd>
                </div>
              ))}
            </dl>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="issue-date" className={LABEL}>
                Issue date
                <RequiredMark />
              </label>
              <input
                id="issue-date"
                type="date"
                value={issuedAt}
                onChange={(event) => setIssuedAt(event.target.value)}
                className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-white"
              />
              {errors.issuedAt && (
                <p role="alert" className="mt-1.5 text-sm text-red-600">
                  {errors.issuedAt}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="issue-due" className={LABEL}>
                Due date
              </label>

              <input
                id="issue-due"
                type="date"
                value={dateValue(dueAt)}
                readOnly
                tabIndex={-1}
                className={READONLY}
              />
              <p className="mt-1.5 text-sm text-ink-400">
                {member
                  ? `${borrowDaysFor(member, rules)} days from the issue date.`
                  : 'Set by the member’s type.'}
              </p>
            </div>
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
              disabled={saving || book.available <= 0}
              className="rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500 disabled:cursor-not-allowed disabled:bg-brass-200"
            >
              {saving ? 'Issuing…' : 'Issue book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
