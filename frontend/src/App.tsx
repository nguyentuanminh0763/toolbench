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

  const navItem = 'cursor-pointer rounded-lg border-0 px-3 py-2 text-left'

  return (
    <div className="flex min-h-screen">
      <nav className="flex w-sidebar flex-none flex-col gap-0.5 border-r border-line bg-soft px-2.5 py-4">
        <div className="px-2.5 pt-1.5 pb-4 font-bold">Toolbench</div>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${navItem} ${
              page === t.id ? 'bg-accent text-white' : 'bg-transparent text-fg hover:bg-line'
            }`}
            onClick={() => setPage(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button className={`${navItem} mt-auto bg-transparent text-muted hover:bg-line`} onClick={lock}>
          Lock
        </button>
      </nav>

      <main className="max-w-[760px] flex-1 px-[30px] pt-[26px] pb-[90px]">
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
