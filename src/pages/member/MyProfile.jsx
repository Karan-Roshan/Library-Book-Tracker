// The member's own details and membership dates.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatDate } from '../../lib/format.js'
import { ageFrom } from '../../lib/members.js'
import * as membersService from '../../services/members.js'
import { useMyLibrary } from '../../hooks/useMyLibrary.js'
import { INPUT, LABEL } from '../../components/circulation/Shared.jsx'
import { Card, PageHead, Tile } from './MemberKit.jsx'

export default function MyProfile() {
  const { user } = useAuth()
  const { locale, system } = usePreferences()
  const my = useMyLibrary()

  const [draft, setDraft] = useState({ phone: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (my.me) setDraft({ phone: my.me.phone ?? '', address: my.me.address ?? '' })
  }, [my.me])

  if (my.loading) return <p className="py-20 text-center text-sm text-ink-400">Reading your account…</p>
  if (!my.me) return <p className="py-20 text-center text-sm text-ink-400">Membership record not found.</p>

  const expired = my.me.expiresAt && new Date(my.me.expiresAt) < my.now
  const dirty = draft.phone !== (my.me.phone ?? '') || draft.address !== (my.me.address ?? '')

  async function save() {
    setSaving(true)
    try {
      await membersService.patchMember(
        my.me.id,
        { phone: draft.phone, address: draft.address },
        { name: my.me.name, memberId: my.me.membershipNumber },
      )
      await my.refresh()
      setNotice('Your contact details have been updated.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHead title="Profile & membership" subtitle="Your library account." />

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
          {notice}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Membership"
          value={expired ? 'Expired' : my.me.status}
          tone={expired ? 'bad' : my.me.status === 'Active' ? 'good' : 'warn'}
        />
        <Tile label="Borrowing limit" value={my.limit} hint={`${my.me.type} member`} />
        <Tile label="Currently borrowed" value={my.out.length} />
        <Tile
          label="Remaining capacity"
          value={my.remaining}
          tone={my.remaining === 0 ? 'warn' : 'good'}
        />
      </div>

      <Card title="Your details" subtitle="Identity is set by the library and cannot be edited here.">
        <dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Full name', my.me.name],
            ['Member ID', my.me.membershipNumber],
            ['Email', my.me.email],
            ['Member type', my.me.type],
            ['Age', ageFrom(my.me.dob, my.now) ?? '—'],
            ['Account status', my.me.status],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink-400">{label}</dt>
              <dd className="text-sm font-medium text-ink-800 dark:text-ink-100">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card
        title="Contact details"
        subtitle="Yours to keep up to date — the library uses these to reach you."
      >
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label htmlFor="my-phone" className={LABEL}>
              Phone
            </label>
            <input
              id="my-phone"
              value={draft.phone}
              onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="my-address" className={LABEL}>
              Address
            </label>
            <input
              id="my-address"
              value={draft.address}
              onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
              className={INPUT}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-ink-100 px-5 py-4 dark:border-ink-800">
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500 disabled:cursor-not-allowed disabled:bg-brass-200"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
        <p className="border-t border-ink-100 px-5 py-3 text-xs text-ink-400 dark:border-ink-800">
          To change your name or email address, ask at the library desk — those identify your
          membership.
        </p>
      </Card>

      <Card title="Membership">
        <dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Member since', formatDate(my.me.joinedAt, locale, system)],
            ['Card issued', my.me.idIssuedAt ? formatDate(my.me.idIssuedAt, locale, system) : '—'],
            ['Last renewed', my.me.renewedAt ? formatDate(my.me.renewedAt, locale, system) : 'Never'],
            [
              'Valid until',
              my.me.expiresAt ? formatDate(my.me.expiresAt, locale, system) : '—',
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink-400">{label}</dt>
              <dd className="text-sm font-medium text-ink-800 dark:text-ink-100">{value}</dd>
            </div>
          ))}
        </dl>
        {expired && (
          <p className="border-t border-ink-100 px-5 py-3 text-sm text-red-600 dark:border-ink-800 dark:text-red-400">
            Your membership has lapsed. Bring your card to the desk to renew it — you cannot borrow
            until it is renewed, though you can still{' '}
            <Link to="/my/browse" className="font-semibold underline">
              browse the catalogue
            </Link>
            .
          </p>
        )}
      </Card>
    </div>
  )
}
