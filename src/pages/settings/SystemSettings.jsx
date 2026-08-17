// Dates, currency, page sizes and other system-wide preferences.

import {
  CURRENCIES,
  DATE_FORMATS,
  TIMEZONES,
  TIME_FORMATS,
} from '../../lib/settings.js'
import {
  Card,
  Group,
  SaveBar,
  Fixed,
  SelectSetting,
  TextSetting,
  Toggle,
  ToggleList,
  useSection,
} from '../../components/settings/SettingsKit.jsx'

export default function SystemSettings() {
  const state = useSection('system')
  const { draft, set } = state

  return (
    <>
      <Group title="Date, time & currency" subtitle="Applied everywhere dates and money appear.">
        <SelectSetting
          label="Date format"
          value={draft.dateFormat}
          onChange={(v) => set('dateFormat', v)}
          options={DATE_FORMATS.map((f) => ({ value: f.value, label: `${f.label} — ${f.hint}` }))}
        />
        <SelectSetting
          label="Time format"
          value={draft.timeFormat}
          onChange={(v) => set('timeFormat', v)}
          options={TIME_FORMATS}
        />

        <Fixed label="Currency" value={CURRENCIES[0].label} />
        <Fixed label="Time zone" value={TIMEZONES[0]} />
      </Group>

      <Group title="Appearance & navigation">
        <SelectSetting
          label="Rows per page"
          hint="The default for every table."
          value={String(draft.pageSize)}
          onChange={(v) => set('pageSize', Number(v))}
          options={['10', '25', '50', '100'].map((n) => ({ value: n, label: n }))}
        />
        <SelectSetting
          label="Default report period"
          value={draft.reportPeriod}
          onChange={(v) => set('reportPeriod', v)}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This week' },
            { value: 'month', label: 'This month' },
            { value: 'quarter', label: 'Last 3 months' },
            { value: 'halfYear', label: 'Last 6 months' },
            { value: 'year', label: 'This year' },
          ]}
        />
        <TextSetting
          label="Automatic logout (minutes)"
          type="number"
          min="0"
          step="5"
          value={draft.autoLogoutMinutes}
          onChange={(v) => set('autoLogoutMinutes', Math.max(0, v))}
        />
      </Group>

      <Card title="Behaviour">
        <ToggleList>
          <Toggle
            label="Confirm before deleting"
            hint="Ask before removing a member, book, fine or repair."
            checked={draft.confirmDestructive}
            onChange={(v) => set('confirmDestructive', v)}
          />
        </ToggleList>
      </Card>

      <SaveBar state={state} title="system" />
    </>
  )
}
