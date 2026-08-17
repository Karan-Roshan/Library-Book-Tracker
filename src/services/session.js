// Who is signed in on this browser — a token, never library data.

const KEY = 'athenaeum:session'

const store = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

// Who is signed in on this browser, or null if nobody or expired.
export function readSession() {
  const local = store()
  if (!local) return null

  try {
    const raw = local.getItem(KEY)
    if (!raw) return null

    const session = JSON.parse(raw)
    if (!session?.userId || !session.expiresAt) return null

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      local.removeItem(KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

// Stores the session token — an id and an expiry, never library data.
export function writeSession(session) {
  const local = store()
  if (!local) return

  if (!session) {
    local.removeItem(KEY)
    return
  }
  local.setItem(
    KEY,
    JSON.stringify({
      userId: session.userId,
      role: session.role ?? null,
      expiresAt: session.expiresAt,
    }),
  )
}

// Signs this browser out.
export const clearSession = () => writeSession(null)
