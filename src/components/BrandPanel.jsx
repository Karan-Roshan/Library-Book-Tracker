// The library's name and mark, on the side of the sign-in screen.

import { Wordmark } from './Logo.jsx'

export default function BrandPanel() {
  return (
    <aside className="spine-pattern relative hidden overflow-hidden bg-ink-950 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-32 h-[26rem] w-[26rem] rounded-full bg-brass-500/12 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-24 h-[24rem] w-[24rem] rounded-full bg-ink-400/10 blur-3xl"
      />

      <div className="relative mt-16 xl:mt-20">
        <div className="text-left">
          <Wordmark tone="light" size="lg" />
        </div>

        <div className="mt-3 max-w-lg">
          <p className="mb-20 text-xs font-semibold uppercase tracking-[0.18em] text-brass-400">
            Library Management System
          </p>
          <h1 className="font-display text-[2.6rem] leading-[1.12] text-white xl:text-[3rem]">
            The quiet infrastructure behind a
            <span className="text-brass-300"> well-run library</span>.
          </h1>
        </div>
      </div>

      <figure className="relative border-l-2 border-brass-500/40 pl-5">
        <blockquote className="font-display text-lg italic leading-snug text-ink-200">
          “A library is not a luxury but one of the necessities of life.”
        </blockquote>
        <figcaption className="mt-2 text-sm text-ink-300">- Henry Ward Beecher</figcaption>
      </figure>
    </aside>
  )
}
