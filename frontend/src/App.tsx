import { useCallback, useEffect, useState } from 'react'
import { api, token, type AuthState } from './lib/api'
import { TABS } from './features'
import Lock from './pages/Lock'
import ToastContainer from './components/ToastContainer'
import {
  ShieldCheck,
  Lock as LockIcon,
  Sun,
  Moon,
  Monitor,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react'

type ThemeMode = 'dark' | 'light' | 'system'

export default function App() {
  const [page, setPage] = useState(TABS[0].id)
  const [auth, setAuth] = useState<AuthState | null>(null)
  const [ready, setReady] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('toolbench_theme') as ThemeMode) || 'system'
  })

  // Theme application
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      localStorage.removeItem('toolbench_theme')
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', systemDark)
      root.classList.toggle('light', !systemDark)
    } else {
      localStorage.setItem('toolbench_theme', theme)
      root.classList.toggle('dark', theme === 'dark')
      root.classList.toggle('light', theme === 'light')
    }
  }, [theme])

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

    const handleNavigate = (e: CustomEvent<string>) => {
      if (e.detail && TABS.some((t) => t.id === e.detail)) {
        setPage(e.detail)
      }
    }
    window.addEventListener('toolbench:navigate' as any, handleNavigate)
    return () => window.removeEventListener('toolbench:navigate' as any, handleNavigate)
  }, [refresh])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-xs font-medium text-muted">Initializing workspace…</span>
        </div>
      </div>
    )
  }

  const locked = !auth?.unlocked || !token.get()
  if (locked) {
    return <Lock configured={!!auth?.configured} onUnlocked={refresh} />
  }

  async function lock() {
    await api.lock().catch(() => {})
    token.clear()
    await refresh()
  }

  const activeTab = TABS.find((t) => t.id === page) || TABS[0]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-fg">
      <ToastContainer />

      {/* Fixed Full-Height Sidebar */}
      <aside className="flex w-sidebar h-full flex-none flex-col border-r border-line bg-soft/70 backdrop-blur-xl select-none z-20">
        {/* Brand Header */}
        <div className="p-4 border-b border-line/70 flex-none">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-accent to-purple-600 shadow-md shadow-accent/25 text-white">
              <Layers className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-fg">Toolbench</span>
                <span className="rounded-full bg-accent/15 px-1.5 py-0.2 text-[10px] font-semibold text-accent">
                  v1.2
                </span>
              </div>
              <span className="text-[11px] text-muted">Local Workspace</span>
            </div>
          </div>
        </div>

        {/* Navigation items (Scrollable if needed) */}
        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
            Workspace
          </div>
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = page === t.id
            return (
              <button
                key={t.id}
                onClick={() => setPage(t.id)}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-accent text-white shadow-sm shadow-accent/25 font-semibold'
                    : 'text-muted hover:bg-soft hover:text-fg'
                }`}
              >
                <Icon className={`h-4 w-4 flex-none transition-transform duration-150 ${isActive ? 'text-white' : 'text-muted group-hover:text-fg'}`} />
                <span className="flex-1">{t.label}</span>
                {t.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-line text-muted'}`}>
                    {t.badge}
                  </span>
                )}
              </button>
            )
          })}

          <div className="mt-6 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
            Resources
          </div>
          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium text-muted hover:bg-soft hover:text-fg transition-all"
          >
            <ExternalLink className="h-4 w-4 flex-none text-muted" />
            <span className="flex-1">FastAPI Docs</span>
            <span className="text-[10px] text-muted">/docs</span>
          </a>
        </nav>

        {/* Sidebar Footer - Always pinned at bottom */}
        <div className="p-3 border-t border-line/70 flex flex-col gap-2.5 bg-card/40 flex-none">
          {/* Security & Health pill */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-soft/80 border border-line text-[11px]" title="Localhost Only, Encrypted Vault">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-medium text-fg">127.0.0.1:8770</span>
            </div>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          </div>

          {/* Theme Switcher & Lock Actions */}
          <div className="flex items-center justify-between gap-1 pt-1">
            {/* Theme switcher pill */}
            <div className="flex items-center bg-soft rounded-lg p-0.5 border border-line">
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-md transition-all ${
                  theme === 'light' ? 'bg-card text-accent shadow-xs' : 'text-muted hover:text-fg'
                }`}
                title="Light theme"
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-md transition-all ${
                  theme === 'dark' ? 'bg-card text-accent shadow-xs' : 'text-muted hover:text-fg'
                }`}
                title="Dark theme"
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`p-1.5 rounded-md transition-all ${
                  theme === 'system' ? 'bg-card text-accent shadow-xs' : 'text-muted hover:text-fg'
                }`}
                title="System preference"
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Lock button */}
            <button
              onClick={lock}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-danger hover:bg-danger/10 transition-colors"
              title="Lock this session"
            >
              <LockIcon className="h-3.5 w-3.5" />
              <span>Lock</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Scrollable Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
        {/* Top Header bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b border-line bg-bg/85 backdrop-blur-md flex-none">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="text-muted">Workspace</span>
            <span className="text-muted/50">/</span>
            <span className="font-semibold text-fg">{activeTab.label}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
              <Sparkles className="w-3 h-3" />
              <span>Ready</span>
            </div>
          </div>
        </header>

        {/* Page Content with fluid responsive width */}
        <main className="flex-1 px-6 py-5 w-full max-w-[1500px] mx-auto pb-20">
          {TABS.map(({ id, Page }) => (
            <div key={id} hidden={page !== id} className="animate-in fade-in duration-150">
              <Page />
            </div>
          ))}
        </main>
      </div>
    </div>
  )
}
