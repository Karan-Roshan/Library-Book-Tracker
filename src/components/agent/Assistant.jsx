// The assistant panel: ask a question, or jump straight to a page.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatCurrency, formatDate } from '../../lib/format.js'
import { suggestionsFor } from '../../lib/agent/tools.js'
import {
  destinationsFor,
  groupDestinations,
  matchDestinations,
} from '../../lib/agent/destinations.js'
import { can } from '../../lib/permissions.js'
import { ask } from '../../services/agent/index.js'
import { snapshot } from '../../services/agent/execute.js'
import { modelReady } from '../../services/agent/interpret.js'
import Answer from './Answer.jsx'

export default function Assistant({ open, onClose, prompt = null, onConsumed }) {
  const { user } = useAuth()
  const { locale, system } = usePreferences()

  const [turns, setTurns] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [model, setModel] = useState(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  const suggestions = useMemo(() => suggestionsFor(user?.role), [user?.role])

  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const places = useMemo(() => destinationsFor(user, can), [user])
  const groups = useMemo(() => groupDestinations(places), [places])

  const matches = useMemo(() => matchDestinations(input, places), [input, places])

  const go = useCallback(
    (place) => {
      setMenuOpen(false)
      setInput('')
      onClose?.()
      navigate(place.to)
    },
    [navigate, onClose],
  )

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      modelReady().then(setModel)
    }
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, busy])

  const run = useCallback(
    async (text, confirmed = null) => {
      if (!text.trim() && !confirmed) return
      setBusy(true)

      if (!confirmed) setTurns((current) => [...current, { role: 'user', text }])

      try {
        const world = await snapshot()
        const result = await ask(text, { user, world, confirmed })
        setTurns((current) => [...current, { role: 'assistant', result, asked: text }])
      } catch (error) {
        setTurns((current) => [
          ...current,
          { role: 'assistant', result: { status: 'error', message: error.message } },
        ])
      } finally {
        setBusy(false)
        setInput('')
        inputRef.current?.focus()
      }
    },
    [user],
  )

  useEffect(() => {
    if (!open || !prompt) return
    run(prompt)
    onConsumed?.()
  }, [open, prompt])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close the assistant"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Athenaeum assistant"
        className="animate-rise relative flex h-full w-full max-w-lg flex-col border-l border-ink-100 bg-parchment shadow-2xl dark:border-ink-800 dark:bg-ink-950"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-100 bg-white px-5 py-4 dark:border-ink-800 dark:bg-ink-900">
          <div>
            <h2 className="font-display text-lg text-ink-900 dark:text-white">Athenaeum Assistant</h2>
            <p className="mt-0.5 text-xs text-ink-400">
              {model
                ? 'Ask in your own words — it works to your permissions.'
                : 'Ask in your own words. It works to your permissions.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                menuOpen
                  ? 'bg-brass-100 text-brass-900 dark:bg-brass-500/20 dark:text-brass-200'
                  : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800 dark:text-ink-300 dark:hover:bg-ink-800'
              }`}
            >
              {menuOpen ? 'Hide menu' : 'Menu'}
            </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          </div>
        </header>

        {menuOpen && (
          <div className="max-h-72 shrink-0 overflow-y-auto border-b border-ink-100 bg-white px-5 py-4 dark:border-ink-800 dark:bg-ink-900">
            {groups.map(({ group, items }) => (
              <div key={group} className="mb-4 last:mb-0">
                <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-400">
                  {group}
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {items.map((place) => (
                    <button
                      key={place.key}
                      type="button"
                      onClick={() => go(place)}
                      className="rounded-lg border border-ink-100 px-3 py-2 text-left transition-colors hover:border-brass-300 hover:bg-brass-50 dark:border-ink-800 dark:hover:border-brass-500/40 dark:hover:bg-ink-800"
                    >
                      <span className="block text-sm font-medium text-ink-800 dark:text-ink-100">
                        {place.label}
                      </span>
                      <span className="block text-xs text-ink-400">{place.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {turns.length === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-ink-500 dark:text-ink-400">
                I can look things up and carry out desk operations for you — always through the same
                rules and permissions as the rest of Athenaeum. Anything that changes records asks
                you first.
              </p>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-400">
                  Try asking
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => run(suggestion)}
                      className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-600 transition-colors hover:border-brass-300 hover:bg-brass-50 hover:text-brass-800 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {turns.map((turn, index) =>
            turn.role === 'user' ? (
              <p
                key={index}
                className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-ink-900 px-4 py-2.5 text-sm text-white dark:bg-brass-600"
              >
                {turn.text}
              </p>
            ) : (
              <Answer
                key={index}
                result={turn.result}
                asked={turn.asked}
                locale={locale}
                system={system}
                busy={busy}
                onRun={run}
                onClose={onClose}
              />
            ),
          )}

          {busy && (
            <p className="text-sm text-ink-400" role="status">
              Looking…
            </p>
          )}
          <div ref={endRef} />
        </div>

        {matches.length > 0 && !menuOpen && (
          <div className="shrink-0 border-t border-ink-100 bg-brass-50/60 px-4 py-2.5 dark:border-ink-800 dark:bg-ink-800/60">
            <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Go straight to
            </p>
            <div className="flex flex-wrap gap-1.5">
              {matches.map((place) => (
                <button
                  key={place.key}
                  type="button"
                  onClick={() => go(place)}
                  title={place.hint}
                  className="rounded-full border border-brass-300 bg-white px-3 py-1.5 text-sm font-medium text-brass-900 transition-colors hover:bg-brass-100 dark:border-brass-500/40 dark:bg-ink-900 dark:text-brass-200 dark:hover:bg-ink-800"
                >
                  {place.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault()
            run(input)
          }}
          className="shrink-0 border-t border-ink-100 bg-white px-4 py-3 dark:border-ink-800 dark:bg-ink-900"
        >
          <div className="flex items-end gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                user?.role === 'member' ? 'What books do I have?' : 'Show today’s overdue books'
              }
              className="flex-1 rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-white"
              aria-label="Ask the assistant"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500 disabled:cursor-not-allowed disabled:bg-brass-200"
            >
              Ask
            </button>
          </div>

          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => setTurns([])}
              className="mt-2 text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
            >
              Clear conversation
            </button>
          )}
        </form>
      </aside>
    </div>
  )
}
