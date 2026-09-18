import { useCallback, useEffect, useState } from 'react'
import { api, token, type AuthState } from './lib/api'
import { TABS } from './features'
import Lock from './pages/Lock'

export default function App() {
  const [page, setPage] = useState(TABS[0].id)
  const [auth, setAuth] = useState<AuthState | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const state = await api.authState()
    setAuth(state)
    // The server forgets its key when it restarts, so a token left in this tab
    // is stale. Drop it rather than letting every call fail with 401.
    if (!state.unlocked) token.clear()
    setReady(true)
  }, [])

  useEffect(() => {
    refresh().catch(() => setReady(true))
  }, [refresh])

  if (!ready) return null

  const locked = !auth?.unlocked || !token.get()
  if (locked) {
    return <Lock configured={!!auth?.configured} onUnlocked={refresh} />
  }

  async function lock() {
    await api.lock().catch(() => {})
    token.clear()
    await refresh()
  }

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="brand">Toolbench</div>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nav-item${page === t.id ? ' active' : ''}`}
            onClick={() => setPage(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button className="nav-item lockbtn" onClick={lock}>
          Lock
        </button>
      </nav>

      <main className="content">
        {/*
          Every tab stays mounted, hidden rather than removed. Switching tabs
          must not wipe a screen's state — a half-filled form or a job in
          progress has to survive a click on the sidebar.
        */}
        {TABS.map(({ id, Page }) => (
          <div key={id} hidden={page !== id}>
            <Page />
          </div>
        ))}
      </main>
    </div>
  )
}
