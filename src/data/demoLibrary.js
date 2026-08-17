// Generates a year of believable library activity, so nothing starts empty.

import { memberId } from '../lib/ids.js'
import { accessionOf, buildLocations, copyId, floorFor, locationId } from '../lib/copies.js'

const SEED = 20260803

function createRandom(seed) {
  let state = seed >>> 0
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const CATEGORIES = [
  { name: 'Physics', block: 'A' },
  { name: 'Chemistry', block: 'B' },
  { name: 'Biology', block: 'C' },
  { name: 'Mathematics', block: 'D' },
  { name: 'Technology', block: 'E' },
  { name: 'Novel', block: 'F' },
  { name: 'History', block: 'G' },
  { name: 'Business', block: 'H' },
  { name: 'Biography', block: 'J' },
]

export const CATEGORY_NAMES = CATEGORIES.map((entry) => entry.name)

export const blockFor = (category) =>
  CATEGORIES.find((entry) => entry.name === category)?.block ?? 'Z'

export const COPIES_PER_TITLE = 3

export const BOOK_CONDITIONS = ['Good', 'Fair', 'Damaged']

const PRICES = {
  "1984": 250,
  "A Brief History of Time": 400,
  "A Suitable Boy": 900,
  "Astrophysics for People in a Hurry": 400,
  "Atomic Habits": 450,
  "Becoming": 650,
  "Clean Code": 700,
  "Cosmos": 500,
  "Deep Work": 450,
  "Designing Data-Intensive Applications": 1100,
  "Educated": 500,
  "Good to Great": 600,
  "Guns, Germs, and Steel": 600,
  "India After Gandhi": 700,
  "Introduction to Algorithms": 1200,
  "Long Walk to Freedom": 600,
  "Midnight’s Children": 500,
  "Norwegian Wood": 450,
  "Pride and Prejudice": 200,
  "Refactoring": 900,
  "Rich Dad Poor Dad": 350,
  "SPQR": 700,
  "Sapiens": 550,
  "Silent Spring": 450,
  "Steve Jobs": 700,
  "The Alchemist": 300,
  "The Code Book": 500,
  "The Diary of a Young Girl": 250,
  "The Discovery of India": 450,
  "The Emperor of All Maladies": 600,
  "The Gene": 600,
  "The God of Small Things": 400,
  "The Innovator’s Dilemma": 650,
  "The Kite Runner": 400,
  "The Lean Startup": 500,
  "The Mythical Man-Month": 600,
  "The Namesake": 400,
  "The Pragmatic Programmer": 850,
  "The Psychology of Money": 350,
  "The Selfish Gene": 500,
  "The Silk Roads": 650,
  "The Story of My Experiments with Truth": 200,
  "The White Tiger": 350,
  "Thinking, Fast and Slow": 550,
  "To Kill a Mockingbird": 350,
  "Train to Pakistan": 300,
  "Wings of Fire": 250,
  "Zero to One": 400,
  "A Mathematician’s Apology": 250,
  "A People’s History of the United States": 700,
  "An Era of Darkness": 600,
  "Artificial Intelligence: A Modern Approach": 1200,
  "Behave": 900,
  "Black Holes and Baby Universes": 400,
  "Blue Ocean Strategy": 600,
  "Built to Last": 550,
  "Chemistry: The Central Science": 1100,
  "Code": 650,
  "Concepts of Physics": 700,
  "Crime and Punishment": 450,
  "Elon Musk": 900,
  "Fermat’s Last Theorem": 400,
  "Freedom at Midnight": 500,
  "Gödel, Escher, Bach": 900,
  "How to Solve It": 350,
  "I Am Malala": 400,
  "Lab Girl": 450,
  "Leonardo da Vinci": 800,
  "Molecules": 800,
  "Napoleon’s Buttons": 550,
  "One Hundred Years of Solitude": 550,
  "Open": 500,
  "Organic Chemistry": 1200,
  "Periodic Tales": 500,
  "Playing It My Way": 600,
  "Seven Brief Lessons on Physics": 250,
  "Shoe Dog": 500,
  "Site Reliability Engineering": 800,
  "Start with Why": 450,
  "Structure and Interpretation of Computer Programs": 900,
  "Surely You’re Joking, Mr. Feynman!": 400,
  "The Argumentative Indian": 500,
  "The Art of Computer Programming": 1200,
  "The Body": 600,
  "The Disappearing Spoon": 450,
  "The Double Helix": 400,
  "The Elegant Universe": 550,
  "The Elements": 850,
  "The Feynman Lectures on Physics": 1200,
  "The Great Gatsby": 250,
  "The Hard Thing About Hard Things": 500,
  "The Joy of x": 450,
  "The Man Who Knew Infinity": 500,
  "The Origin of Species": 400,
  "The Rise and Fall of the Third Reich": 900,
  "The Soul of a New Machine": 500,
  "The Wright Brothers": 500,
  "Things Fall Apart": 350,
  "Uncle Tungsten": 500,
  "Why We Sleep": 500,
}

const CATALOG = [
  ['Atomic Habits', 'James Clear', 'Business'],
  ['The Psychology of Money', 'Morgan Housel', 'Business'],
  ['Deep Work', 'Cal Newport', 'Business'],
  ['Rich Dad Poor Dad', 'Robert Kiyosaki', 'Business'],
  ['Clean Code', 'Robert C. Martin', 'Technology'],
  ['The Pragmatic Programmer', 'Andrew Hunt', 'Technology'],
  ['Designing Data-Intensive Applications', 'Martin Kleppmann', 'Technology'],
  ['Introduction to Algorithms', 'Thomas H. Cormen', 'Mathematics'],
  ['The Mythical Man-Month', 'Frederick P. Brooks Jr.', 'Technology'],
  ['Refactoring', 'Martin Fowler', 'Technology'],
  ['A Brief History of Time', 'Stephen Hawking', 'Physics'],
  ['Cosmos', 'Carl Sagan', 'Physics'],
  ['The Selfish Gene', 'Richard Dawkins', 'Biology'],
  ['Sapiens', 'Yuval Noah Harari', 'History'],
  ['Silent Spring', 'Rachel Carson', 'Biology'],
  ['The Emperor of All Maladies', 'Siddhartha Mukherjee', 'Biology'],
  ['Thinking, Fast and Slow', 'Daniel Kahneman', 'Business'],
  ['The Gene', 'Siddhartha Mukherjee', 'Biology'],
  ['India After Gandhi', 'Ramachandra Guha', 'History'],
  ['The Discovery of India', 'Jawaharlal Nehru', 'History'],
  ['Guns, Germs, and Steel', 'Jared Diamond', 'History'],
  ['The Silk Roads', 'Peter Frankopan', 'History'],
  ['SPQR', 'Mary Beard', 'History'],
  ['Wings of Fire', 'A. P. J. Abdul Kalam', 'Biography'],
  ['The Diary of a Young Girl', 'Anne Frank', 'Biography'],
  ['Long Walk to Freedom', 'Nelson Mandela', 'Biography'],
  ['Steve Jobs', 'Walter Isaacson', 'Biography'],
  ['Educated', 'Tara Westover', 'Biography'],
  ['The Story of My Experiments with Truth', 'M. K. Gandhi', 'Biography'],
  ['Becoming', 'Michelle Obama', 'Biography'],
  ['To Kill a Mockingbird', 'Harper Lee', 'Novel'],
  ['1984', 'George Orwell', 'Novel'],
  ['The God of Small Things', 'Arundhati Roy', 'Novel'],
  ['Midnight’s Children', 'Salman Rushdie', 'Novel'],
  ['The Kite Runner', 'Khaled Hosseini', 'Novel'],
  ['Pride and Prejudice', 'Jane Austen', 'Novel'],
  ['The Alchemist', 'Paulo Coelho', 'Novel'],
  ['Train to Pakistan', 'Khushwant Singh', 'Novel'],
  ['The White Tiger', 'Aravind Adiga', 'Novel'],
  ['A Suitable Boy', 'Vikram Seth', 'Novel'],
  ['The Namesake', 'Jhumpa Lahiri', 'Novel'],
  ['Norwegian Wood', 'Haruki Murakami', 'Novel'],
  ['The Lean Startup', 'Eric Ries', 'Business'],
  ['Zero to One', 'Peter Thiel', 'Business'],
  ['Good to Great', 'Jim Collins', 'Business'],
  ['The Innovator’s Dilemma', 'Clayton Christensen', 'Business'],
  ['Astrophysics for People in a Hurry', 'Neil deGrasse Tyson', 'Physics'],
  ['The Code Book', 'Simon Singh', 'Mathematics'],

  ['The Disappearing Spoon', 'Sam Kean', 'Chemistry'],
  ['Periodic Tales', 'Hugh Aldersey-Williams', 'Chemistry'],
  ['Napoleon’s Buttons', 'Penny Le Couteur', 'Chemistry'],
  ['Uncle Tungsten', 'Oliver Sacks', 'Chemistry'],
  ['The Elements', 'Theodore Gray', 'Chemistry'],
  ['Molecules', 'Theodore Gray', 'Chemistry'],
  ['Chemistry: The Central Science', 'Theodore L. Brown', 'Chemistry'],
  ['Organic Chemistry', 'Jonathan Clayden', 'Chemistry'],
  ['The Feynman Lectures on Physics', 'Richard P. Feynman', 'Physics'],
  ['Surely You’re Joking, Mr. Feynman!', 'Richard P. Feynman', 'Physics'],
  ['The Elegant Universe', 'Brian Greene', 'Physics'],
  ['Seven Brief Lessons on Physics', 'Carlo Rovelli', 'Physics'],
  ['Black Holes and Baby Universes', 'Stephen Hawking', 'Physics'],
  ['Concepts of Physics', 'H. C. Verma', 'Physics'],
  ['Fermat’s Last Theorem', 'Simon Singh', 'Mathematics'],
  ['The Man Who Knew Infinity', 'Robert Kanigel', 'Mathematics'],
  ['How to Solve It', 'George Pólya', 'Mathematics'],
  ['A Mathematician’s Apology', 'G. H. Hardy', 'Mathematics'],
  ['Gödel, Escher, Bach', 'Douglas R. Hofstadter', 'Mathematics'],
  ['The Joy of x', 'Steven Strogatz', 'Mathematics'],
  ['The Origin of Species', 'Charles Darwin', 'Biology'],
  ['The Double Helix', 'James D. Watson', 'Biology'],
  ['Why We Sleep', 'Matthew Walker', 'Biology'],
  ['The Body', 'Bill Bryson', 'Biology'],
  ['Lab Girl', 'Hope Jahren', 'Biology'],
  ['Behave', 'Robert M. Sapolsky', 'Biology'],
  ['Code', 'Charles Petzold', 'Technology'],
  ['The Soul of a New Machine', 'Tracy Kidder', 'Technology'],
  ['Structure and Interpretation of Computer Programs', 'Harold Abelson', 'Technology'],
  ['The Art of Computer Programming', 'Donald E. Knuth', 'Technology'],
  ['Artificial Intelligence: A Modern Approach', 'Stuart Russell', 'Technology'],
  ['Site Reliability Engineering', 'Betsy Beyer', 'Technology'],
  ['Freedom at Midnight', 'Larry Collins', 'History'],
  ['The Argumentative Indian', 'Amartya Sen', 'History'],
  ['An Era of Darkness', 'Shashi Tharoor', 'History'],
  ['The Rise and Fall of the Third Reich', 'William L. Shirer', 'History'],
  ['A People’s History of the United States', 'Howard Zinn', 'History'],
  ['The Wright Brothers', 'David McCullough', 'History'],
  ['Built to Last', 'Jim Collins', 'Business'],
  ['The Hard Thing About Hard Things', 'Ben Horowitz', 'Business'],
  ['Shoe Dog', 'Phil Knight', 'Business'],
  ['Start with Why', 'Simon Sinek', 'Business'],
  ['Blue Ocean Strategy', 'W. Chan Kim', 'Business'],
  ['Elon Musk', 'Walter Isaacson', 'Biography'],
  ['Leonardo da Vinci', 'Walter Isaacson', 'Biography'],
  ['I Am Malala', 'Malala Yousafzai', 'Biography'],
  ['Playing It My Way', 'Sachin Tendulkar', 'Biography'],
  ['Open', 'Andre Agassi', 'Biography'],
  ['The Great Gatsby', 'F. Scott Fitzgerald', 'Novel'],
  ['One Hundred Years of Solitude', 'Gabriel García Márquez', 'Novel'],
  ['Crime and Punishment', 'Fyodor Dostoevsky', 'Novel'],
  ['Things Fall Apart', 'Chinua Achebe', 'Novel'],
]

const FIRST_NAMES = [
  'Rahul', 'Priya', 'Aman', 'Sneha', 'Karan', 'Anjali', 'Vikram', 'Meera',
  'Rohan', 'Divya', 'Arjun', 'Nisha', 'Siddharth', 'Pooja', 'Aditya', 'Kavya',
  'Manish', 'Ritu', 'Sanjay', 'Ishita', 'Nikhil', 'Tanvi', 'Harsh', 'Ananya',
  'Varun', 'Shreya', 'Deepak', 'Neha', 'Rajat', 'Simran',
]

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Nair', 'Iyer', 'Reddy', 'Gupta', 'Mehta',
  'Joshi', 'Chopra', 'Banerjee', 'Desai', 'Kulkarni', 'Rao', 'Malhotra', 'Bose',
]

const DAY = 86_400_000
const BORROW_DAYS = 14
const FINE_PER_DAY = 5
const FINE_CAP = 300

const startOfDay = (date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function buildLibrary() {
  const random = createRandom(SEED)
  const pick = (list) => list[Math.floor(random() * list.length)]
  const between = (min, max) => min + Math.floor(random() * (max - min + 1))

  const now = new Date()
  const today = startOfDay(now)

  const books = CATALOG.map(([title, author, category], index) => {
    const shelfNumber = between(1, 12)
    return {
      id: `bk_${index + 1}`,
      title,
      author,
      category,
      isbn: `978${String(1000000000 + Math.floor(random() * 8999999999)).slice(0, 10)}`,
      copies: COPIES_PER_TITLE,
      block: blockFor(category),
      shelfNumber,
      shelf: `${blockFor(category)}-${String(shelfNumber).padStart(2, '0')}`,
      condition: random() < 0.72 ? 'Good' : random() < 0.85 ? 'Fair' : 'Damaged',

      price: PRICES[title] ?? Math.round((180 + random() * 720) / 10) * 10,

      lost: random() < 0.08 ? 1 : 0,
      maintenance: random() < 0.1 ? 1 : 0,

      addedAt: (random() < 0.12
        ? new Date(today.getFullYear(), today.getMonth(), between(1, today.getDate()))
        : new Date(today.getTime() - between(40, 1080) * DAY)
      ).toISOString(),

      demand: 1 / (1 + index * 0.08) + random() * 0.35,
    }
  })

  const members = Array.from({ length: 200 }, (_, index) => {
    const joinedAt = new Date(today.getTime() - between(0, 730) * DAY)
    const first = pick(FIRST_NAMES)
    const last = pick(LAST_NAMES)
    const roll = random()

    return {
      id: `mb_${index + 1}`,
      name: `${first} ${last}`,

      membershipNumber: memberId(index + 1, joinedAt),
      joinedAt: joinedAt.toISOString(),

      expiresAt: addMonths(joinedAt, 6).toISOString(),

      idIssuedAt: new Date(joinedAt.getTime() + between(0, 3) * DAY).toISOString(),
      dob: new Date(
        today.getTime() - (between(9, 78) * 365 + between(0, 364)) * DAY,
      ).toISOString(),

      email: `${first}.${last}${index + 1}`.toLowerCase() + '@gmail.com',
      phone: `9${between(100000000, 899999999)}`,

      address: `${between(1, 240)}, Sector ${between(1, 5)}, Sohna, Gurugram, 122103`,

      active: true,
      avatar: null,
      appetite: 0.2 + random() * 1.6,
    }
  })

  const INACTIVE = 5
  const stride = Math.max(1, Math.floor(members.length / INACTIVE))
  for (let i = 0; i < INACTIVE; i += 1) {
    const member = members[i * stride]
    if (member) member.active = false
  }

  const demandTotal = books.reduce((sum, book) => sum + book.demand, 0)
  const pickBook = () => {
    let threshold = random() * demandTotal
    for (const book of books) {
      threshold -= book.demand
      if (threshold <= 0) return book
    }
    return books[books.length - 1]
  }

  const activeMembers = members.filter((member) => member.active)
  const appetiteTotal = activeMembers.reduce((sum, member) => sum + member.appetite, 0)
  const pickMember = () => {
    let threshold = random() * appetiteTotal
    for (const member of activeMembers) {
      threshold -= member.appetite
      if (threshold <= 0) return member
    }
    return activeMembers[activeMembers.length - 1]
  }

  const codeOf = (id) => `BOOK-${String(id).replace(/\D/g, '').padStart(3, '0')}`

  const borrowings = []
  const heldCopies = new Map()

  const held = []

  const releaseReturned = (dayTime) => {
    for (let i = held.length - 1; i >= 0; i -= 1) {
      if (held[i].releaseAt > dayTime) continue
      heldCopies.set(held[i].bookId, (heldCopies.get(held[i].bookId) ?? 1) - 1)
      held.splice(i, 1)
    }
  }

  const freeCopy = (book) => {
    const taken = new Set(held.filter((row) => row.bookId === book.id).map((row) => row.number))
    for (let number = 1; number <= book.copies; number += 1) {
      if (!taken.has(number)) return number
    }
    return null
  }

  const lendable = (book) => book.copies - (book.lost ?? 0) - (book.maintenance ?? 0)

  for (let dayOffset = 364; dayOffset >= 0; dayOffset -= 1) {
    const day = new Date(today.getTime() - dayOffset * DAY)
    const weekday = day.getDay()
    if (weekday === 0) continue

    releaseReturned(day.getTime())

    const seasonal = 1 + 0.22 * Math.sin((dayOffset / 365) * Math.PI * 2)
    const base = weekday === 6 ? 3 : 7
    const issueCount = Math.max(3, Math.round(base * seasonal + (random() - 0.5) * 8))

    for (let i = 0; i < issueCount; i += 1) {
      let book = null
      for (let attempt = 0; attempt < 12 && !book; attempt += 1) {
        const wanted = pickBook()
        if ((heldCopies.get(wanted.id) ?? 0) < lendable(wanted)) book = wanted
      }
      if (!book) continue

      const member = pickMember()
      const issuedAt = new Date(day.getTime() + (9 + random() * 9) * 3600_000)
      const dueAt = new Date(startOfDay(issuedAt).getTime() + BORROW_DAYS * DAY)

      const late = random() < 0.16
      const heldDays = late ? 15 + Math.round(random() * 20) : 3 + Math.round(random() * 11)
      const returnedDate = new Date(issuedAt.getTime() + heldDays * DAY)

      const abandoned = random() < 0.004
      const returned = !abandoned && returnedDate <= now

      let fine = 0
      let finePaid = false
      if (returned && startOfDay(returnedDate) > dueAt) {
        const lateDays = Math.round((startOfDay(returnedDate) - dueAt) / DAY)
        fine = Math.min(lateDays * FINE_PER_DAY, FINE_CAP)
        finePaid = random() < 0.72
      }

      const number = freeCopy(book)
      if (number === null) continue

      held.push({
        bookId: book.id,
        number,
        releaseAt: abandoned ? Infinity : startOfDay(returnedDate).getTime(),
      })
      heldCopies.set(book.id, (heldCopies.get(book.id) ?? 0) + 1)

      borrowings.push({
        id: `ln_${borrowings.length + 1}`,
        bookId: book.id,

        copyId: copyId(codeOf(book.id), number),
        copyNumber: number,
        memberId: member.id,
        issuedAt: issuedAt.toISOString(),
        dueAt: dueAt.toISOString(),
        returnedAt: returned ? returnedDate.toISOString() : null,
        fine,
        finePaid,
      })
    }
  }

  for (const borrowing of borrowings) {
    if (borrowing.returnedAt) continue
    const lateDays = Math.round((today - new Date(borrowing.dueAt)) / DAY)
    if (lateDays > 0) {
      borrowing.fine = Math.min(lateDays * FINE_PER_DAY, FINE_CAP)
      borrowing.finePaid = false
    }
  }

  const locations = buildLocations(CATEGORY_NAMES, blockFor)
  const copies = []
  let accession = 0

  for (const book of books) {
    for (let number = 1; number <= book.copies; number += 1) {
      accession += 1
      copies.push({
        id: copyId(codeOf(book.id), number),
        copyId: copyId(codeOf(book.id), number),
        bookId: book.id,
        number,
        accession: accessionOf(accession),

        barcode: `8${String(900000000 + accession * 7919).slice(0, 11)}`,
        locationId: locationId('Central', floorFor(book.block), book.block, book.shelfNumber),
        condition: book.condition,
        acquiredAt: book.addedAt,
      })
    }
  }

  const reservations = Array.from({ length: between(18, 26) }, (_, index) => {
    const book = pickBook()
    return {
      id: `rs_${index + 1}`,
      bookId: book.id,
      memberId: pickMember().id,
      placedAt: new Date(today.getTime() - between(0, 9) * DAY).toISOString(),
      status: index < 4 ? 'ready' : 'waiting',
    }
  })

  const events = [
    { date: addDays(today, 2), label: 'Reading circle — Fiction', kind: 'event' },
    { date: addDays(today, 5), label: 'Stock verification', kind: 'event' },
    { date: addDays(today, 9), label: 'Independence Day — closed', kind: 'holiday' },
    { date: addDays(today, -3), label: 'New arrivals shelved', kind: 'event' },
  ]

  return { books, copies, locations, members, borrowings, reservations, events, generatedAt: new Date().toISOString() }
}

function addMonths(date, months) {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY).toISOString()
}

export { buildLibrary }

export const library = buildLibrary()

export let librarySource = 'generated'

export function replaceLibrary(next, source = 'mongodb') {
  for (const key of ['books', 'copies', 'locations', 'members', 'borrowings', 'reservations', 'events']) {
    if (!Array.isArray(next?.[key])) continue
    library[key].length = 0
    library[key].push(...next[key])
  }
  library.generatedAt = next?.generatedAt ?? library.generatedAt
  librarySource = source
  return library
}
