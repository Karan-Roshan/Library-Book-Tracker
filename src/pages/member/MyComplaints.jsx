// Raise a complaint and follow what happened to it.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLive } from '../../hooks/useLive.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus.js'
import { formatDate } from '../../lib/format.js'
import {
  COMPLAINT_CATEGORIES,
  STATUS_BADGE,
  STATUS_MEANING,
  composeComplaints,
} from '../../lib/complaints.js'
import * as complaintsService from '../../services/complaints.js'
import { Card, Empty, PageHead, Tile } from './MemberKit.jsx'
import { Action, INPUT, LABEL, Pill, SELECT, SELECT_ARROW } from '../../components/circulation/Shared.jsx'

const EMPTY = { subject: '', details: '', category: COMPLAINT_CATEGORIES[0] }

export default function MyComplaints() {
  const { user } = useAuth()
  const { locale } = usePreferences()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    complaintsService.listComplaints().then((all) => {
      setRows(all)
      setLoading(false)
    })
  }, [])

  useEffect(refresh, [refresh])

  useLive(['complaints'], refresh)

  useRefreshOnFocus(refresh)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  const mine = useMemo(() => {
    const memberId = user?.memberId ?? user?.id
    return composeComplaints({
      complaints: rows.filter((row) => row.memberId === memberId),
      members: [],
      staff: [],
    })
  }, [rows, user])

  const counts = useMemo(
    () => ({
      open: mine.filter((row) => row.open).length,
      completed: mine.filter((row) => !row.open).length,
    }),
    [mine],
  )

  async function submit() {
    if (!form.subject.trim()) return setError('Give your complaint a subject.')
    if (!form.details.trim()) return setError('Please describe what happened.')

    setError(null)
    setBusy(true)
    try {
      await complaintsService.raiseComplaint({
        subject: form.subject,
        details: form.details,
        category: form.category,
        memberId: user.memberId ?? user.id,
        memberName: user.name,
        raisedByName: user.name,
        raisedByRole: 'member',
        contact: user.email ?? null,
      })
      setForm(EMPTY)
      refresh()
      setNotice('Your complaint has been logged. The library will look at it.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="py-20 text-center text-sm text-ink-400">Reading your complaints…</p>
  }

  return (
    <div className="space-y-6">
      <PageHead
        title="My complaints"
        subtitle="Tell the library what went wrong, and follow what happens next."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Tile label="Open" value={counts.open} />
        <Tile label="Completed" value={counts.completed} />
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          {notice}
        </div>
      )}

      <Card title="Raise a complaint">
        <div className="space-y-4">
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="my-complaint-category" className={LABEL}>
              What is it about
            </label>
            <select
              id="my-complaint-category"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              style={SELECT_ARROW}
              className={SELECT}
            >
              {COMPLAINT_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="my-complaint-subject" className={LABEL}>
              Subject
            </label>
            <input
              id="my-complaint-subject"
              value={form.subject}
              onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
              placeholder="In one line, what is wrong"
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="my-complaint-details" className={LABEL}>
              What happened
            </label>
            <textarea
              id="my-complaint-details"
              rows={5}
              value={form.details}
              onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))}
              placeholder="When it happened, and what you expected instead"
              className={INPUT}
            />
          </div>

          <div className="flex justify-end">
            <Action tone="gold" onClick={submit} disabled={busy}>
              {busy ? 'Sending…' : 'Send complaint'}
            </Action>
          </div>
        </div>
      </Card>

      <Card title="What you have raised" subtitle={`${mine.length} in total, newest first`}>
        {mine.length === 0 ? (
          <Empty>You have not raised any complaints.</Empty>
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {mine.map((row) => (
              <li key={row.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900 dark:text-white">{row.subject}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {row.ref} · {row.category} · raised {formatDate(row.raisedAt, locale)}
                    </p>
                  </div>
                  <Pill tone={STATUS_BADGE[row.status]}>{row.status}</Pill>
                </div>

                <p className="mt-2 whitespace-pre-wrap text-sm text-ink-600 dark:text-ink-300">
                  {row.details}
                </p>

                <p className="mt-2 text-xs text-ink-400">{STATUS_MEANING[row.status]}</p>

                {row.resolution && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/40 dark:bg-emerald-500/10">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
                      The library’s reply
                    </p>
                    <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-200">
                      {row.resolution}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
