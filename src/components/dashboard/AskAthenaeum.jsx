// Suggested questions that open the assistant already asking.

import { suggestionsFor } from '../../lib/agent/tools.js'
import { useAuth } from '../../context/AuthContext.jsx'

export default function AskAthenaeum() {
  const { user } = useAuth()
  const prompts = suggestionsFor(user?.role).slice(0, 5)

  const ask = (prompt) =>
    window.dispatchEvent(new CustomEvent('athenaeum:ask', { detail: { prompt } }))

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-sm dark:border-ink-800 dark:bg-ink-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg text-ink-900 dark:text-white">Ask Athenaeum</p>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            Ask in your own words — it works to your permissions.
          </p>
        </div>
        <kbd className="hidden rounded-md border border-ink-200 px-2 py-1 text-xs text-ink-400 sm:block dark:border-ink-700">
          ⌘K
        </kbd>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => ask(prompt)}
            className="rounded-full border border-ink-200 bg-white px-3.5 py-2 text-sm text-ink-600 transition-colors hover:border-brass-300 hover:bg-brass-50 hover:text-brass-800 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
