// Reads and writes books added at the desk.

import { storage } from './storage.js'
import { record } from './activity.js'
import { COPIES_PER_TITLE, BORROW_DAYS, bookCode, dueDateFor } from '../lib/books.js'

const BOOKS = 'addedBooks'
const BORROWINGS = 'issuedBorrowings'

// Books added at the desk.
export async function listAddedBooks() {
  return storage.list(BOOKS)
}

// Adds a title to the catalogue.
export async function addBook({ title, author, category, shelfNumber, copies, condition, isbn, price }) {
  const existing = await storage.list(BOOKS)
  const sequence = 1000 + existing.length + 1

  const book = await storage.insert(BOOKS, {
    id: `bk_${sequence}`,
    code: bookCode(sequence),
    title: title.trim(),
    author: author.trim(),
    category,
    shelfNumber: Number(shelfNumber) || 1,

    copies: Math.min(Math.max(1, Number(copies) || COPIES_PER_TITLE), COPIES_PER_TITLE),
    condition: condition ?? 'Good',
    isbn: isbn?.trim() ?? '',

    price: Math.max(0, Number(price) || 0),

    addedAt: new Date().toISOString(),
  })

  await record('BOOK_ADDED', {
    target: book.title,
    targetType: 'book',
    targetId: book.code,
    after: { category: book.category, shelf: book.shelfNumber, copies: book.copies },
  })
  return book
}

// Removes a desk-added title.
export async function removeAddedBook(id) {
  await storage.remove(BOOKS, id)
}

// Borrowings written at the desk.
export async function listIssuedBorrowings() {
  return storage.list(BORROWINGS)
}

// Records a book going out.
export async function issueBook({ bookId, memberId, issuedAt = new Date().toISOString(), bookTitle, memberName, memberNumber }) {
  const borrowing = await storage.insert(BORROWINGS, {
    bookId,
    memberId,
    issuedAt,
    dueAt: dueDateFor(issuedAt).toISOString(),
    returnedAt: null,
  })

  await record('BOOK_ISSUED', {
    target: bookTitle ?? bookId,
    targetType: 'borrowing',
    targetId: borrowing.id,
    after: {
      member: memberName ?? memberId,
      memberId: memberNumber ?? memberId,
      issued: borrowing.issuedAt.slice(0, 10),
      due: borrowing.dueAt.slice(0, 10),
    },
  })
  return borrowing
}

export { BORROW_DAYS }
