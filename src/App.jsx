// Every route in the app, and the guards deciding who may reach each one.

import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { PreferencesProvider } from './context/PreferencesContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { SettingsProvider } from './context/SettingsContext.jsx'
import AppShell from './components/layout/AppShell.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SetupPage from './pages/SetupPage.jsx'
import ActivatePage from './pages/ActivatePage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import StaffAccountsPage from './pages/StaffAccountsPage.jsx'
import StaffDetailsPage from './pages/StaffDetailsPage.jsx'
import FinesPage from './pages/FinesPage.jsx'
import MembersPage from './pages/MembersPage.jsx'
import MemberProfilePage from './pages/MemberProfilePage.jsx'
import MessagesPage from './pages/MessagesPage.jsx'
import BooksPage from './pages/BooksPage.jsx'
import ComplaintsPage from './pages/ComplaintsPage.jsx'
import RepairsPage from './pages/RepairsPage.jsx'
import ActivityPage from './pages/ActivityPage.jsx'
import IssuePage from './pages/circulation/IssuePage.jsx'
import ReturnPage from './pages/circulation/ReturnPage.jsx'
import ReservationsPage from './pages/circulation/ReservationsPage.jsx'
import OverduePage from './pages/circulation/OverduePage.jsx'
import ReportsLayout from './pages/reports/ReportsLayout.jsx'
import OverviewReport from './pages/reports/OverviewReport.jsx'
import CirculationReport from './pages/reports/CirculationReport.jsx'
import MembersReport from './pages/reports/MembersReport.jsx'
import InventoryReport from './pages/reports/InventoryReport.jsx'
import FinesReport from './pages/reports/FinesReport.jsx'
import RepairsReport from './pages/reports/RepairsReport.jsx'
import LossReport from './pages/reports/LossReport.jsx'
import StaffReport from './pages/reports/StaffReport.jsx'
import SettingsLayout from './pages/settings/SettingsLayout.jsx'
import LibrarySettings from './pages/settings/LibrarySettings.jsx'
import SystemSettings from './pages/settings/SystemSettings.jsx'
import CirculationSettings from './pages/settings/CirculationSettings.jsx'
import MemberDashboard from './pages/member/MemberDashboard.jsx'
import MyBooks from './pages/member/MyBooks.jsx'
import MyDue from './pages/member/MyDue.jsx'
import MyHistory from './pages/member/MyHistory.jsx'
import MyBrowse from './pages/member/MyBrowse.jsx'
import MyReservations from './pages/member/MyReservations.jsx'
import MyFines from './pages/member/MyFines.jsx'
import MyComplaints from './pages/member/MyComplaints.jsx'
import MyNotifications from './pages/member/MyNotifications.jsx'
import MyProfile from './pages/member/MyProfile.jsx'
import AddBookPage from './pages/AddBookPage.jsx'
import Logo from './components/Logo.jsx'
import { CAPABILITIES, can, isMember } from './lib/permissions.js'

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={isMember(user) ? '/my' : '/dashboard'} replace />
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-parchment dark:bg-ink-950">
      <Logo className="h-9 w-9 animate-pulse text-brass-500" />
    </div>
  )
}

function ProtectedShell() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Splash />

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return (
    <ToastProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </ToastProvider>
  )
}

function RequireGuest({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

function RequireSetup({ children }) {
  const { needsSetup, loading } = useAuth()
  if (loading) return <Splash />
  if (!needsSetup) return <Navigate to="/login" replace />
  return children
}

function RequireCapability({ capability, children }) {
  const { user } = useAuth()
  if (!can(user, capability)) return <Navigate to={isMember(user) ? '/my' : '/dashboard'} replace />
  return children
}

function RequireStaff({ children }) {
  const { user } = useAuth()
  if (isMember(user)) return <Navigate to="/my" replace />
  return children
}

function RequireMember({ children }) {
  const { user } = useAuth()
  if (!isMember(user)) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <SettingsProvider>

      <AuthProvider>
        <PreferencesProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route
              path="/login"
              element={
                <RequireGuest>
                  <LoginPage />
                </RequireGuest>
              }
            />
            <Route
              path="/setup"
              element={
                <RequireSetup>
                  <SetupPage />
                </RequireSetup>
              }
            />

            <Route path="/activate/:token" element={<ActivatePage />} />

            <Route path="/signup" element={<Navigate to="/login" replace />} />

            <Route element={<ProtectedShell />}>

              <Route
                path="/my"
                element={
                  <RequireMember>
                    <Outlet />
                  </RequireMember>
                }
              >
                <Route index element={<MemberDashboard />} />
                <Route path="books" element={<MyBooks />} />
                <Route path="due" element={<MyDue />} />
                <Route path="history" element={<MyHistory />} />
                <Route path="browse" element={<MyBrowse />} />
                <Route path="categories" element={<MyBrowse mode="categories" />} />
                <Route path="reservations" element={<MyReservations />} />
                <Route path="fines" element={<MyFines />} />
                <Route path="complaints" element={<MyComplaints />} />
                <Route path="notifications" element={<MyNotifications />} />
                <Route path="profile" element={<MyProfile />} />
              </Route>

              <Route
                path="/dashboard"
                element={
                  <RequireStaff>
                    <DashboardPage />
                  </RequireStaff>
                }
              />
              <Route
                path="/profile"
                element={
                  <RequireStaff>
                    <ProfilePage />
                  </RequireStaff>
                }
              />
              <Route
                path="/staff"
                element={
                  <RequireCapability capability={CAPABILITIES.ACCOUNTS}>
                    <StaffDetailsPage />
                  </RequireCapability>
                }
              />

              <Route
                path="/settings"
                element={
                  <RequireCapability capability={CAPABILITIES.SETTINGS}>
                    <SettingsLayout />
                  </RequireCapability>
                }
              >
                <Route index element={<LibrarySettings />} />
                <Route path="system" element={<SystemSettings />} />
                <Route path="circulation" element={<CirculationSettings />} />

                <Route path="data" element={<Navigate to="/settings" replace />} />
                <Route path="history" element={<Navigate to="/settings" replace />} />
                <Route path="finance" element={<Navigate to="/settings" replace />} />
                <Route path="notifications" element={<Navigate to="/settings" replace />} />
                <Route path="security" element={<Navigate to="/settings" replace />} />
              </Route>

              <Route
                path="/reports"
                element={
                  <RequireCapability capability={CAPABILITIES.REPORTS}>
                    <ReportsLayout />
                  </RequireCapability>
                }
              >
                <Route index element={<OverviewReport />} />
                <Route path="circulation" element={<CirculationReport />} />
                <Route path="members" element={<MembersReport />} />
                <Route path="inventory" element={<InventoryReport />} />
                <Route path="fines" element={<FinesReport />} />
                <Route path="repairs" element={<RepairsReport />} />
                <Route path="loss" element={<LossReport />} />
                <Route
                  path="staff"
                  element={
                    <RequireCapability capability={CAPABILITIES.REPORTS_STAFF}>
                      <StaffReport />
                    </RequireCapability>
                  }
                />
              </Route>

              <Route path="/circulation" element={<Navigate to="/circulation/issue" replace />} />
              <Route path="/circulation/issue" element={<RequireStaff><IssuePage /></RequireStaff>} />
              <Route path="/circulation/return" element={<RequireStaff><ReturnPage /></RequireStaff>} />
              <Route path="/circulation/reservations" element={<RequireStaff><ReservationsPage /></RequireStaff>} />
              <Route path="/circulation/overdue" element={<RequireStaff><OverduePage /></RequireStaff>} />

              <Route path="/circulation/rules" element={<Navigate to="/settings/circulation" replace />} />

              <Route path="/complaints" element={<RequireStaff><ComplaintsPage /></RequireStaff>} />
              <Route path="/books" element={<RequireStaff><BooksPage /></RequireStaff>} />
              <Route path="/books/add" element={<RequireStaff><AddBookPage /></RequireStaff>} />
              <Route path="/books/repairs" element={<RequireStaff><RepairsPage /></RequireStaff>} />
              <Route
                path="/activity"
                element={
                  <RequireCapability capability={CAPABILITIES.ACTIVITY}>
                    <ActivityPage />
                  </RequireCapability>
                }
              />
              <Route path="/notifications" element={<RequireStaff><MessagesPage /></RequireStaff>} />
              <Route path="/members" element={<RequireStaff><MembersPage /></RequireStaff>} />
              <Route path="/members/add" element={<RequireStaff><MembersPage autoAdd /></RequireStaff>} />
              <Route path="/members/:id" element={<RequireStaff><MemberProfilePage /></RequireStaff>} />
              <Route
                path="/fines"
                element={
                  <RequireCapability capability={CAPABILITIES.FINES}>
                    <FinesPage />
                  </RequireCapability>
                }
              />
              <Route
                path="/staff/assistants"
                element={
                  <RequireCapability capability={CAPABILITIES.ACCOUNTS}>
                    <StaffAccountsPage />
                  </RequireCapability>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </PreferencesProvider>
      </AuthProvider>
    </SettingsProvider>
  )
}
