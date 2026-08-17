// Reduces the borrowing history to a given size, keeping what is still out.

import { MongoClient } from 'mongodb'

const KEEP = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 500)
const APPLY = process.argv.includes('--apply')
const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017'
const DB = process.env.MONGODB_DB ?? 'library_management_system'

const green = (s) => `\x1b[32m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 10000 })
await client.connect()
const db = client.db(DB)

const borrowings = await db.collection('borrowings').find({}).toArray()
const repairs = await db.collection('repairs').find({}).toArray()
const losses = await db.collection('lostReports').find({}).toArray()

const referenced = new Set(
  [...repairs, ...losses].map((row) => row.loanId ?? row.borrowingId).filter(Boolean),
)

const newest = (a, b) => new Date(b.issuedAt) - new Date(a.issuedAt)

const latestPerMember = new Map()
for (const row of [...borrowings].sort(newest)) {
  if (!latestPerMember.has(row.memberId)) latestPerMember.set(row.memberId, row.id)
}
const lastOfMember = new Set(latestPerMember.values())

const pinned = borrowings.filter(
  (row) => !row.returnedAt || referenced.has(row.id) || lastOfMember.has(row.id),
)
const pinnedIds = new Set(pinned.map((row) => row.id))

const room = Math.max(0, KEEP - pinned.length)
const fill = borrowings
  .filter((row) => !pinnedIds.has(row.id))
  .sort(newest)
  .slice(0, room)

const keepIds = new Set([...pinnedIds, ...fill.map((row) => row.id)])
const drop = borrowings.filter((row) => !keepIds.has(row.id))

console.log(`\n${APPLY ? 'Trimming' : 'Dry run'} — keep ${KEEP} of ${borrowings.length} borrowings\n`)
console.log(`  still out          ${String(borrowings.filter((r) => !r.returnedAt).length).padStart(5)}  kept, always`)
console.log(`  named by a repair  ${String(borrowings.filter((r) => referenced.has(r.id)).length).padStart(5)}  kept, always`)
console.log(`  last per member    ${String(lastOfMember.size).padStart(5)}  kept, always`)
console.log(`  recent returns     ${String(fill.length).padStart(5)}  kept to fill`)
console.log(`  ${red('removed')}            ${String(drop.length).padStart(5)}`)

if (drop.length && !APPLY) {
  const oldest = [...drop].sort(newest).pop()
  console.log(`\n  oldest removed: ${oldest.id} issued ${oldest.issuedAt.slice(0, 10)}`)
}

if (!APPLY) {
  console.log('\nNothing written. Re-run with --apply.\n')
  await client.close()
  process.exit(0)
}

const result = await db.collection('borrowings').deleteMany({ id: { $in: drop.map((r) => r.id) } })
console.log(`\ndeleted: ${result.deletedCount} borrowings`)

const after = await db.collection('borrowings').find({}).toArray()
const members = await db.collection('members').find({}).toArray()
const live = new Set(after.map((r) => r.id))
const withHistory = new Set(after.map((r) => r.memberId))

const orphans = [
  ['repairs', repairs.filter((r) => r.loanId && !live.has(r.loanId)).length],
  ['loss reports', losses.filter((r) => r.loanId && !live.has(r.loanId)).length],
  ['members with no history', members.filter((m) => !withHistory.has(m.id)).length],
]

console.log('\nafter:')
console.log(`  borrowings ${after.length}  (${after.filter((r) => !r.returnedAt).length} still out)`)
console.log(`  members    ${members.length}  (${withHistory.size} with a borrowing on record)`)

const broken = orphans.filter(([, n]) => n > 0)
console.log(
  broken.length
    ? `\n${red('ORPHANS LEFT')}: ${broken.map(([n, c]) => `${c} ${n}`).join(', ')}\n`
    : `\n${green('No orphans — every record still points at something that exists.')}\n`,
)

await client.close()
