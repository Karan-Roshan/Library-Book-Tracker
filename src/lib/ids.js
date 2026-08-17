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

// What a valid staff number looks like.
export const PERSONNEL_ID_PATTERN = /^[A-Za-z]+-\d{2}\.\d{4}-\d{3}$/
