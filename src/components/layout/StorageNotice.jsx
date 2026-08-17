// Says so, loudly, when the database cannot be reached.

import { useEffect, useState } from 'react'
import { checkDatabase } from '../../services/storage.js'

export default function StorageNotice() {
  const [reachable, setReachable] = useState(null)

  useEffect(() => {
    let active = true
    checkDatabase().then((ok) => active && setReachable(ok))
    return () => {
      active = false
    }
  }, [])

  if (reachable !== false) return null

  return (
    <div
      role="alert"
      className="no-print border-b border-red-300 bg-red-100 px-4 py-2.5 text-center text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200"
    >
      <strong>The library database cannot be reached.</strong> Nothing can be read or saved until
      the connection is restored — do not record issues or returns on paper expecting them to
      appear here later.
    </div>
  )
}
