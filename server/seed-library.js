// Writes the generated catalogue into MongoDB, once, to start a library off.

import { MongoClient } from 'mongodb'
import { library } from '../src/data/demoLibrary.js'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017'
const DB_NAME = process.env.MONGODB_DB ?? 'library_management_system'
const force = process.argv.includes('--force')

const PARTS = [
  ['books', library.books],
  ['bookCopies', library.copies],
  ['locations', library.locations],
  ['members', library.members],
  ['borrowings', library.borrowings],
  ['holds', library.reservations],
]

const client = new MongoClient(MONGODB_URI)
await client.connect()
const db = client.db(DB_NAME)

const existing = await db.collection('books').countDocuments()
if (existing > 0 && !force) {
  console.log(
    `The catalogue is already stored (${existing} books). Nothing written.\n` +
      `Pass --force to replace it — this discards any edits made since.`,
  )
  await client.close()
  process.exit(0)
}

console.log(`Writing the catalogue to ${MONGODB_URI}/${DB_NAME}`)

for (const [name, rows] of PARTS) {
  const collection = db.collection(name)
  await collection.deleteMany({})
  if (rows.length) {
    await collection.insertMany(rows.map(({ _id, ...row }) => ({ ...row })))
  }

  await collection.createIndex({ id: 1 }, { unique: true }).catch(() => {})
  console.log(`  ${name.padEnd(12)} ${String(rows.length).padStart(5)}`)
}

await db.collection('bookCopies').createIndex({ bookId: 1 })
await db.collection('bookCopies').createIndex({ copyId: 1 })
await db.collection('borrowings').createIndex({ memberId: 1 })
await db.collection('borrowings').createIndex({ bookId: 1 })
await db.collection('borrowings').createIndex({ copyId: 1 })
await db.collection('borrowings').createIndex({ returnedAt: 1 })
await db.collection('holds').createIndex({ bookId: 1 })
await db.collection('members').createIndex({ membershipNumber: 1 })

const total = PARTS.reduce((sum, [, rows]) => sum + rows.length, 0)
console.log(`\n${total} records stored. The catalogue is now durable.`)
console.log('Reload the app — it will read from MongoDB instead of generating.')

await client.close()
