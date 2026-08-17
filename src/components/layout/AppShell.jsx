// The frame every signed-in screen sits in: sidebar, topbar, assistant.

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import Assistant from '../agent/Assistant.jsx'
import StorageNotice from './StorageNotice.jsx'

export default function AppShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantPrompt, setAssistantPrompt] = useState(null)
  const { pathname } = useLocation()

  useEffect(() => setDrawerOpen(false), [pathname])

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setAssistantOpen((open) => !open)
      }
      if (event.key === 'Escape') setAssistantOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const handler = (event) => {
      setAssistantPrompt(event.detail?.prompt ?? null)
      setAssistantOpen(true)
    }
    window.addEventListener('athenaeum:ask', handler)
    return () => window.removeEventListener('athenaeum:ask', handler)
  }, [])

  return (
    <div className="min-h-dvh bg-parchment dark:bg-ink-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-ink-950/60"
          />
          <div className="animate-fade absolute inset-y-0 left-0 w-64 shadow-2xl">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <StorageNotice />
        <Topbar onOpenSidebar={() => setDrawerOpen(true)} />

        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>

      <button
        type="button"
        onClick={() => setAssistantOpen(true)}
        aria-label="Open the assistant (⌘K)"
        className="no-print fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ink-900 text-white shadow-lg transition-transform hover:scale-105 hover:bg-ink-800 dark:bg-brass-600 dark:hover:bg-brass-500"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path
            d="M12 3.5c-4.4 0-8 3-8 6.8 0 2.1 1.1 4 2.9 5.2L6 20l4-2a10 10 0 002 .2c4.4 0 8-3 8-6.9s-3.6-6.8-8-6.8z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="10.3" r="1" fill="currentColor" />
          <circle cx="12" cy="10.3" r="1" fill="currentColor" />
          <circle cx="15" cy="10.3" r="1" fill="currentColor" />
        </svg>
      </button>

      <Assistant
        open={assistantOpen}
        prompt={assistantPrompt}
        onConsumed={() => setAssistantPrompt(null)}
        onClose={() => {
          setAssistantOpen(false)
          setAssistantPrompt(null)
        }}
      />
    </div>
  )
}
