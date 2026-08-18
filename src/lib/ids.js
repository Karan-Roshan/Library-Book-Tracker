// The library's own reference numbers, and the shape each one takes.

export const LIBRARY_CODE = 'Athena'

const pad = (value, width) => String(value).padStart(width, '0')
const parts = (date) => ({
  day: pad(date.getDate(), 2),
  month: pad(date.getMonth() + 1, 2),
  year: date.getFullYear(),
})

// A staff number, as Athena-08.2026-001.
export function personnelId(sequence, date = new Date()) {
  const { month, year } = parts(date)
  return `${LIBRARY_CODE}-${month}.${year}-${pad(sequence, 3)}`
}

// A membership number, from the date they joined.
export function memberId(sequence, date = new Date()) {
  const { day, month, year } = parts(date)
  return `${LIBRARY_CODE}-${day}.${month}.${year}-${pad(sequence, 3)}`
}

// A reservation number, as RES-0019. They run in one unbroken sequence.
export const reservationNumber = (sequence) => `RES-${pad(sequence, 4)}`

// The most a reservation number may run to before it stops being a reference
// anyone could read out.
export const RESERVATION_SEQUENCE_MAX = 999_999

// The number out of a reservation reference, or 0 if it holds none. Only the
// printed shape counts: a hold that was stamped with a database id instead of a
// number reads as nothing, so it can neither carry the series forward nor push
// it somewhere absurd.
export const reservationSequenceOf = (code) => {
  const match = /^RES-(\d+)$/.exec(String(code ?? '').trim())
  if (!match) return 0
  const sequence = Number(match[1])
  return sequence <= RESERVATION_SEQUENCE_MAX ? sequence : 0
}

// What a valid staff number looks like.
export const PERSONNEL_ID_PATTERN = /^[A-Za-z]+-\d{2}\.\d{4}-\d{3}$/
