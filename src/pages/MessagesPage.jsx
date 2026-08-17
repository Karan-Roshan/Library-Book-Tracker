// Notifications, read and written like a mail client.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLive } from '../hooks/useLive.js'
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx'
import Card from '../components/dashboard/Card.jsx'
import Logo from '../components/Logo.jsx'
import TextField, { RequiredMark } from '../components/TextField.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { library } from '../data/demoLibrary.js'
import { formatDate, formatTime } from '../lib/format.js'
import { ROLE_LABELS } from '../lib/permissions.js'
import {
  AUDIENCES,
  describeRecipients,
  draftsBy,
  inAudience,
  inboxFor,
  isUnread,
  sentBy,
} from '../lib/messages.js'
import { composeMembers } from '../lib/members.js'
import * as auth from '../services/auth.js'
import * as messagesService from '../services/messages.js'
import * as membersService from '../services/members.js'

const FOLDERS = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'sent', label: 'Sent' },
  { key: 'drafts', label: 'Drafts' },
]

const EMPTY = { subject: '', body: '', recipients: [] }

const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

const initialOf = (name) => String(name ?? '?').trim().charAt(0).toUpperCase() || '?'

const snippet = (body, length = 80) => {
  const text = String(body ?? '').replace(/\s+/g, ' ').trim()
  return text.length > length ? `${text.slice(0, length)}…` : text || 'No message body'
}

export default function MessagesPage() {
  const { user } = useAuth()
  const { locale } = usePreferences()

  const [messages, setMessages] = useState([])
  const [accounts, setAccounts] = useState([])
  const [added, setAdded] = useState([])
  const [overrides, setOverrides] = useState({})

  const { settings } = useSettings()
  const askFirst = settings.system.confirmDestructive
  const [folder, setFolder] = useState('inbox')
  const [openId, setOpenId] = useState(null)
  const [composing, setComposing] = useState(false)
  const [draftId, setDraftId] = useState(null)
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [audience, setAudience] = useState('all')
  const [pickerQuery, setPickerQuery] = useState('')
  const [notice, setNotice] = useState(null)

  const now = useMemo(() => new Date(), [])

  const refresh = useCallback(() => {
    Promise.all([
      messagesService.listMessages(),
      auth.listAccounts(),
      membersService.listAddedMembers(),
      membersService.listOverrides(),
    ]).then(([rows, staff, extraMembers, patches]) => {
      setMessages(rows)
      setAccounts(staff)
      setAdded(extraMembers)
      setOverrides(patches)
    })
  }, [])

  useEffect(refresh, [refresh])

  useLive(['messages'], refresh)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  const directory = useMemo(() => {
    const staff = accounts.map((account) => ({
      id: account.id,
      name: account.name,
      role: account.role,
      label: ROLE_LABELS[account.role] ?? account.role,
      kind: 'personnel',
    }))
    const members = composeMembers({ library, added, overrides, now }).map((member) => ({
      id: member.id,
      name: member.name,
      role: 'member',
      label: 'Member',
      kind: 'member',
    }))
    return [...staff, ...members]
  }, [accounts, added, overrides, now])

  const shown = useMemo(() => {
    const term = pickerQuery.trim().toLowerCase()
    return directory
      .filter((person) => inAudience(person, audience))
      .filter((person) => !term || person.name.toLowerCase().includes(term))
      .slice(0, 200)
  }, [directory, audience, pickerQuery])

  const listed = useMemo(() => {
    if (folder === 'sent') return sentBy(messages, user.id)
    if (folder === 'drafts') return draftsBy(messages, user.id)
    return inboxFor(messages, user.id)
  }, [messages, folder, user.id])

  const [deleting, setDeleting] = useState(null)

  const destroy = useCallback(
    async (message) => {
      await messagesService.deleteMessage(message.id)

      setOpenId((current) => (current === message.id ? null : current))
      await refresh()
      setNotice(`“${message.subject || '(no subject)'}” deleted.`)
    },
    [refresh],
  )

  const remove = useCallback(
    (message) => (askFirst ? setDeleting(message) : destroy(message)),
    [askFirst, destroy],
  )

  const unreadHere = useCallback(
    (message) => folder === 'inbox' && isUnread(message, user.id),
    [folder, user.id],
  )

  const open = listed.find((message) => message.id === openId) ?? null

  useEffect(() => {
    if (open && folder === 'inbox' && isUnread(open, user.id)) {
      messagesService.markRead(open.id, user.id).then(refresh)
    }
  }, [open, folder, user.id, refresh])

  const selected = values.recipients
  const isPicked = (person) => selected.some((entry) => entry.id === person.id)

  const togglePerson = (person) =>
    setValues((current) => ({
      ...current,
      recipients: isPicked(person)
        ? current.recipients.filter((entry) => entry.id !== person.id)
        : [...current.recipients, person],
    }))

  const addAllShown = () =>
    setValues((current) => {
      const existing = new Set(current.recipients.map((entry) => entry.id))
      return {
        ...current,
        recipients: [...current.recipients, ...shown.filter((person) => !existing.has(person.id))],
      }
    })

  function startCompose(draft = null) {
    setValues(
      draft
        ? { subject: draft.subject, body: draft.body, recipients: draft.recipients ?? [] }
        : EMPTY,
    )
    setDraftId(draft?.id ?? null)
    setErrors({})
    setComposing(true)
    setOpenId(null)
  }

  function validate() {
    const next = {
      recipients: values.recipients.length ? null : 'Choose at least one recipient.',
      subject: values.subject.trim() ? null : 'Give the message a subject.',
      body: values.body.trim() ? null : 'Write the message.',
    }
    setErrors(next)
    return !Object.values(next).some(Boolean)
  }

  async function handleSend() {
    if (!validate()) return
    await messagesService.sendMessage(values, user, draftId)
    setComposing(false)
    setValues(EMPTY)
    setDraftId(null)
    setFolder('sent')
    setNotice(`Message sent to ${values.recipients.length} recipient${values.recipients.length === 1 ? '' : 's'}.`)
    refresh()
  }

  async function handleDraft() {
    if (!values.subject.trim()) {
      setErrors({ subject: 'Give the message a subject to save it.' })
      return
    }
    await messagesService.saveDraft(values, user, draftId)
    setComposing(false)
    setValues(EMPTY)
    setDraftId(null)
    setFolder('drafts')
    setNotice('Draft saved.')
    refresh()
  }

  const unread = inboxFor(messages, user.id).filter((message) => isUnread(message, user.id)).length

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role="status"
          className="animate-rise fixed left-1/2 top-20 z-50 w-[min(28rem,90vw)] -translate-x-1/2 lg:left-[calc(50%+8rem)]"
        >
          <div className="rounded-lg border border-brass-200 bg-brass-50 px-4 py-3 text-sm text-brass-900 shadow-lg dark:border-brass-500/30 dark:bg-ink-800 dark:text-brass-200">
            {notice}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="mt-2 font-display text-2xl text-ink-900 dark:text-white">Notifications</h1>
        </div>

        <button
          type="button"
          onClick={() => startCompose()}
          className="inline-flex items-center gap-2 rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brass-500"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Send message
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">

        <Card padded={false}>
          <div className="flex border-b border-ink-100 dark:border-ink-800">
            {FOLDERS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => {
                  setFolder(entry.key)
                  setOpenId(null)
                }}
                className={`flex-1 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                  folder === entry.key
                    ? 'border-brass-500 text-ink-900 dark:text-white'
                    : 'border-transparent text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'
                }`}
              >
                {entry.label}
                {entry.key === 'inbox' && unread > 0 && (
                  <span className="ml-1.5 rounded-full bg-brass-600 px-1.5 text-xs font-bold text-white">
                    {unread}
                  </span>
                )}
              </button>
            ))}
          </div>

          <ul className="max-h-[32rem] divide-y divide-ink-50 overflow-y-auto dark:divide-ink-800">
            {listed.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-ink-400">Nothing here yet.</li>
            )}
            {listed.map((message) => (
              <li key={message.id} className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    if (message.status === 'draft') startCompose(message)
                    else {
                      setOpenId(message.id)
                      setComposing(false)
                    }
                  }}
                  className={`flex w-full items-start gap-2 py-3 pl-1.5 pr-11 text-left transition-colors ${
                    openId === message.id
                      ? 'bg-brass-50 dark:bg-ink-800'
                      : unreadHere(message)
                        ? 'bg-white hover:bg-brass-50/60 dark:bg-ink-900 dark:hover:bg-ink-800'
                        : 'bg-ink-50/60 hover:bg-ink-50 dark:bg-ink-950/40 dark:hover:bg-ink-800'
                  }`}
                >

                  <span
                    aria-hidden="true"
                    className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
                      unreadHere(message) ? 'bg-brass-500' : 'bg-transparent'
                    }`}
                  />

                  <span
                    title={
                      folder === 'inbox'
                        ? message.fromName
                        : describeRecipients(message.recipients)
                    }
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      unreadHere(message)
                        ? 'bg-brass-600 text-white'
                        : 'bg-ink-200 text-ink-600 dark:bg-ink-700 dark:text-ink-300'
                    }`}
                  >
                    {initialOf(
                      folder === 'inbox' ? message.fromName : message.recipients?.[0]?.name,
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">

                      <span
                        className={`truncate text-sm ${
                          unreadHere(message)
                            ? 'font-bold text-ink-900 dark:text-white'
                            : 'font-medium text-ink-700 dark:text-ink-200'
                        }`}
                      >
                        {message.subject || '(no subject)'}
                      </span>
                      <span
                        className={`shrink-0 text-xs ${
                          unreadHere(message)
                            ? 'font-semibold text-ink-700 dark:text-ink-200'
                            : 'text-ink-400'
                        }`}
                      >
                        {message.sentAt ? formatDate(message.sentAt, locale) : 'Draft'}
                      </span>
                    </span>

                    <span className="mt-0.5 block truncate text-xs text-ink-400">
                      {snippet(message.body)}
                    </span>
                  </span>

                </button>

                <button
                  type="button"
                  onClick={() => remove(message)}
                  aria-label={`Delete ${message.subject || 'message'}`}
                  title="Delete"
                  className="absolute right-2.5 top-4 rounded-lg p-1.5 text-ink-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                    <path
                      d="M4 6h12M8.5 6V4.75A.75.75 0 0 1 9.25 4h1.5a.75.75 0 0 1 .75.75V6M6 6l.6 9a1 1 0 0 0 1 .95h4.8a1 1 0 0 0 1-.95L14 6"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {composing ? (
          <Card title={draftId ? 'Edit draft' : 'New message'}>
            <div className="space-y-5">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
                  Recipients
                  <RequiredMark />
                </p>

                {selected.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {selected.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => togglePerson(person)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-brass-300 bg-brass-50 px-2.5 py-1 text-xs font-semibold text-brass-900 dark:border-brass-500/40 dark:bg-brass-500/10 dark:text-brass-200"
                      >
                        {person.name}
                        <span aria-hidden="true">×</span>
                        <span className="sr-only">Remove {person.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="rounded-lg border border-ink-200 dark:border-ink-700">
                  <div className="flex flex-wrap gap-1 border-b border-ink-100 p-2 dark:border-ink-800">
                    {AUDIENCES.map((entry) => (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => setAudience(entry.key)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                          audience === entry.key
                            ? 'bg-ink-900 text-white dark:bg-brass-600'
                            : 'text-ink-500 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800'
                        }`}
                      >
                        {entry.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 border-b border-ink-100 p-2 dark:border-ink-800">
                    <input
                      type="search"
                      value={pickerQuery}
                      onChange={(event) => setPickerQuery(event.target.value)}
                      placeholder="Search by name..."
                      aria-label="Search recipients"
                      className="h-8 flex-1 rounded-lg border border-ink-200 bg-white px-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brass-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={addAllShown}
                      className="whitespace-nowrap rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
                    >
                      Add all {shown.length}
                    </button>
                  </div>

                  <ul className="max-h-52 overflow-y-auto p-1">
                    {shown.map((person) => (
                      <li key={person.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-ink-50 dark:hover:bg-ink-800">
                          <input
                            type="checkbox"
                            checked={isPicked(person)}
                            onChange={() => togglePerson(person)}
                            className="h-4 w-4 rounded border-ink-300 accent-brass-600"
                          />
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 text-[0.65rem] font-semibold text-brass-200 dark:bg-brass-600 dark:text-white">
                            {initials(person.name)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-ink-800 dark:text-ink-100">
                            {person.name}
                          </span>
                          <span className="shrink-0 text-xs text-ink-400">{person.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
                {errors.recipients && (
                  <p role="alert" className="mt-1.5 text-sm text-red-600">
                    {errors.recipients}
                  </p>
                )}
              </div>

              <TextField
                label="Subject"
                value={values.subject}
                onChange={(event) =>
                  setValues((current) => ({ ...current, subject: event.target.value }))
                }
                error={errors.subject}
                placeholder="Library closed on Monday"
                required
              />

              <div>
                <label
                  htmlFor="message-body"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400"
                >
                  Message
                  <RequiredMark />
                </label>
                <textarea
                  id="message-body"
                  rows={8}
                  value={values.body}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, body: event.target.value }))
                  }
                  placeholder="Write your message..."
                  className="w-full resize-y rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm placeholder:text-ink-300 focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-white"
                />
                {errors.body && (
                  <p role="alert" className="mt-1.5 text-sm text-red-600">
                    {errors.body}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-ink-100 pt-5 dark:border-ink-800">
                <button
                  type="button"
                  onClick={() => {
                    setComposing(false)
                    setValues(EMPTY)
                    setDraftId(null)
                  }}
                  className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDraft}
                  className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  className="rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500"
                >
                  Send
                </button>
              </div>
            </div>
          </Card>
        ) : open ? (
          <Card>
            <div className="space-y-4">

              <h2 className="font-display text-xl font-bold text-ink-900 dark:text-white">
                {open.subject || '(no subject)'}
              </h2>

              <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 pb-4 dark:border-ink-800">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brass-600 text-sm font-bold text-white"
                >
                  {initialOf(open.fromName)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
                    {open.fromName}
                  </p>

                  <p className="truncate text-xs text-ink-400">
                    to {describeRecipients(open.recipients)}
                  </p>
                </div>

                <p className="shrink-0 text-sm text-ink-400">
                  {open.sentAt
                    ? `${formatDate(open.sentAt, locale)} · ${formatTime(open.sentAt, locale)}`
                    : 'Draft'}
                </p>
              </div>

              <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-ink-700 dark:text-ink-200">
                {open.body}
              </p>

              <details className="border-t border-ink-100 pt-4 dark:border-ink-800">
                <summary className="cursor-pointer text-xs text-ink-400">
                  All {open.recipients?.length ?? 0} recipients
                </summary>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {open.recipients?.map((person) => (
                    <li
                      key={person.id}
                      className="rounded-full border border-ink-200 px-2.5 py-0.5 text-xs text-ink-600 dark:border-ink-700 dark:text-ink-300"
                    >
                      {person.name}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </Card>
        ) : (
          <Card>

            <div className="flex min-h-[16rem] flex-col items-center justify-center text-center">
              <Logo className="h-10 w-10 text-brass-500/70" />

              <p className="mt-3 font-display text-base text-ink-500 dark:text-ink-300">
                Athenaeum Messages
              </p>

              <p className="mt-1 text-xs text-ink-400">
                {listed.length === 0
                  ? 'Nothing in this folder yet.'
                  : 'Select a message to read it.'}
              </p>
            </div>
          </Card>
        )}
      </div>

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-message-title"
            className="animate-rise w-full max-w-md rounded-xl border border-ink-100 bg-white p-5 shadow-xl dark:border-ink-800 dark:bg-ink-900"
          >
            <h2
              id="delete-message-title"
              className="font-display text-lg text-ink-900 dark:text-white"
            >
              Delete “{deleting.subject || '(no subject)'}”?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">

              It is removed for everyone it was sent to, not just from your own
              list. There is no trash folder, so this cannot be undone.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const message = deleting
                  setDeleting(null)
                  await destroy(message)
                }}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
