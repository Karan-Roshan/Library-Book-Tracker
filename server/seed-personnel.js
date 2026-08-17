// Creates the starting staff accounts so somebody can sign in.

const API = process.env.API_URL ?? 'http://localhost:4000/api'

const LIBRARY_CODE = 'Athena'

const personnelId = (sequence, date) =>
  `${LIBRARY_CODE}-${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}-${String(
    sequence,
  ).padStart(3, '0')}`

const PEOPLE = [
  ['Priya Sharma', 'librarian', '9812345001'],
  ['Rohan Desai', 'librarian', '9812345002'],
  ['Aman Verma', 'shelving', '9812345003'],
  ['Nisha Iyer', 'shelving', '9812345004'],
  ['Sunita Rao', 'housekeeping', '9812345005'],
  ['Ramesh Patil', 'housekeeping', '9812345006'],
  ['Lata Bhosale', 'housekeeping', '9812345007'],
  ['Kavita Jadhav', 'housekeeping', '9812345008'],
  ['Manoj Kamble', 'housekeeping', '9812345009'],
  ['Vikram Singh', 'security', '9812345010'],
  ['Devendra Yadav', 'security', '9812345011'],
]

const emailFor = (name) => `${name.toLowerCase().replace(/\s+/g, '.')}@gmail.com`

const request = async (path, options) => {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) throw new Error(`${path} -> ${response.status}`)
  return response.status === 204 ? null : response.json()
}

const existing = await request('/collections/users')
const known = new Set(existing.map((person) => person.name.toLowerCase()))
const now = new Date()

let sequence = existing.length
let added = 0

for (const [name, role, phone] of PEOPLE) {
  if (known.has(name.toLowerCase())) {
    console.log(`skip   ${name} — already on the register`)
    continue
  }

  sequence += 1
  await request('/collections/users', {
    method: 'POST',
    body: JSON.stringify({
      id: crypto.randomUUID(),
      createdAt: now.toISOString(),
      name,
      role,
      email: emailFor(name),
      phone,
      membershipNumber: personnelId(sequence, now),
      avatar: null,

      passwordHash: null,
      salt: null,
      iterations: null,
      passwordPlain: null,
    }),
  })
  added += 1
  console.log(`added  ${name.padEnd(18)} ${role.padEnd(13)} ${personnelId(sequence, now)}`)
}

console.log(`\n${added} added, ${PEOPLE.length - added} skipped.`)
