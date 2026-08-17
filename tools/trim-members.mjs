// Reduces the member roll, taking each member's records with them.

import { MongoClient } from 'mongodb'

const KEEP = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 50)
const APPLY = process.argv.includes('--apply')
const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? 'library_management_system'

const green = (s) => `\x1b[32m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 10000 })
await client.connect()
const db = client.db(DB)

const members = await db.collection('members').find({}).toArray()
const borrowings = await db.collection('borrowings').find({}).toArray()
const holds = await db.collection('holds').find({}).toArray()
const fines = await db.collection('manualFines').find({}).toArray()

const deskBorrowings = await db.collection('issuedBorrowings').find({}).toArray()
const overridesRow = await db.collection('values').findOne({ name: 'memberOverrides' })
const memberOverrides = overridesRow?.value ?? {}

const trimming = members.length > KEEP

const openBy = {}
const holdBy = {}
for (const row of borrowings) if (!row.returnedAt) openBy[row.memberId] = (openBy[row.memberId] ?? 0) + 1
for (const row of holds) holdBy[row.memberId] = (holdBy[row.memberId] ?? 0) + 1

const fined = new Set(fines.map((f) => f.memberId))

const ranked = [...members].sort(
  (a, b) =>
    (openBy[b.id] ?? 0) - (openBy[a.id] ?? 0) ||
    (holdBy[b.id] ?? 0) - (holdBy[a.id] ?? 0) ||
    (fined.has(b.membershipNumber) ? 1 : 0) - (fined.has(a.membershipNumber) ? 1 : 0) ||
    new Date(b.joinedAt) - new Date(a.joinedAt),
)

const keep = trimming ? ranked.slice(0, KEEP) : ranked
const drop = trimming ? ranked.slice(KEEP) : []
const keepIds = new Set(keep.map((m) => m.id))
const keepNums = new Set(keep.map((m) => m.membershipNumber))
const dropIds = drop.map((m) => m.id)

const goingBorrowings = borrowings.filter((b) => !keepIds.has(b.memberId))
const goingHolds = holds.filter((h) => !keepIds.has(h.memberId))
const goingFines = fines.filter((f) => !keepNums.has(f.memberId))
const goingDesk = deskBorrowings.filter((b) => !keepIds.has(b.memberId))
const goingOverrides = Object.keys(memberOverrides).filter((id) => !keepIds.has(id))

console.log(`\n${APPLY ? 'Trimming' : 'Dry run'} — keep ${KEEP} of ${members.length} members\n`)
console.log(`  members     ${String(drop.length).padStart(5)} removed`)
console.log(`  borrowings  ${String(goingBorrowings.length).padStart(5)} removed  (${goingBorrowings.filter((b) => !b.returnedAt).length} still out)`)
console.log(`  holds       ${String(goingHolds.length).padStart(5)} removed`)
console.log(`  fines       ${String(goingFines.length).padStart(5)} removed`)
console.log(`  desk issues ${String(goingDesk.length).padStart(5)} removed`)
console.log(`  overrides   ${String(goingOverrides.length).padStart(5)} removed`)

if (!APPLY) {
  console.log('\nNothing written. Re-run with --apply.\n')
  await client.close()
  process.exit(0)
}

const r1 = await db.collection('borrowings').deleteMany({ memberId: { $in: dropIds } })
const r2 = await db.collection('holds').deleteMany({ memberId: { $in: dropIds } })
const r3 = await db.collection('manualFines').deleteMany({ id: { $in: goingFines.map((f) => f.id) } })
const r4 = await db.collection('members').deleteMany({ id: { $in: dropIds } })
const r5 = await db.collection('issuedBorrowings').deleteMany({ id: { $in: goingDesk.map((b) => b.id) } })
if (goingOverrides.length) {
  const next = { ...memberOverrides }
  for (const id of goingOverrides) delete next[id]
  await db.collection('values').updateOne({ name: 'memberOverrides' }, { $set: { value: next } }, { upsert: true })
}

console.log(`\ndeleted: ${r4.deletedCount} members, ${r1.deletedCount} borrowings, ${r2.deletedCount} holds, ${r3.deletedCount} fines, ${r5.deletedCount} desk issues, ${goingOverrides.length} overrides`)

const after = {
  members: await db.collection('members').find({}).toArray(),
  borrowings: await db.collection('borrowings').find({}).toArray(),
  holds: await db.collection('holds').find({}).toArray(),
  fines: await db.collection('manualFines').find({}).toArray(),
  desk: await db.collection('issuedBorrowings').find({}).toArray(),
  overrides: (await db.collection('values').findOne({ name: 'memberOverrides' }))?.value ?? {},
}
const live = new Set(after.members.map((m) => m.id))
const liveNums = new Set(after.members.map((m) => m.membershipNumber))

const orphans = [
  ['borrowings', after.borrowings.filter((b) => !live.has(b.memberId)).length],
  ['holds', after.holds.filter((h) => !live.has(h.memberId)).length],
  ['fines', after.fines.filter((f) => !liveNums.has(f.memberId)).length],
  ['desk issues', after.desk.filter((b) => !live.has(b.memberId)).length],
  ['overrides', Object.keys(after.overrides).filter((id) => !live.has(id)).length],
]

console.log('\nafter:')
console.log(`  members    ${after.members.length}`)
console.log(`  borrowings ${after.borrowings.length}  (${after.borrowings.filter((b) => !b.returnedAt).length} still out)`)
console.log(`  holds      ${after.holds.length}`)
console.log(`  fines      ${after.fines.length}`)

const broken = orphans.filter(([, n]) => n > 0)
console.log(
  broken.length
    ? `\n${red('ORPHANS LEFT')}: ${broken.map(([n, c]) => `${c} ${n}`).join(', ')}\n`
    : `\n${green('No orphans — every record still points at a member who exists.')}\n`,
)

await client.close()
