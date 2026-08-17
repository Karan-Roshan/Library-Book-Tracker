// The library's name, branch and opening days.

import { WEEKDAYS } from '../../lib/settings.js'
import {
  Card,
  Fixed,
  Group,
  SaveBar,
  TextSetting,
  useSection,
} from '../../components/settings/SettingsKit.jsx'
import { INPUT, LABEL } from '../../components/circulation/Shared.jsx'
import TimeField from '../../components/TimeField.jsx'

export default function LibrarySettings() {
  const state = useSection('library')
  const { draft, set, toggleIn, setDraft } = state

  return (
    <>
      <Group title="Identity" subtitle="Appears on notifications, reports and receipts." columns={2}>

        <Fixed label="Library name" value={draft.name} />
        <TextSetting label="Branch" value={draft.branch} onChange={(v) => set('branch', v)} />

        <Fixed label="Tagline" value={draft.tagline} className="sm:col-span-2" />
      </Group>

      <Card title="Description">
        <div className="p-5">
          <label htmlFor="library-description" className={LABEL}>
            About this library
          </label>
          <textarea
            id="library-description"
            rows={3}
            value={draft.description ?? ''}
            onChange={(event) => set('description', event.target.value)}
            className={INPUT}
          />
        </div>
      </Card>

      <Group title="Contact" columns={2}>
        <TextSetting label="Address" value={draft.address} onChange={(v) => set('address', v)} />
        <TextSetting label="Phone" value={draft.phone} onChange={(v) => set('phone', v)} />
        <TextSetting label="Email" type="email" value={draft.email} onChange={(v) => set('email', v)} />
        <TextSetting label="Website" value={draft.website} onChange={(v) => set('website', v)} />
      </Group>

      <Card title="Opening hours" subtitle="Used when working out reminder timing and due dates.">
        <div className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TimeField label="Opens at" value={draft.opensAt} onChange={(v) => set('opensAt', v)} />
            <TimeField label="Closes at" value={draft.closesAt} onChange={(v) => set('closesAt', v)} />
          </div>

          <div>
            <p className={LABEL}>Open days</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const on = draft.openDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleIn('openDays', day, WEEKDAYS)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      on
                        ? 'border-brass-300 bg-brass-50 text-brass-800 dark:border-brass-500/40 dark:bg-brass-500/10 dark:text-brass-300'
                        : 'border-ink-200 text-ink-400 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-xs text-ink-400">
              {draft.openDays.length === 0
                ? 'The library is marked closed every day.'
                : `Open ${draft.openDays.length} days a week.`}
            </p>
          </div>
        </div>
      </Card>

      <SaveBar state={state} title="library" />
    </>
  )
}
