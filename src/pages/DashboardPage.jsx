// The staff dashboard: the day's figures and what needs attention.

import { useEffect, useMemo, useState } from 'react'
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx'
import Card, { ViewToggle } from '../components/dashboard/Card.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import Greeting from '../components/dashboard/Greeting.jsx'
import NeedsAttention from '../components/dashboard/NeedsAttention.jsx'
import AskAthenaeum from '../components/dashboard/AskAthenaeum.jsx'
import RecentActivity from '../components/dashboard/RecentActivity.jsx'
import NotificationsPanel from '../components/dashboard/NotificationsPanel.jsx'
import PopularBooks from '../components/dashboard/PopularBooks.jsx'
import TodaySummary from '../components/dashboard/TodaySummary.jsx'
import ActiveMembers from '../components/dashboard/ActiveMembers.jsx'
import DueToday from '../components/dashboard/DueToday.jsx'
import CalendarWidget from '../components/dashboard/CalendarWidget.jsx'
import SystemHealth from '../components/dashboard/SystemHealth.jsx'
import DonutChart from '../components/charts/DonutChart.jsx'
import GroupedBarChart from '../components/charts/GroupedBarChart.jsx'
import HorizontalBarChart from '../components/charts/HorizontalBarChart.jsx'
import AreaChart from '../components/charts/AreaChart.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { library } from '../data/demoLibrary.js'
import * as analytics from '../lib/analytics.js'
import { formatCompact, formatCurrency, formatNumber } from '../lib/format.js'
import { CAPABILITIES, allowed, can } from '../lib/permissions.js'
import { inboxFor, isUnread } from '../lib/messages.js'
import * as messagesService from '../services/messages.js'
import * as repairsService from '../services/repairs.js'
import * as circulation from '../services/circulation.js'
import { isOpen } from '../lib/repairs.js'

function ChartCard({ title, subtitle, children, className }) {
  const [view, setView] = useState('chart')
  return (
    <Card
      title={title}
      subtitle={subtitle}
      className={className}
      action={<ViewToggle view={view} onChange={setView} />}
    >
      {children(view)}
    </Card>
  )
}

export default function DashboardPage() {
  const [unreadMessages, setUnreadMessages] = useState([])
  const [openRepairs, setOpenRepairs] = useState(0)
  const [openLosses, setOpenLosses] = useState(0)

  const { user } = useAuth()
  const { locale } = usePreferences()

  useEffect(() => {
    messagesService.listMessages().then((rows) => {
      setUnreadMessages(
        inboxFor(rows, user.id).filter((message) => isUnread(message, user.id)).slice(0, 3),
      )
    })
  }, [user.id])

  useEffect(() => {
    repairsService
      .listRepairs()
      .then((rows) => setOpenRepairs(rows.filter((row) => isOpen(row)).length))
  }, [])

  useEffect(() => {
    circulation
      .listLostReports()
      .then((rows) => setOpenLosses(rows.filter((row) => !row.recoveredAt).length))
  }, [])

  const now = useMemo(() => new Date(), [])
  const data = useMemo(
    () => ({
      stats: analytics.summarize(library, now),
      status: analytics.bookStatus(library, now),
      monthly: analytics.monthlyTransactions(library, now),
      categories: analytics.categoryBorrows(library),
      weekly: analytics.weeklyActivity(library, now),
      today: analytics.todaySummary(library, now),
      activity: analytics.recentActivity(library, now),
      popular: analytics.popularBooks(library),
      active: analytics.mostActiveMembers(library),
      due: analytics.dueToday(library, now),
      calendar: analytics.calendarMonth(library, now),
      health: analytics.systemHealth(library),
    }),
    [now],
  )

  const { stats } = data

  const cards = allowed(user, [
    { label: 'Total Books', value: formatCompact(stats.totalBooks, locale), hint: 'Copies held' },
    { label: 'Available Books', value: formatCompact(stats.available, locale), tone: 'good', hint: 'On the shelf now' },
    { label: 'Books Issued', value: formatNumber(stats.issued, locale), tone: 'brass', hint: 'Currently borrowed' },
    { label: 'Overdue Books', value: formatNumber(stats.overdue, locale), tone: 'alert', hint: 'Past their due date' },
    { label: 'Total Members', value: formatCompact(stats.totalMembers, locale), hint: 'Registered borrowers', capability: CAPABILITIES.MEMBERSHIP_STATS },
    { label: 'New Members', value: formatNumber(stats.newMembersThisMonth, locale), tone: 'good', hint: 'This month', capability: CAPABILITIES.MEMBERSHIP_STATS },
    { label: 'Reserved Books', value: formatNumber(stats.reserved, locale), tone: 'brass', hint: 'Awaiting collection' },
    { label: 'Pending Fines', value: formatCurrency(stats.pendingFines, locale), tone: 'alert', hint: 'Uncollected', capability: CAPABILITIES.FINANCE },
    { label: 'Books Added', value: formatNumber(stats.booksAddedThisMonth, locale), hint: 'This month', capability: CAPABILITIES.ACQUISITIONS },
    { label: 'Returned Today', value: formatNumber(stats.returnedToday, locale), tone: 'good', hint: 'Across the desk' },
  ])

  const isOwner = can(user, CAPABILITIES.TRENDS)

  const attention = [
    {
      label: 'Overdue books',
      hint: 'Past their due date and still out',
      count: stats.overdue,
      to: '/circulation/overdue',
      tone: 'alert',
    },
    {
      label: 'Reservations to collect',
      hint: 'Held at the desk, waiting for the member',
      count: stats.reserved,
      to: '/circulation/reservations',
      tone: 'warn',
    },
    {
      label: 'Pending fines',
      hint: 'Charged but not yet collected',
      count: stats.pendingFines,
      display: formatCurrency(stats.pendingFines, locale),
      to: '/fines',
      tone: 'alert',
      capability: CAPABILITIES.FINANCE,
    },
    {
      label: 'Books on the repair bench',
      hint: 'Reported or in process — completed jobs are not counted',
      count: openRepairs,
      to: '/books/repairs',
      tone: 'brass',
    },
    {
      label: 'Books reported lost',
      hint: 'Reported at the desk and not since recovered',
      count: openLosses,
      to: '/reports/loss',
      tone: 'alert',
    },
  ].filter((item) => !item.capability || can(user, item.capability))

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs />
      </div>

      <Greeting
        name={user?.name}
        subtitle={isOwner ? 'Library overview' : 'Circulation desk'}
      />

      <section aria-label="Summary statistics" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Needs attention" subtitle="What the library is waiting on" padded={false}>
          <NeedsAttention items={attention} />
        </Card>

        <div className="flex">
          <AskAthenaeum />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">

          {can(user, CAPABILITIES.TRENDS) && (
            <ChartCard title="Monthly transactions" subtitle="Issues against returns, last 12 months">
              {(view) => <GroupedBarChart data={data.monthly} view={view} locale={locale} />}
            </ChartCard>
          )}

          <ChartCard title="Book status" subtitle="Where every copy in the building is right now">
            {(view) => <DonutChart data={data.status} view={view} locale={locale} />}
          </ChartCard>

          <ChartCard title="Weekly activity" subtitle="Daily issues, returns, and sign-ups">
            {(view) => <AreaChart data={data.weekly} view={view} locale={locale} />}
          </ChartCard>

          <div className="grid gap-5 md:grid-cols-2">
            {can(user, CAPABILITIES.TRENDS) && (
              <ChartCard title="Most borrowed categories" subtitle="Lifetime borrowings by shelf">
                {(view) => (
                  <HorizontalBarChart data={data.categories} view={view} locale={locale} />
                )}
              </ChartCard>
            )}

            <Card title="Popular books" subtitle="Top 5 by lifetime borrows">
              <PopularBooks books={data.popular} locale={locale} />
            </Card>
          </div>

          <Card title="Recent activity" subtitle="Today at the circulation desk">
            <RecentActivity entries={data.activity} locale={locale} />
          </Card>

          <Card title="Due today" subtitle="Books falling due before closing">
            <DueToday borrowings={data.due} locale={locale} />
          </Card>

        </div>

        <div className="space-y-5">
          <Card title="Today's summary">
            <TodaySummary
              summary={data.today}
              locale={locale}
              showFines={can(user, CAPABILITIES.FINANCE)}
            />
          </Card>

          <Card title="Messages" subtitle="Sent to you by name">
            <NotificationsPanel messages={unreadMessages} />
          </Card>

          {can(user, CAPABILITIES.TRENDS) && (
            <Card title="Most active members" subtitle="By lifetime borrows">
              <ActiveMembers members={data.active} locale={locale} />
            </Card>
          )}

          <Card title="Calendar" subtitle="Due dates, reservations, events, holidays">
            <CalendarWidget calendar={data.calendar} locale={locale} now={now} />
          </Card>

          {can(user, CAPABILITIES.SYSTEM) && (
            <Card title="System health">
              <SystemHealth health={data.health} activeStaff={1} locale={locale} />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
