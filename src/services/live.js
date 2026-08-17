// One connection to the server, telling every open screen what changed.

const API = import.meta.env?.VITE_API_URL ?? '/api'

// This tab's own name, so it can ignore the echo of its own writes.
export const CLIENT_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `c_${Math.random().toString(36).slice(2)}`

const subscribers = new Map()

let source = null
let connected = false

function deliver(event) {
  let payload
  try {
    payload = JSON.parse(event.data)
  } catch {
    return
  }

  if (payload.origin && payload.origin === CLIENT_ID) return

  for (const handler of subscribers.get(payload.collection) ?? []) {
    handler(payload)
  }

  for (const handler of subscribers.get('*') ?? []) {
    handler(payload)
  }
}

function connect() {
  if (source || typeof window === 'undefined' || !('EventSource' in window)) return

  source = new EventSource(`${API}/events`)
  source.onmessage = deliver
  source.onopen = () => {
    connected = true
  }
  source.onerror = () => {
    connected = false
  }
}

// Whether the update stream is connected.
export const isLive = () => connected

// Calls back whenever one of the named collections changes.
export function subscribe(collections, handler) {
  connect()

  const names = Array.isArray(collections) ? collections : [collections]
  for (const name of names) {
    if (!subscribers.has(name)) subscribers.set(name, new Set())
    subscribers.get(name).add(handler)
  }

  return () => {
    for (const name of names) {
      const set = subscribers.get(name)
      if (!set) continue
      set.delete(handler)
      if (set.size === 0) subscribers.delete(name)
    }
  }
}
