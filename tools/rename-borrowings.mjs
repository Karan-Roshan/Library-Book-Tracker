// One-off: carried stored data across the loan to borrowing rename.

import { MongoClient } from 'mongodb'

const URI = process.argv.find((a) => a.startsWith('mongodb')) ?? process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? 'library_management_system'
const APPLY = process.argv.includes('--apply')

const safe = (uri) => uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:••••@')
const green = (s) => `\x1b[32m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

console.log(`\n${APPLY ? 'Applying to' : 'Dry run against'}  ${safe(URI)}`)
console.log(`Database ${DB}\n`)

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 10000 })
await client.connect()
const db = client.db(DB)

const names = new Set((await db.listCollections().toArray()).map((c) => c.name))

for (const [from, to] of [['loans', 'borrowings'], ['issuedLoans', 'issuedBorrowings']]) {
  if (!names.has(from)) {
    console.log(`${dim('–')} ${from} — already gone`)
    continue
  }

  const source = await db.collection(from).countDocuments()
  const target = names.has(to) ? await db.collection(to).countDocuments() : 0

  if (source === 0) {
    console.log(`${dim('–')} ${from} — empty, dropping`)
    if (APPLY) await db.collection(from).drop().catch(() => {})
    continue
  }

  if (target > 0) {
    console.log(`${dim('–')} ${to} already holds ${target} — leaving both alone`)
    continue
  }

  console.log(`${green('→')} ${from} → ${to}  (${source} records)`)
  if (APPLY) {
    const rows = await db.collection(from).find({}, { projection: { _id: 0 } }).toArray()
    await db.collection(to).insertMany(rows, { ordered: false })
    const written = await db.collection(to).countDocuments()
    if (written !== source) throw new Error(`copied ${written} of ${source} — not dropping ${from}`)
    await db.collection(from).drop()
    console.log(`   verified ${written}, dropped ${from}`)
  }
}

const values = db.collection('values')

const overrides = await values.findOne({ name: 'loanOverrides' })
if (overrides) {
  const keys = Object.keys(overrides.value ?? {}).length
  console.log(`${green('→')} values/loanOverrides → borrowingOverrides  (${keys} entries)`)
  if (APPLY) {
    await values.updateOne(
      { name: 'borrowingOverrides' },
      { $set: { value: overrides.value ?? {} } },
      { upsert: true },
    )
    await values.deleteOne({ name: 'loanOverrides' })
  }
} else {
  console.log(`${dim('–')} values/loanOverrides — already renamed`)
}

for (const [name, path] of [['settings', 'circulation'], ['circulationRules', null]]) {
  const row = await values.findOne({ name })
  if (!row?.value) {
    console.log(`${dim('–')} values/${name} — not set`)
    continue
  }
  const holder = path ? row.value[path] : row.value
  if (!holder || holder.loanDays === undefined) {
    console.log(`${dim('–')} values/${name} — no loanDays`)
    continue
  }

  console.log(`${green('→')} values/${name}${path ? `.${path}` : ''}: loanDays ${holder.loanDays} → borrowDays`)
  if (APPLY) {
    const next = { ...holder, borrowDays: holder.loanDays }
    delete next.loanDays
    await values.updateOne(
      { name },
      { $set: { value: path ? { ...row.value, [path]: next } : next } },
    )
  }
}

const tagged = await db.collection('activity').countDocuments({ targetType: 'loan' })
if (tagged) {
  console.log(`${green('→')} activity: ${tagged} entries targetType 'loan' → 'borrowing'`)
  if (APPLY) {
    await db.collection('activity').updateMany(
      { targetType: 'loan' },
      { $set: { targetType: 'borrowing' } },
    )
  }
} else {
  console.log(`${dim('–')} activity — no 'loan' targets left`)
}

const renamedAction = await db.collection('activity').countDocuments({ action: /loan/i })
if (renamedAction) {
  console.log(`${green('→')} activity: ${renamedAction} action labels mentioning loan`)
  if (APPLY) {
    for (const row of await db.collection('activity').find({ action: /loan/i }).toArray()) {
      await db.collection('activity').updateOne(
        { id: row.id },
        { $set: { action: row.action.replace(/Loan/g, 'Borrowing').replace(/loan/g, 'borrowing') } },
      )
    }
  }
} else {
  console.log(`${dim('–')} activity — no action labels mention loan`)
}

console.log(APPLY ? `\n${green('done')}\n` : `\nNothing written. Re-run with --apply.\n`)
await client.close()
