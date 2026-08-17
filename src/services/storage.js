// Every read and write in the app goes through here, to MongoDB.

import { CLIENT_ID } from './live.js'

export class StorageError extends Error {
  constructor(message, cause) {
    super(message)
    this.name = 'StorageError'
    this.cause = cause
  }
}

const API = import.meta.env?.VITE_API_URL ?? '/api'

async function request(path, options) {
  let response
  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',

        'X-Client-Id': CLIENT_ID,
        ...(options?.headers ?? {}),
      },
    })
  } catch (error) {
    throw new StorageError(
      'Cannot reach the library database. Check the connection and try again.',
      error,
    )
  }

  if (!response.ok) {
    throw new StorageError(`The database rejected that request (${response.status}).`)
  }
  return response.status === 204 ? null : response.json()
}

const db = {
  read: (collection) => request(`/collections/${collection}`),
  insert: (collection, record) =>
    request(`/collections/${collection}`, { method: 'POST', body: JSON.stringify(record) }),
  patch: (collection, id, changes) =>
    request(`/collections/${collection}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    }),
  remove: (collection, id) =>
    request(`/collections/${collection}/${id}`, { method: 'DELETE' }),
  readValue: async (name) => (await request(`/values/${name}`))?.value ?? null,
  writeValue: (name, value) =>
    request(`/values/${name}`, { method: 'PUT', body: JSON.stringify({ value }) }),
}

let reachable = null
let probing = null

// Whether the database is reachable. Probed once and remembered.
export async function checkDatabase() {
  probing ??= fetch(`${API}/health`)
    .then((response) => response.ok)
    .catch(() => false)
    .then((ok) => {
      reachable = ok
      return ok
    })
  return probing
}

// Where the data is: MongoDB, or nowhere because it cannot be reached.
export const storageMode = () => (reachable === null ? null : reachable ? 'mongodb' : 'offline')

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Math.floor(performance.now() * 1000).toString(36)}`

// Read and write. Every part of the app goes through this.
export const storage = {
  list: (collection) => db.read(collection),

  async findOne(collection, predicate) {
    const rows = await db.read(collection)
    return rows.find(predicate) ?? null
  },

  insert: (collection, doc) =>
    db.insert(collection, { id: newId(), createdAt: new Date().toISOString(), ...doc }),

  update: (collection, id, patch) =>
    db.patch(collection, id, { ...patch, updatedAt: new Date().toISOString() }),

  remove: (collection, id) => db.remove(collection, id),

  getValue: (name) => db.readValue(name),

  setValue: (name, value) => db.writeValue(name, value),
}

// Clears the stale copies older versions kept in the browser.
export function purgeBrowserData() {
  if (typeof window === 'undefined' || !window.localStorage) return []

  const removed = []
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith('lms:')) {
      window.localStorage.removeItem(key)
      removed.push(key)
    }
  }

  if (removed.length) {
    console.info(`[storage] Cleared ${removed.length} stale browser copies; the database is the only store.`)
  }
  return removed
}

// Collection names used by more than one module.
export const COLLECTIONS = {
  users: 'users',
}
