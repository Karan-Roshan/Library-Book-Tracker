// The API between the browser and MongoDB, and the live-update stream.

import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT ?? 4000)

const HOST = process.env.HOST ?? '0.0.0.0'
const DEV = (process.env.NODE_ENV ?? 'development') !== 'production'
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017'
const DB_NAME = process.env.MONGODB_DB ?? 'library_management_system'

const COLLECTIONS = new Set([
  'users',
  'manualFines',
  'addedMembers',
  'messages',
  'addedBooks',
  'issuedBorrowings',
  'repairs',
  'complaints',
  'activity',
  'reservations',
  'lostReports',
  'settingsHistory',
  'backups',
  'memberLogins',
  'invitations',
  'outbox',

  'books',
  'bookCopies',
  'locations',
  'members',
  'borrowings',
  'holds',
])

const VALUES = new Set([
  'finePayments',
  'memberOverrides',
  'borrowingOverrides',
  'circulationRules',
  'settings',

  'preferences',
])

// Never print the password, wherever the connection string is logged.
const safeUri = (uri) => String(uri).replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')

const client = new MongoClient(MONGODB_URI, {
  // Fail in seconds rather than hanging. A request that hangs is answered by
  // the host's proxy with a 502 and no explanation; one that fails can say why.
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
})

// `db` stays null until the connection is up. Every route below checks it, so
// a database that is unreachable produces a clear message rather than a hang.
let db = null
let dbError = null

async function connectToMongo() {
  try {
    await client.connect()
    const connected = client.db(DB_NAME)

    for (const name of COLLECTIONS) {
      await connected.collection(name).createIndex({ id: 1 }, { unique: true })
    }
    await connected.collection('values').createIndex({ name: 1 }, { unique: true })

    db = connected
    dbError = null
    console.log(`Connected to MongoDB at ${safeUri(MONGODB_URI)}/${DB_NAME}`)
  } catch (error) {
    db = null
    dbError = error.message
    console.error(`MongoDB unavailable: ${error.message}`)
    console.error('Retrying in 5s. Check the connection string and the IP allowlist.')
    setTimeout(connectToMongo, 5000)
  }
}

/*
  Deliberately not awaited.

  Connecting before `app.listen` meant an unreachable database took the whole
  service down with it: the process exited, the HTTP server never started, and
  the host answered every request — the app itself included — with a bare 502.
  Now the site comes up either way, and only the data routes report the fault.
*/
connectToMongo()

// Answers the data routes while the database is still down.
const requireDb = (request, response, next) => {
  if (db) return next()
  response.status(503).json({
    error: 'The library database is not connected.',
    detail: dbError ?? 'Still connecting.',
  })
}

const app = express()

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (!ALLOWED_ORIGINS.length) return callback(null, DEV)
      callback(null, ALLOWED_ORIGINS.includes(origin))
    },
  }),
)

app.use(express.json({ limit: '12mb' }))

const APPEND_ONLY = new Set(['activity'])

const appendOnly = (request, response, next) => {
  if (APPEND_ONLY.has(request.params.name)) {
    return response
      .status(403)
      .json({ error: `"${request.params.name}" is append-only and cannot be changed or removed` })
  }
  next()
}

const named = (set) => (request, response, next) => {
  if (!set.has(request.params.name)) {
    return response.status(404).json({ error: `Unknown store "${request.params.name}"` })
  }
  next()
}

const strip = ({ _id, ...document }) => document

const MODEL_KEY = process.env.ANTHROPIC_API_KEY ?? null
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5'

const SMTP_URL = process.env.EMAIL_WEBHOOK_URL ?? null

app.get('/api/email/status', (request, response) => {
  response.json({ provider: Boolean(SMTP_URL) })
})

app.post('/api/email/send', async (request, response) => {
  if (!SMTP_URL) return response.status(503).json({ error: 'No email provider configured' })

  const { to, subject, body } = request.body ?? {}
  if (!to || !subject) return response.status(400).json({ error: 'to and subject required' })

  try {
    const result = await fetch(SMTP_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to, subject, body }),
    })
    if (!result.ok) return response.status(502).json({ error: `Provider returned ${result.status}` })
    response.json({ sent: true })
  } catch (error) {
    response.status(502).json({ error: error.message })
  }
})

app.get('/api/agent/status', (request, response) => {
  response.json({ model: Boolean(MODEL_KEY), name: MODEL_KEY ? MODEL : null })
})

app.post('/api/agent/interpret', async (request, response) => {
  if (!MODEL_KEY) return response.status(503).json({ error: 'No model configured' })

  const { system, message } = request.body ?? {}
  if (!system || !message) return response.status(400).json({ error: 'system and message required' })

  try {
    const result = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': MODEL_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        system,
        messages: [{ role: 'user', content: message }],
      }),
    })

    if (!result.ok) {
      return response.status(502).json({ error: `Model returned ${result.status}` })
    }

    const body = await result.json()
    const text = body?.content?.find((part) => part.type === 'text')?.text ?? ''

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return response.json({ unresolved: true })

    response.json(JSON.parse(match[0]))
  } catch (error) {
    response.status(502).json({ error: error.message })
  }
})

const listeners = new Set()

const broadcast = (payload) => {
  const line = `data: ${JSON.stringify(payload)}\n\n`
  for (const client of listeners) {
    try {
      client.write(line)
    } catch {
      listeners.delete(client)
    }
  }
}

app.get('/api/events', (request, response) => {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',

    'X-Accel-Buffering': 'no',
  })
  response.write('retry: 3000\n\n')
  listeners.add(response)

  const beat = setInterval(() => {
    try {
      response.write(': keep-alive\n\n')
    } catch {
      clearInterval(beat)
    }
  }, 25_000)

  request.on('close', () => {
    clearInterval(beat)
    listeners.delete(response)
  })
})

const originOf = (request) => request.get('X-Client-Id') ?? null

app.get('/api/health', (_request, response) =>
  response.status(db ? 200 : 503).json({
    ok: Boolean(db),
    db: DB_NAME,
    database: db ? 'connected' : 'unavailable',
    ...(dbError ? { detail: dbError } : {}),
  }),
)

app.get('/api/collections/:name', requireDb, named(COLLECTIONS), async (request, response) => {
  const rows = await db.collection(request.params.name).find({}).toArray()
  response.json(rows.map(strip))
})

app.post('/api/collections/:name', requireDb, named(COLLECTIONS), async (request, response) => {
  const document = request.body
  if (!document?.id) return response.status(400).json({ error: 'Document needs an id' })

  const stored =
    request.params.name === 'activity'
      ? { ...document, ip: request.ip ?? request.socket?.remoteAddress ?? null }
      : { ...document }

  await db.collection(request.params.name).insertOne(stored)
  broadcast({ collection: request.params.name, action: 'insert', id: stored.id, origin: originOf(request) })
  response.status(201).json(stored)
})

app.patch('/api/collections/:name/:id', requireDb, named(COLLECTIONS), appendOnly, async (request, response) => {
  const result = await db
    .collection(request.params.name)
    .findOneAndUpdate(
      { id: request.params.id },
      { $set: request.body },
      { returnDocument: 'after' },
    )
  if (!result) return response.status(404).json({ error: 'Not found' })
  broadcast({ collection: request.params.name, action: 'update', id: request.params.id, origin: originOf(request) })
  response.json(strip(result))
})

app.delete('/api/collections/:name/:id', requireDb, named(COLLECTIONS), appendOnly, async (request, response) => {
  await db.collection(request.params.name).deleteOne({ id: request.params.id })
  broadcast({ collection: request.params.name, action: 'delete', id: request.params.id, origin: originOf(request) })
  response.status(204).end()
})

app.get('/api/values/:name', requireDb, named(VALUES), async (request, response) => {
  const row = await db.collection('values').findOne({ name: request.params.name })
  response.json({ value: row?.value ?? null })
})

app.put('/api/values/:name', requireDb, named(VALUES), async (request, response) => {
  await db
    .collection('values')
    .updateOne(
      { name: request.params.name },
      { $set: { value: request.body?.value ?? null } },
      { upsert: true },
    )
  broadcast({ collection: `values/${request.params.name}`, action: 'update', origin: originOf(request) })
  response.status(204).end()
})

const CLIENT = path.join(dirname, '..', 'dist')

if (existsSync(CLIENT)) {
  app.use(express.static(CLIENT))
  app.get(/^(?!\/api).*/, (request, response) => {
    response.sendFile(path.join(CLIENT, 'index.html'))
  })
  console.log(`Serving the built client from ${CLIENT}`)
} else {
  console.log('No dist/ found — run `npm run build` to serve the client from here.')
}

app.listen(PORT, HOST, () =>
  console.log(`API listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`),
)
