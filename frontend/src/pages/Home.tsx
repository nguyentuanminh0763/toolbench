import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { productsApi } from '../features/products/api'
import {
  Package,
  ShieldCheck,
  Activity,
  ArrowRight,
  ExternalLink,
  KeyRound,
  Database,
  Sparkles,
  RefreshCw,
  Server,
  Lock,
  Globe,
  Bot,
} from 'lucide-react'

export default function Home() {
  const [healthOk, setHealthOk] = useState<boolean | null>(null)
  const [latency, setLatency] = useState<number | null>(null)
  const [productCount, setProductCount] = useState<number | null>(null)
  const [connectionsCount, setConnectionsCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const checkStatus = async () => {
    setLoading(true)
    const t0 = performance.now()
    try {
      const res = await api.health()
      setLatency(Math.round(performance.now() - t0))
      setHealthOk(res.ok)
    } catch {
      setHealthOk(false)
      setLatency(null)
    }

    // Try fetching products total
    try {
      const prodRes = await productsApi.list(1, 1, '')
      setProductCount(prodRes.total)
    } catch {
      setProductCount(null)
    }

    // Try fetching settings to count connected services
    try {
      const settings = await api.getSettings()
      let count = 0
      if (settings.wp_base && settings.wp_user && settings.wp_app_password) count++
      if (settings.ai_provider && settings[`${settings.ai_provider}_keys`]) count++
      setConnectionsCount(count)
    } catch {
      setConnectionsCount(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkStatus()
  }, [])

  const navigateTo = (tabId: string) => {
    window.dispatchEvent(new CustomEvent('toolbench:navigate', { detail: tabId }))
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Welcome & Status Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-card via-card to-soft p-6 shadow-xs">
        {/* Subtle background glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute right-10 bottom-0 h-40 w-40 rounded-full bg-purple-500/10 blur-2xl" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent border border-accent/20">
                <Sparkles className="h-3 w-3" />
                Operations Hub
              </span>
              <span className="text-xs text-muted">Standalone Local Environment</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-fg">
              Welcome to Toolbench
            </h1>
            <p className="text-xs text-muted max-w-xl leading-relaxed">
              Your hardened local workspace for WooCommerce catalog management, AI provider routing, and encrypted credential storage.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={checkStatus}
              disabled={loading}
              className="btn text-xs py-2 px-3"
              title="Refresh health status"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-accent' : 'text-muted'}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => navigateTo('products')}
              className="btn-primary text-xs py-2 px-4"
            >
              <span>Explore Products</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Catalogue */}
        <div
          onClick={() => navigateTo('products')}
          className="card card-hover cursor-pointer group flex flex-col justify-between p-4.5 border-line"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">WooCommerce Catalog</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-all">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-fg">
              {productCount !== null ? productCount.toLocaleString() : '—'}
            </div>
            <p className="mt-1 text-[11px] text-muted flex items-center gap-1">
              <span>{productCount !== null ? 'Live synchronised items' : 'Configure WordPress connection'}</span>
            </p>
          </div>
        </div>

        {/* Card 2: Connected Services */}
        <div
          onClick={() => navigateTo('settings')}
          className="card card-hover cursor-pointer group flex flex-col justify-between p-4.5 border-line"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Active Integrations</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <Globe className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-fg">
              {connectionsCount !== null ? `${connectionsCount} Connected` : '—'}
            </div>
            <p className="mt-1 text-[11px] text-muted flex items-center gap-1">
              <span>WordPress & Model APIs</span>
            </p>
          </div>
        </div>

        {/* Card 3: Security & Vault */}
        <div className="card flex flex-col justify-between p-4.5 border-line">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Vault Storage</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-fg flex items-center gap-1.5">
              <span>Encrypted</span>
            </div>
            <p className="mt-1 text-[11px] text-muted flex items-center gap-1">
              <Database className="h-3 w-3 text-muted" />
              <span>data.db (AES-GCM / PBKDF2)</span>
            </p>
          </div>
        </div>

        {/* Card 4: Server Health */}
        <div className="card flex flex-col justify-between p-4.5 border-line">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Local Server</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-fg flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${healthOk ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50' : 'bg-rose-500'}`} />
              <span>{healthOk ? 'Healthy' : 'Offline'}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted flex items-center gap-1">
              <span>Port 8770</span>
              {latency !== null && <span>· {latency}ms latency</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Launch & System Architecture Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quick Launch Actions */}
        <div className="md:col-span-1 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-fg">Quick Actions</h2>
            <span className="text-[11px] text-muted">Shortcuts</span>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigateTo('products')}
              className="flex items-center justify-between p-3 rounded-xl border border-line bg-card hover:bg-soft hover:border-line-strong text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:scale-105 transition-transform">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-fg">Browse Catalog</div>
                  <div className="text-[11px] text-muted">View and edit shop items</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() => navigateTo('settings')}
              className="flex items-center justify-between p-3 rounded-xl border border-line bg-card hover:bg-soft hover:border-line-strong text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-fg">Manage API Keys</div>
                  <div className="text-[11px] text-muted">Configure AI & WordPress tokens</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </button>

            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between p-3 rounded-xl border border-line bg-card hover:bg-soft hover:border-line-strong text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform">
                  <ExternalLink className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-fg">API Documentation</div>
                  <div className="text-[11px] text-muted">Open interactive Swagger docs</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </a>
          </div>
        </div>

        {/* Architecture & Security Highlights */}
        <div className="md:col-span-2 card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-fg">Tool Architecture & Security</h2>
              </div>
              <span className="badge bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
                Active Defense
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex gap-3">
                <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-soft border border-line text-muted">
                  <Lock className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-fg">Zero Cloud Storage</h3>
                  <p className="mt-0.5 text-[11px] text-muted leading-relaxed">
                    All application credentials and SQLite data reside solely on this machine in <code className="text-accent">backend/data.db</code>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-soft border border-line text-muted">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-fg">DNS Rebinding Protection</h3>
                  <p className="mt-0.5 text-[11px] text-muted leading-relaxed">
                    Strict Host header validation rejects malicious web origins targeting 127.0.0.1 via DNS rebinding.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-soft border border-line text-muted">
                  <Activity className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-fg">Single-Port Service</h3>
                  <p className="mt-0.5 text-[11px] text-muted leading-relaxed">
                    FastAPI serves both the built client UI and the REST API on port 8770 with zero CORS overhead in production.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-soft border border-line text-muted">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-fg">Multi-Model AI Proxy</h3>
                  <p className="mt-0.5 text-[11px] text-muted leading-relaxed">
                    Dynamic switching between Google Gemini, OpenAI GPT, and Anthropic Claude with multiple rotation keys.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11px] text-muted">
            <span>FastAPI v0.115+ · React 19 · Vite 7 · SQLite3</span>
            <span className="font-mono text-accent">uv run python -m app.main</span>
          </div>
        </div>
      </div>
    </div>
  )
}
