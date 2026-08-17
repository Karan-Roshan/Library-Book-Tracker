// Where the data lives, how much there is, and when it last changed.

import { formatDate, formatNumber, formatTime } from '../../lib/format.js'

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function StatusPill({ tone, children }) {
  const styles = {
    good: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
    muted: 'bg-ink-50 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
  }
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${styles[tone]}`}>
      {children}
    </span>
  )
}

export default function SystemHealth({ health, activeStaff, locale }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-ink-500 dark:text-ink-400">Total storage</span>
          <span className="text-sm font-semibold tabular-nums text-ink-900 dark:text-white">
            {formatBytes(health.usedBytes)}{' '}
            <span className="font-normal text-ink-400">of {formatBytes(health.quotaBytes)}</span>
          </span>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--viz-seq-100)]">
          <div
            className="h-full rounded-full bg-[var(--viz-seq-550)] transition-[width] duration-500"
            style={{ width: `${Math.max(1, health.usedPercent)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-ink-400">
          {health.usedPercent.toFixed(1)}% of the database allowance
        </p>
      </div>

      <dl className="space-y-2.5 border-t border-ink-50 pt-4 text-sm dark:border-ink-800">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-500 dark:text-ink-400">Database</dt>
          <dd className="flex items-center gap-2">
            <span className="text-ink-700 dark:text-ink-200">{health.driver}</span>
            <StatusPill tone="good">Online</StatusPill>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-500 dark:text-ink-400">Backup</dt>
          <dd>
            <StatusPill tone="warning">{health.backup}</StatusPill>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-500 dark:text-ink-400">Last sync</dt>
          <dd className="tabular-nums text-ink-700 dark:text-ink-200">
            {formatDate(health.lastSync, locale)}, {formatTime(health.lastSync, locale)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-500 dark:text-ink-400">Records held</dt>
          <dd className="tabular-nums text-ink-700 dark:text-ink-200">
            {formatNumber(health.records, locale)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-500 dark:text-ink-400">Active staff</dt>
          <dd className="tabular-nums text-ink-700 dark:text-ink-200">
            {formatNumber(activeStaff, locale)}
          </dd>
        </div>
      </dl>
    </div>
  )
}
