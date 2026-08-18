// Sending, reading and deleting notifications.

import { storage } from './storage.js'
import { record as logActivity } from './activity.js'
import { getSettings } from './settings.js'

const MESSAGES = 'messages'

// Every notification.
export async function listMessages() {
  return storage.list(MESSAGES)
}

function shape({ subject, body, recipients }, author) {
  return {
    subject: subject.trim(),
    body: body.trim(),
    recipients,
    fromId: author.id,
    fromName: author.name,
    fromRole: author.role,
  }
}

// Saves a message without sending it.
export async function saveDraft(details, author, id = null) {
  const record = { ...shape(details, author), status: 'draft', sentAt: null }
  return id ? storage.update(MESSAGES, id, record) : storage.insert(MESSAGES, record)
}

// Sends a notification to the chosen people.
export async function sendMessage(details, author, id = null) {
  const record = {
    ...shape(details, author),
    status: 'sent',
    sentAt: new Date().toISOString(),
  }

  const sent = id
    ? await storage.update(MESSAGES, id, record)
    : await storage.insert(MESSAGES, record)

  await logActivity('MESSAGE_SENT', {
    target: record.subject || '(no subject)',
    targetType: 'message',
    targetId: sent.id,
    after: { recipients: record.recipients?.length ?? 0 },
  })
  return sent
}

// A notice the library raises on its own, rather than one a person typed. The
// library signs these itself: the desk action behind them may be taken by any
// member of staff, and the member only needs to know it came from the library.
//
// Every event here is one the settings screen can switch off, so a library that
// does not want to send receipts simply turns that event off and this returns
// null without writing anything.
export async function notifyMember(event, { member, subject, body }) {
  if (!member?.id || !subject) return null

  const settings = await getSettings()
  if (!settings.notifications?.events?.[event]?.enabled) return null

  const signature = settings.notifications.signature || 'The library'

  return sendMessage(
    {
      subject,
      body,
      recipients: [{ id: member.id, name: member.name ?? 'Member', kind: 'member' }],
    },
    { id: 'library', name: signature, role: 'system' },
  )
}

// Deletes a notification, for everyone it was sent to.
export async function deleteMessage(id) {
  const before = await storage.findOne(MESSAGES, (row) => row.id === id)
  await storage.remove(MESSAGES, id)

  await logActivity('MESSAGE_DELETED', {
    target: before?.subject || '(no subject)',
    targetType: 'message',
    targetId: id,
    before: {
      from: before?.fromName ?? null,
      recipients: before?.recipients?.length ?? 0,
      sent: before?.sentAt ?? null,
    },
  })
}

// Posts a notice from the library itself, so it lands in the bell like any
// other message. No author, and no activity entry — nobody typed it.
export async function notify({ subject, body, recipients, from = 'The library' }) {
  if (!recipients?.length) return null

  return storage.insert(MESSAGES, {
    subject: subject.trim(),
    body: body.trim(),
    recipients,
    fromId: null,
    fromName: from,
    fromRole: 'system',
    status: 'sent',
    sentAt: new Date().toISOString(),
  })
}

// Clears one from a single person's own inbox. The record stays, so everyone
// else it was sent to still sees it.
export async function deleteMessageFor(id, readerId) {
  const message = await storage.findOne(MESSAGES, (row) => row.id === id)
  if (!message || message.deletedBy?.[readerId]) return message
  return storage.update(MESSAGES, id, {
    deletedBy: { ...(message.deletedBy ?? {}), [readerId]: new Date().toISOString() },
  })
}

// Marks one as read, which clears it from the bell.
export async function markRead(id, readerId) {
  const message = await storage.findOne(MESSAGES, (row) => row.id === id)
  if (!message || message.readBy?.[readerId]) return message
  return storage.update(MESSAGES, id, {
    readBy: { ...(message.readBy ?? {}), [readerId]: new Date().toISOString() },
  })
}
