// The seeded catalogue and what the desk has since recorded, read as one library.
//
// Every screen composes its own view, but they all join on the same two things:
// a book and a member. Anything registered or issued after the seed only exists
// in storage, so a join that reads the seed alone reports "Unknown member" for
// people who are plainly on the register. These two helpers keep that from
// happening: index the live list first, and fall back to the seed.

// One lookup over the live list, filled in from the seed for anything older.
export function indexById(live = [], seeded = [], key = 'id') {
  const index = new Map(live.map((row) => [row[key], row]))
  for (const row of seeded) if (!index.has(row[key])) index.set(row[key], row)
  return index
}

// The seeded rows plus everything recorded since — later rows win on the same id,
// and anything struck off is dropped.
export function mergeRows(seeded = [], recorded = [], key = 'id') {
  const byId = new Map(seeded.map((row) => [row[key], row]))
  for (const row of recorded) byId.set(row[key], { ...(byId.get(row[key]) ?? {}), ...row })
  return [...byId.values()].filter((row) => !row.deleted)
}
