// What the member has out right now.

import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatDate } from '../../lib/format.js'
import { useMyLibrary } from '../../hooks/useMyLibrary.js'
import { Empty, BorrowingCard, PageHead } from './MemberKit.jsx'

export default function MyBooks() {
  const { user } = useAuth()
  const { locale, system } = usePreferences()
  const my = useMyLibrary()

  if (my.loading) return <p className="py-20 text-center text-sm text-ink-400">Reading your account…</p>

  return (
    <div className="space-y-6">
      <PageHead
        title="Currently issued"
        subtitle={`${my.out.length} out · ${my.remaining} of ${my.limit} slots free`}
      />

      {my.out.length === 0 ? (
        <Empty
          title="You have nothing out"
          action={
            <Link
              to="/my/browse"
              className="inline-block rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500"
            >
              Browse the catalogue
            </Link>
          }
        >
          Books you borrow will appear here with their due dates.
        </Empty>
      ) : (
        <div className="space-y-3">
          {[...my.out]
            .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
            .map((borrowing) => (
              <BorrowingCard key={borrowing.id} borrowing={borrowing} />
            ))}
        </div>
      )}
    </div>
  )
}
