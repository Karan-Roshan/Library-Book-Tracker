// Notifications: which folder one belongs in, and whether it has been read.

const newestFirst = (a, b) =>
  new Date(b.sentAt ?? b.createdAt) - new Date(a.sentAt ?? a.createdAt)

// Whether a message was sent to this person.
export const addressedTo = (message, userId) =>
  message.recipients?.some((person) => person.id === userId) ?? false

// Whether this person cleared it from their own inbox. Everyone else keeps theirs.
export const isDeletedFor = (message, userId) => Boolean(message.deletedBy?.[userId])

// Messages this person received and has not cleared.
export function inboxFor(messages, userId) {
  return messages
    .filter(
      (message) =>
        message.status === 'sent' &&
        addressedTo(message, userId) &&
        !isDeletedFor(message, userId),
    )
    .sort(newestFirst)
}

// Messages this person sent.
export function sentBy(messages, userId) {
  return messages
    .filter((message) => message.status === 'sent' && message.fromId === userId)
    .sort(newestFirst)
}

// Messages this person started and has not sent.
export function draftsBy(messages, userId) {
  return messages
    .filter((message) => message.status === 'draft' && message.fromId === userId)
    .sort(newestFirst)
}

// Whether this person has yet to open it.
export const isUnread = (message, userId) => !message.readBy?.[userId]

// How many are waiting, for the bell.
export function unreadCount(messages, userId) {
  return inboxFor(messages, userId).filter((message) => isUnread(message, userId)).length
}

// Names the recipients, shortened when there are many.
export function describeRecipients(recipients = []) {
  if (recipients.length === 0) return 'No recipients'
  if (recipients.length === 1) return recipients[0].name
  return `${recipients[0].name} and ${recipients.length - 1} other${
    recipients.length === 2 ? '' : 's'
  }`
}

// The groups a message can be addressed to at once.
export const AUDIENCES = [
  { key: 'all', label: 'Everyone' },
  { key: 'owner', label: 'Administrators' },
  { key: 'librarian', label: 'Library Assistants' },
  { key: 'support', label: 'Support staff' },
  { key: 'member', label: 'Members' },
]

const SUPPORT_ROLES = ['shelving', 'housekeeping', 'security']

// Whether a person falls in the chosen audience.
export function inAudience(person, audience) {
  if (audience === 'all') return true
  if (audience === 'support') return SUPPORT_ROLES.includes(person.role)
  return person.role === audience
}
