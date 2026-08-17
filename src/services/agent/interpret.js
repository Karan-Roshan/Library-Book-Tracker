// Asks the language model what a sentence means, when one is configured.

import { resolve } from '../../lib/agent/resolve.js'
import { describeTools, toolsFor } from '../../lib/agent/tools.js'
import { can } from '../../lib/permissions.js'

const API = import.meta.env?.VITE_API_URL ?? '/api'

let modelAvailable = null

// Whether a language model is configured at all.
export async function modelReady() {
  if (modelAvailable !== null) return modelAvailable
  try {
    const response = await fetch(`${API}/agent/status`, { signal: AbortSignal.timeout(2000) })
    const body = await response.json()
    modelAvailable = Boolean(body?.model)
  } catch {
    modelAvailable = false
  }
  return modelAvailable
}

function systemPrompt(user, world) {
  const tools = toolsFor(user, can)

  return [
    `You translate a library user's request into exactly one tool call.`,
    `The user is ${user.name}, signed in as ${user.role}.`,
    ``,
    `Available tools:`,
    describeTools(tools),
    ``,
    `Book titles and member names should be passed through roughly as the user`,
    `said them — the system resolves them against the catalogue itself.`,
    ``,
    `Reply with JSON only: {"tool": "<name>", "args": { ... }}`,
    `If the request does not fit any tool, reply {"unresolved": true, "suggestion": "<what they could ask instead>"}.`,
  ].join('\n')
}

// Asks the model what a sentence means, and returns the tool it names.
export async function interpret(text, { user, world }) {
  const local = resolve(text, { role: user.role })
  if (!local.unresolved) return local

  if (!(await modelReady())) return local

  try {
    const response = await fetch(`${API}/agent/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: systemPrompt(user, world), message: text }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!response.ok) return local
    const body = await response.json()
    if (!body?.tool) return { ...local, suggestion: body?.suggestion ?? null }

    return { tool: body.tool, args: body.args ?? {}, source: 'model' }
  } catch {
    return local
  }
}
