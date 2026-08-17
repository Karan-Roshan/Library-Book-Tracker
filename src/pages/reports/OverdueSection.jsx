// The overdue figures, inside the circulation report.

import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatCurrency, formatDate } from '../../lib/format.js'
import Card from '../../components/dashboard/Card.jsx'
import { ReportTable } from '../../components/reports/ReportKit.jsx'
import { SELECT, SELECT_ARROW } from '../../components/circulation/Shared.jsx'
import { OVERDUE_BANDS } from '../../lib/reports.js'

export default function OverdueSection({ report, band, onBand, category, onCategory, categories }) {
  const { locale } = usePreferences()

  return (
    <Card
      title="Overdue books"
      subtitle={`${report.count} out past their due date · ${formatCurrency(report.fines, locale)} accruing`}
      padded={false}
    >
      <div className="no-print flex flex-wrap items-center gap-3 px-4 py-3">
        <select
          value={band}
          onChange={(event) => onBand(event.target.value)}
          style={SELECT_ARROW}
          className={`${SELECT} w-44`}
          aria-label="How overdue"
        >
          {OVERDUE_BANDS.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.label}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(event) => onCategory(event.target.value)}
          style={SELECT_ARROW}
          className={`${SELECT} w-48`}
          aria-label="Category"
        >
          <option value="all">All categories</option>
          {categories.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-ink-400">
          {report.reminded} of {report.count} already reminded
        </span>
      </div>

      <ReportTable
        columns={[
          { label: 'Member', render: (row) => `${row.memberName} · ${row.memberNumber}` },
          { label: 'Book', render: (row) => row.bookTitle },
          { label: 'Copy', render: (row) => row.book?.code ?? '—' },
          { label: 'Issued', render: (row) => formatDate(row.issuedAt, locale) },
          { label: 'Due', render: (row) => formatDate(row.dueAt, locale) },
          { label: 'Days overdue', align: 'right', render: (row) => row.daysOverdue },
          { label: 'Fine', align: 'right', render: (row) => formatCurrency(row.fine, locale) },
          { label: 'Reminded', render: (row) => (row.remindedAt ? formatDate(row.remindedAt, locale) : 'No') },
        ]}
        rows={report.rows.slice(0, 100).map((row) => ({ ...row, key: row.id }))}
        empty="Nothing is overdue."
      />
    </Card>
  )
}
