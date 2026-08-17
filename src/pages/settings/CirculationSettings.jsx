// Borrowing lengths, limits, renewals and fine rates.

import {
  Card,
  Group,
  SaveBar,
  TextSetting,
  Toggle,
  ToggleList,
  useSection,
} from '../../components/settings/SettingsKit.jsx'
import { LABEL } from '../../components/circulation/Shared.jsx'

export default function CirculationSettings() {
  const state = useSection('circulation')
  const { draft, set } = state

  return (
    <>
      <Group title="Lending terms" columns={2}>
        <TextSetting
          label="Days length"
          type="number"
          min="1"
          value={draft.borrowDays}
          onChange={(v) => set('borrowDays', Math.max(1, v))}
        />
        <TextSetting
          label="Books at once"
          type="number"
          min="0"
          value={draft.maxBooks}
          onChange={(v) => set('maxBooks', Math.max(0, v))}
        />
      </Group>

      <Card title="Who may borrow">
        <ToggleList>
          <Toggle
            label="New members can borrow immediately"
            hint="Off means a card registered today cannot be used until tomorrow."
            checked={draft.borrowImmediately}
            onChange={(v) => set('borrowImmediately', v)}
          />
          <Toggle
            label="Members with an overdue book may borrow"
            hint="Off blocks any further borrowing until the late book comes back."
            checked={draft.borrowWhenOverdue}
            onChange={(v) => set('borrowWhenOverdue', v)}
          />
        </ToggleList>
      </Card>

      <SaveBar state={state} title="circulation" />
    </>
  )
}
