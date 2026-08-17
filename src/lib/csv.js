// Reads and writes CSV, for the import and export buttons.

function escapeField(value) {
  const text = value === null || value === undefined ? '' : String(value)
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

// Turns rows into CSV text, quoting anything that needs it.
export function toCSV(rows, columns) {
  const lines = [columns.map(([header]) => escapeField(header)).join(',')]
  for (const row of rows) {
    lines.push(columns.map(([, accessor]) => escapeField(accessor(row))).join(','))
  }

  return `${lines.join('\r\n')}\r\n`
}

// Reads CSV text back into rows, handling quotes and commas inside fields.
export function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()

    if (row.some((value) => value.trim() !== '')) rows.push(row)
    row = []
  }

  const source = text.replace(/^﻿/, '')

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]

    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') endField()
    else if (char === '\n') endRow()
    else if (char !== '\r') field += char
  }
  if (field !== '' || row.length > 0) endRow()

  if (rows.length === 0) return { headers: [], records: [] }

  const headers = rows[0].map((header) => header.trim().toLowerCase())
  const records = rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? '').trim()])),
  )
  return { headers, records }
}

// Hands the browser a file to save.
export function downloadFile(filename, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
