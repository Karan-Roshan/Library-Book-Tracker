// Takes a question to the assistant and brings back an answer.

import { TOOLS, RISK, toolsFor } from '../../lib/agent/tools.js'
import { can } from '../../lib/permissions.js'
import { record } from '../activity.js'
import { AgentError, EXECUTORS, pin, snapshot } from './execute.js'
import { interpret } from './interpret.js'

export { AgentError }

// Takes a question, works out what it means, checks permission, and answers.
export async function ask(text, { user, world: given, confirmed = null } = {}) {
  const world = given ?? (await snapshot())

  const call = confirmed ?? (await interpret(text, { user, world }))

  if (call.unresolved) {
    return {
      status: 'unresolved',
      text,
      suggestion: call.suggestion ?? null,
      available: toolsFor(user, can).map((tool) => tool.summary),
    }
  }

  const tool = TOOLS[call.tool]
  if (!tool) {
    return { status: 'unresolved', text, reason: 'unknown-tool' }
  }

  if (tool.capability && !can(user, tool.capability)) {
    await record('AGENT_REFUSED', {
      target: call.tool,
      targetType: 'assistant',
      status: 'Failed',
      reason: 'Not permitted for this role',
      after: { asked: text },
      as: {
        staffId: user.id,
        staffName: user.name,
        staffNumber: user.membershipNumber ?? null,
        email: user.email ?? null,
        role: user.role,
      },
    })

    return {
      status: 'refused',
      tool: call.tool,
      message:
        user.role === 'member'
          ? 'That is library information rather than something on your own account, so I cannot show it to you.'
          : 'You do not have permission for that. An administrator does.',
    }
  }

  let subject = null
  if (tool.scope === 'self') {
    subject = world.members.find((row) => row.id === user.memberId)
    if (!subject) {
      return { status: 'error', message: 'I could not find your membership record.' }
    }
  }

  const actor = {
    user,

    label: `Assistant (for ${user.name})`,

    as: {
      staffId: user.id,
      staffName: user.name,
      staffNumber: user.membershipNumber ?? null,
      email: user.email ?? null,
      role: user.role,
    },
  }

  let pinned
  try {
    pinned = pin(call, world)
  } catch (error) {
    if (error instanceof AgentError) {
      return {
        status: 'clarify',
        tool: call.tool,
        message: error.message,
        alternatives: error.alternatives,
        field: error.field,
      }
    }
    throw error
  }

  if (tool.risk === RISK.CONFIRM && !confirmed) {
    const preview = await describe(pinned, { world, subject, user })
    return {
      status: 'confirm',
      tool: call.tool,
      args: call.args,

      preview,

      pending: pinned,
    }
  }

  try {
    const executor = EXECUTORS[call.tool]
    if (!executor) return { status: 'error', message: 'That tool is not implemented yet.' }

    const data = await executor(pinned.args, { world, subject, actor, user })

    if (tool.risk !== RISK.READ && data.kind !== 'refused') {
      await record('AGENT_ACTION', {
        target: call.tool,
        targetType: 'assistant',
        reason: text,
        after: { ...data, kind: undefined, via: 'Assistant', confirmed: Boolean(confirmed) },
        as: actor.as,
      })
    }

    return { status: 'ok', tool: call.tool, args: pinned.args, data, source: call.source }
  } catch (error) {
    if (error instanceof AgentError) {
      return {
        status: 'clarify',
        tool: call.tool,
        message: error.message,
        alternatives: error.alternatives,
        field: error.field,
      }
    }
    return { status: 'error', message: error.message }
  }
}

async function describe(call, { world, subject }) {
  const { matchBook, matchMember } = await import('../../lib/agent/resolve.js')

  const book = call.args.title ? matchBook(call.args.title, world.books).match : null
  const member = call.args.member
    ? matchMember(call.args.member, world.members).match
    : subject

  switch (call.tool) {
    case 'issue_book':
      return {
        title: 'Issue this book?',
        lines: [
          ['Book', book ? `${book.title} (${book.code})` : call.args.title],
          ['Member', member ? `${member.name} · ${member.membershipNumber}` : call.args.member],
          ['Borrowing length', `${world.rules.borrowDays} days`],
          ['On the shelf', book ? `${book.available} of ${book.copies}` : '—'],
        ],
      }

    case 'return_book':
      return {
        title: 'Take this book back?',
        lines: [
          ['Book', book?.title ?? call.args.title],
          ['Member', member?.name ?? call.args.member],
          ['Condition', call.args.condition ?? 'Good'],
        ],
      }

    case 'report_damage':
      return {
        title: 'Take this copy off the shelf?',
        lines: [
          ['Book', book?.title ?? call.args.title],
          ['Damage', call.args.damageType ?? 'Torn pages'],
          ['Severity', call.args.severity ?? 'Moderate'],
          ['Effect', 'The copy cannot be issued until the repair is finished.'],
        ],
      }

    case 'update_fine_rate':
      return {
        title: 'Change the library’s fine policy?',
        lines: [
          ['Setting', 'Overdue fine per day'],
          ['Currently', `₹${world.settings.finance.finePerDay}`],
          ['Would become', `₹${call.args.amount}`],
          ['Affects', 'Every unpaid overdue charge is re-priced at the new rate.'],
        ],
        severe: true,
      }

    default:
      return { title: 'Go ahead?', lines: Object.entries(call.args).map(([k, v]) => [k, String(v)]) }
  }
}
