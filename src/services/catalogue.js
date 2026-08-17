// Loads the catalogue from the database, or generates one if there is none.

import { storage } from './storage.js'
import { replaceLibrary } from '../data/demoLibrary.js'

const PARTS = [
  ['books', 'books'],
  ['copies', 'bookCopies'],
  ['locations', 'locations'],
  ['members', 'members'],
  ['borrowings', 'borrowings'],
  ['reservations', 'holds'],
]

// Whether a catalogue has been saved to the database yet.
export async function isPersisted() {
  try {
    const books = await storage.list('books')
    return books.length > 0
  } catch {
    return false
  }
}

// Loads the catalogue, or generates one the first time.
export async function loadLibrary() {
  try {
    const rows = await Promise.all(PARTS.map(([, collection]) => storage.list(collection)))
    const next = Object.fromEntries(PARTS.map(([key], index) => [key, rows[index]]))

    if (!next.books?.length || !next.members?.length) {
      return { source: 'generated', reason: 'nothing stored yet' }
    }

    const loaded = replaceLibrary(next, 'mongodb')
    return {
      source: 'mongodb',

      library: loaded,
      counts: Object.fromEntries(PARTS.map(([key], index) => [key, rows[index].length])),
    }
  } catch (error) {
    return { source: 'generated', reason: error.message }
  }
}
