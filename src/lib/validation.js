// Checks what somebody typed into a form, and says what is wrong.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Checks a person's name, and says what is wrong with it.
export function validateName(value) {
  const name = value.trim()
  if (!name) return 'Enter your full name.'
  if (name.length < 2) return 'Name must be at least 2 characters.'
  if (name.length > 80) return 'Name must be 80 characters or fewer.'
  return null
}

// Tidies spacing and capitals in a name.
export function normalizeName(value) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase())
}

// Checks a date of birth. Blank is allowed — the library does not always hold one.
export function validateDateOfBirth(value) {
  if (!value) return null

  const born = new Date(value)
  if (Number.isNaN(born.getTime())) return 'Enter a real date.'

  const today = new Date()
  if (born > today) return 'Date of birth cannot be in the future.'
  if (today.getFullYear() - born.getFullYear() > 120) return 'Check the year — that is over 120 years ago.'
  return null
}

// Rejects obvious typos. It cannot prove an address is deliverable.
export function validateEmail(value) {
  const email = value.trim()
  if (!email) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address.'
  return null
}

// Checks an Indian mobile number.
export function validatePhone(value) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return 'Enter a phone number.'
  if (digits.length !== 10) return 'Enter the 10 digits after +91.'
  if (!/^[6-9]/.test(digits)) return 'Indian mobile numbers start with 6, 7, 8, or 9.'
  return null
}

// Checks an address is long enough to be one.
export function validateAddress(value) {
  const address = value.trim()
  if (!address) return 'Enter the full postal address.'
  if (address.length < 10) return 'Give the full address, including city and PIN code.'
  if (address.length > 300) return 'Address must be 300 characters or fewer.'
  return null
}

// Checks a bank account number.
export function validateAccountNumber(value) {
  const account = value.replace(/\s/g, '')
  if (!account) return 'Enter the account number.'
  if (!/^\d{9,18}$/.test(account)) return 'Account numbers are 9 to 18 digits.'
  return null
}

// Checks a password meets the library's minimum.
export function validatePassword(value) {
  if (!value) return 'Enter a password.'
  if (value.length < 8) return 'Password must be at least 8 characters.'
  if (value.length > 128) return 'Password must be 128 characters or fewer.'
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value))
    return 'Include both uppercase and lowercase letters.'
  if (!/\d/.test(value)) return 'Include at least one number.'
  return null
}

// Checks the two password boxes match.
export function validateConfirmation(password, confirmation) {
  if (!confirmation) return 'Re-enter your password.'
  if (password !== confirmation) return 'Passwords do not match.'
  return null
}

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent']

// How strong a password is, for the meter under the box.
export function scorePassword(password) {
  if (!password) return { score: 0, label: '', percent: 0 }

  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (/^(.)\1+$/.test(password) || /^[a-z]+$/i.test(password)) score = Math.min(score, 1)

  const capped = Math.min(score, 4)
  return {
    score: capped,
    label: STRENGTH_LABELS[capped],
    percent: ((capped + 1) / 5) * 100,
  }
}
