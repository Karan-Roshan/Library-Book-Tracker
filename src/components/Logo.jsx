// The Athenaeum mark, and the mark with its name beside it.

export default function Logo({ className = 'h-8 w-8' }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="Athenaeum"
    >
      <path
        d="M16 9.2c-2.4-1.8-5.2-2.7-8.5-2.7H4.2v17.5h3.3c3.3 0 6.1.9 8.5 2.7 2.4-1.8 5.2-2.7 8.5-2.7h3.3V6.5h-3.3c-3.3 0-6.1.9-8.5 2.7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M16 9.2v17.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M8 13h4M8 17h4M20 13h4M20 17h4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  )
}

const SIZES = {
  md: { mark: 'h-7 w-7', gap: 'gap-2.5', text: 'text-[1.35rem] font-normal' },
  lg: { mark: 'h-11 w-11', gap: 'gap-4', text: 'text-[2.75rem] font-bold' },
}

export function Wordmark({ tone = 'dark', size = 'md' }) {
  const color = tone === 'light' ? 'text-brass-300' : 'text-brass-600'
  const text = tone === 'light' ? 'text-white' : 'text-ink-900'
  const scale = SIZES[size]

  return (
    <span className={`inline-flex items-center ${scale.gap}`}>
      <Logo className={`${scale.mark} ${color}`} />
      <span className={`font-display leading-none tracking-tight ${scale.text} ${text}`}>
        Athenaeum
      </span>
    </span>
  )
}
