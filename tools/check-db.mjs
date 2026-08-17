// Proves a database connection works before you trust data to it.

import { MongoClient } from 'mongodb'

const URI = process.argv[2] ?? process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017'
const DB = process.env.MONGODB_DB ?? 'library_management_system'

const safe = (uri) => uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:••••@')

const COLLECTIONS = [
  'users', 'manualFines', 'addedMembers', 'messages', 'addedBooks', 'issuedLoans',
  'repairs', 'activity', 'reservations', 'lostReports', 'settingsHistory', 'backups',
  'memberLogins', 'invitations', 'outbox', 'books', 'bookCopies', 'locations',
  'members', 'loans', 'holds',
]

const green = (s) => `\x1b[32m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

console.log(`\nTarget   ${safe(URI)}`)
console.log(`Database ${DB}\n`)

const hosted = URI.startsWith('mongodb+srv://') || !/127\.0\.0\.1|localhost/.test(URI)
const client = new MongoClient(URI, { serverSelectionTimeoutMS: 8000 })

try {
  const started = Date.now()
  await client.connect()
  await client.db(DB).command({ ping: 1 })
  console.log(`${green('✓')} connected            ${dim(`${Date.now() - started}ms`)}`)
} catch (error) {
  console.log(`${red('✗')} could not connect`)
  console.log(`\n  ${error.message}\n`)

  if (/authentication failed/i.test(error.message)) {
    console.log('  The user or password is wrong. In Atlas: Database Access → Edit →')
    console.log('  set a new password. Special characters must be percent-encoded:')
    console.log('  @ becomes %40, # becomes %23, / becomes %2F.\n')
  } else if (/ETIMEOUT|ENOTFOUND|querySrv|server selection/i.test(error.message)) {
    console.log('  The cluster could not be reached. Usually the IP allowlist:')
    console.log('  Atlas → Network Access → Add IP Address → Add Current IP Address.')
    console.log('  A cluster that has been idle may also still be waking up.\n')
  } else if (/ECONNREFUSED/.test(error.message)) {
    console.log('  Nothing is listening there. For a local database:')
    console.log('  brew services start mongodb-community\n')
  }
  await client.close()
  process.exit(1)
}

const db = client.db(DB)

try {
  const probe = db.collection('__athenaeum_probe')
  const id = `probe-${process.pid}`
  await probe.insertOne({ id, at: new Date().toISOString() })
  const read = await probe.findOne({ id })
  await probe.deleteOne({ id })
  await probe.drop().catch(() => {})
  console.log(`${read ? green('✓') : red('✗')} write and read back`)
} catch (error) {
  console.log(`${red('✗')} cannot write — the user may be read-only`)
  console.log(`  ${error.message}`)
  await client.close()
  process.exit(1)
}

const counts = await Promise.all(
  COLLECTIONS.map(async (name) => [name, await db.collection(name).countDocuments()]),
)
const total = counts.reduce((sum, [, n]) => sum + n, 0)
const filled = counts.filter(([, n]) => n > 0)

console.log(`\n${total.toLocaleString()} documents across ${filled.length} of ${COLLECTIONS.length} collections\n`)
for (const [name, n] of filled.sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name.padEnd(16)} ${String(n).padStart(6)}`)
}

if (total === 0) {
  console.log(dim('  (empty)'))
  console.log(`\n${hosted ? 'This cluster holds no library yet. To copy one up from this laptop:' : 'This database is empty. Seed it, or copy a library in:'}`)
  console.log('  python3 tools/migrate.py --to "<this connection string>"\n')
} else {
  console.log('')
}

await client.close()
