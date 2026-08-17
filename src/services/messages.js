// Sending, reading and deleting notifications.

import { storage } from './storage.js'
import { record as logActivity } from './activity.js'

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

// Marks one as read, which clears it from the bell.
export async function markRead(id, readerId) {
  const message = await storage.findOne(MESSAGES, (row) => row.id === id)
  if (!message || message.readBy?.[readerId]) return message
  return storage.update(MESSAGES, id, {
    readBy: { ...(message.readBy ?? {}), [readerId]: new Date().toISOString() },
  })
}
