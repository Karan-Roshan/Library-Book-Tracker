// Reads and saves the library's settings.

import { storage } from './storage.js'
import { record } from './activity.js'
import { DEFAULT_SETTINGS, diffSettings, withDefaults } from '../lib/settings.js'

const SETTINGS = 'settings'
const HISTORY = 'settingsHistory'
const BACKUPS = 'backups'

// Collections a backup includes.
export const BACKED_UP = [
  'users',
  'addedMembers',
  'addedBooks',
  'issuedBorrowings',
  'reservations',
  'lostReports',
  'repairs',
  'manualFines',
  'messages',
  'activity',
  'settingsHistory',
]

// Single-value slots a backup includes.
export const BACKED_UP_VALUES = [
  'settings',
  'finePayments',
  'memberOverrides',
  'borrowingOverrides',
  'circulationRules',
]

// The library's settings, with defaults filled in.
export async function getSettings() {
  const saved = await storage.getValue(SETTINGS)

  if (!saved) {
    const legacy = await storage.getValue('circulationRules')
    if (legacy) {
      return withDefaults({
        circulation: {
          borrowDays: legacy.borrowDays,
          maxBooks: legacy.maxBooks,
          maxRenewals: legacy.maxRenewals,
          renewalDays: legacy.renewalDays,
          blockAtFine: legacy.blockAtFine,
          borrowWithFine: legacy.borrowWithFine,
          renewWithFine: legacy.renewWithFine,
          renewWhenOverdue: legacy.renewWhenOverdue,
          renewWhenReserved: legacy.renewWhenReserved,
          reservationDays: legacy.reservationDays,
        },
        finance: {
          finePerDay: legacy.finePerDay,
          maxFine: legacy.maxFine,
          replacementCost: legacy.replacementCost,
          processingFee: legacy.processingFee,
        },
      })
    }
  }

  return withDefaults(saved)
}

// Saves one section and records what changed.
export async function saveSection(section, values, { reason, actor } = {}) {
  const current = await getSettings()
  const next = withDefaults({ ...current, [section]: { ...current[section], ...values } })

  await storage.setValue(SETTINGS, next)

  const changes = diffSettings(current[section], next[section], section)
  if (changes.length) {
    await Promise.all(
      changes.map((entry) =>
        storage.insert(HISTORY, {
          at: new Date().toISOString(),
          section,
          path: entry.path,
          from: entry.from ?? null,
          to: entry.to ?? null,
          reason: reason ?? null,
          by: actor?.name ?? null,
          byId: actor?.id ?? null,
          byRole: actor?.role ?? null,
        }),
      ),
    )

    await record('SETTINGS_UPDATED', {
      target: section,
      targetType: 'settings',
      targetId: section,
      reason: reason ?? null,
      before: Object.fromEntries(changes.map((entry) => [entry.path, entry.from ?? null])),
      after: Object.fromEntries(changes.map((entry) => [entry.path, entry.to ?? null])),
    })
  }

  return { settings: next, changes }
}

// Puts one section back to its defaults.
export async function resetSection(section, { reason, actor } = {}) {
  return saveSection(section, DEFAULT_SETTINGS[section], {
    reason: reason ?? 'Restored to defaults',
    actor,
  })
}

// Every settings change, with who made it.
export async function listHistory() {
  const rows = await storage.list(HISTORY)
  return rows.sort((a, b) => new Date(b.at) - new Date(a.at))
}

// Takes a full copy of the library.
export async function createBackup({ actor, note } = {}) {
  const collections = {}
  for (const name of BACKED_UP) collections[name] = await storage.list(name)

  const values = {}
  for (const name of BACKED_UP_VALUES) values[name] = await storage.getValue(name)

  const payload = { collections, values }
  const json = JSON.stringify(payload)

  const backup = await storage.insert(BACKUPS, {
    at: new Date().toISOString(),
    by: actor?.name ?? null,
    note: note ?? null,
    status: 'Successful',

    bytes: json.length,
    records: Object.values(collections).reduce((sum, rows) => sum + rows.length, 0),
    collections: Object.fromEntries(
      Object.entries(collections).map(([name, rows]) => [name, rows.length]),
    ),
    payload,
  })

  await record('BACKUP_CREATED', {
    target: `Backup ${backup.id.slice(0, 8)}`,
    targetType: 'backup',
    targetId: backup.id,
    reason: note ?? null,
    after: { records: backup.records, bytes: backup.bytes },
  })

  return backup
}

// Backups taken so far.
export async function listBackups() {
  const rows = await storage.list(BACKUPS)

  return rows
    .map(({ payload, ...rest }) => rest)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
}

// One backup in full.
export async function getBackup(id) {
  return storage.findOne(BACKUPS, (row) => row.id === id)
}

// Deletes a backup.
export async function removeBackup(id, { actor } = {}) {
  await storage.remove(BACKUPS, id)
  await record('BACKUP_DELETED', {
    target: `Backup ${String(id).slice(0, 8)}`,
    targetType: 'backup',
    targetId: id,
    as: actor ? undefined : undefined,
  })
}

// Puts a backup back, replacing what is there.
export async function restoreBackup(payload, { actor, label } = {}) {
  const restored = []

  for (const [name, rows] of Object.entries(payload.collections ?? {})) {
    if (name === 'activity') continue

    const existing = await storage.list(name)
    for (const row of existing) await storage.remove(name, row.id)
    for (const row of rows) await storage.insert(name, row)
    restored.push(`${name} (${rows.length})`)
  }

  for (const [name, value] of Object.entries(payload.values ?? {})) {
    if (value !== undefined) await storage.setValue(name, value)
  }

  await record('BACKUP_RESTORED', {
    target: label ?? 'Backup',
    targetType: 'backup',
    reason: 'Data restored from backup',
    after: { restored: restored.join(', ') },
  })

  return restored
}

// Exports the whole library as one file.
export async function exportEverything() {
  const collections = {}
  for (const name of BACKED_UP) collections[name] = await storage.list(name)

  const values = {}
  for (const name of BACKED_UP_VALUES) values[name] = await storage.getValue(name)

  await record('DATA_EXPORTED', {
    target: 'Full library export',
    targetType: 'backup',
    after: {
      records: Object.values(collections).reduce((sum, rows) => sum + rows.length, 0),
    },
  })

  return {
    exportedAt: new Date().toISOString(),
    application: 'Athenaeum',
    version: 1,
    collections,
    values,
  }
}
