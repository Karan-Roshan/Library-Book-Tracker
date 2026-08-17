// The desk buttons carried across the counter pages.

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Action } from './Shared.jsx'

export function useOpenOnArrival(open) {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!location.state?.openCounter) return
    open()
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate, open])
}

const DESK = [
  { key: 'issue', label: 'Issue book', to: '/circulation/issue' },
  { key: 'return', label: 'Return book', to: '/circulation/return' },
]

export default function CounterActions({ here, onOpen }) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-wrap items-center gap-2">
      {DESK.map((action) => (
        <Action
          key={action.key}

          tone={action.key === here ? 'gold' : 'ink'}
          onClick={() =>
            action.key === here ? onOpen() : navigate(action.to, { state: { openCounter: true } })
          }
        >
          {action.label}
        </Action>
      ))}
    </div>
  )
}
