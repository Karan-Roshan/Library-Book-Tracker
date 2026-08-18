// Who is signed in, for the whole app to read.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as auth from '../services/auth.js'
import { signInMember } from '../services/memberAccess.js'
import { purgeBrowserData } from '../services/storage.js'
import { loadLibrary } from '../services/catalogue.js'
import { setActor } from '../services/activity.js'

const AuthContext = createContext(null)

// Holds the signed-in user and the sign-in and sign-out actions.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  const [needsSetup, setNeedsSetup] = useState(false)

  const [loading, setLoading] = useState(true)

  useEffect(() => setActor(user), [user])

  useEffect(() => {
    let active = true

    purgeBrowserData()
    loadLibrary()
      .then((result) => {
        if (result.source === 'mongodb') {
          console.info('Catalogue loaded from MongoDB', result.counts)
        }
        return auth.migratePersonnelIds()
      })
      .then(() => Promise.all([auth.currentUser(), auth.accountsExist()]))
      .then(([restored, exists]) => {
        if (!active) return
        setUser(restored)
        setNeedsSetup(!exists)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (credentials) => {
    const signedIn =
      credentials.expectedRole === 'member'
        ? await signInMember(credentials)
        : await auth.signIn(credentials)
    setUser(signedIn)
    return signedIn
  }, [])

  const claimLibrary = useCallback(async (details) => {
    const owner = await auth.claimLibrary(details)
    setUser(owner)
    setNeedsSetup(false)
    return owner
  }, [])

  const signOut = useCallback(async () => {
    await auth.signOut()
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (userId, patch) => {
    const updated = await auth.updateProfile(userId, patch)
    setUser(updated)
    return updated
  }, [])

  // Re-reads the signed-in user, for when they change their own details.
  const refreshUser = useCallback(async () => {
    const fresh = await auth.currentUser()
    setUser(fresh)
    return fresh
  }, [])

  const value = useMemo(
    () => ({ user, loading, needsSetup, signIn, claimLibrary, signOut, updateProfile, refreshUser }),
    [user, loading, needsSetup, signIn, claimLibrary, signOut, updateProfile, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// The signed-in user, from anywhere in the app.
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an <AuthProvider>.')
  return context
}
