import { useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, type TestResult } from '../lib/api'
import { toast } from '../lib/toast'
import KeyList from '../components/KeyList'
import TestButton from '../components/TestButton'
import {
  Sliders,
  Globe,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Save,
  Check,
  Database,
  Eye,
  EyeOff,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import wpLogoUrl from '../assets/wordpress-logo.png'

export type Field = {
  key: string
  label: string
  type?: 'text' | 'number' | 'select' | 'secret' | 'keys'
  options?: string[]
  placeholder?: string
  help?: string
  half?: boolean
  when?: (v: Record<string, string>) => boolean
}

const MASK = '••••••••'

const ai = (name: string) => (v: Record<string, string>) => v.ai_provider === name

type Values = Record<string, string>

type Group = {
  title: string
  note?: string
  fields: Field[]
  test?: { label: string; run: () => Promise<TestResult> }
  connection?: {
    kind: string
    filled: (v: Values) => boolean
    color?: string
    icon?: ReactNode
  }
}

const WordPressLogo = (
  <img src={wpLogoUrl} alt="WordPress" className="w-full h-full object-contain drop-shadow-xs" />
)

const GROUPS: Group[] = [
  {
    title: 'WordPress',
    note: 'Application password (not your login password). Go to Users → Profile → Application Passwords.',
    test: { label: 'Test site connection', run: api.testWordpress },
    connection: {
      kind: 'WooCommerce Store',
      color: 'transparent',
      icon: WordPressLogo,
      filled: (v) => !!(v.wp_base && v.wp_user && v.wp_app_password),
    },
    fields: [
      { key: 'wp_base', label: 'WordPress Site URL', placeholder: 'https://example.com' },
      { key: 'wp_user', label: 'Admin Username', placeholder: 'admin', half: true },
      {
        key: 'wp_app_password',
        label: 'Application Password',
        type: 'secret',
        placeholder: 'xxxx xxxx xxxx xxxx',
        help: 'Generated from WordPress admin, spaces are ignored.',
        half: true,
      },
    ],
  },
  {
    title: 'AI Providers',
    note: 'Configure API keys for Google Gemini, OpenAI GPT, or Anthropic Claude.',
    connection: {
      kind: 'LLM Routing',
      color: '#6366f1',
      icon: <Sparkles className="w-4 h-4 text-white" />,
      filled: (v) => !!v[`${v.ai_provider}_keys`],
    },
    fields: [
      {
        key: 'ai_provider',
        label: 'Active Provider',
        type: 'select',
        options: ['gemini', 'openai', 'claude'],
        help: 'Switching active provider routes all prompt executions accordingly.',
      },

      { key: 'gemini_keys', label: 'Google Gemini Keys', type: 'keys', when: ai('gemini') },
      {
        key: 'gemini_model',
        label: 'Gemini Model',
        placeholder: 'gemini-2.5-flash',
        help: 'Free quota is separated per model name.',
        when: ai('gemini'),
      },

      { key: 'openai_keys', label: 'OpenAI API Keys', type: 'keys', when: ai('openai') },
      { key: 'openai_model', label: 'OpenAI Model', placeholder: 'gpt-4o', half: true, when: ai('openai') },
      {
        key: 'openai_reasoning',
        label: 'Reasoning Effort',
        type: 'select',
        options: ['minimal', 'low', 'medium', 'high'],
        half: true,
        when: ai('openai'),
      },

      { key: 'claude_keys', label: 'Anthropic Claude Keys', type: 'keys', when: ai('claude') },
      { key: 'claude_model', label: 'Claude Model', placeholder: 'claude-3-5-sonnet-latest', when: ai('claude') },
    ],
  },
  {
    title: 'Network & Proxy',
    note: 'HTTP outgoing client headers and socket timeout limits.',
    fields: [
      {
        key: 'http_user_agent',
        label: 'HTTP User Agent',
        placeholder: 'Toolbench/1.2 (+http://127.0.0.1)',
        help: 'Sent in header to identify automated requests.',
      },
      {
        key: 'http_timeout',
        label: 'Request Timeout (seconds)',
        type: 'number',
        placeholder: '30',
        half: true,
      },
    ],
  },
]

const CONNECTIONS = GROUPS.filter((g) => g.connection)
const GENERAL = GROUPS.filter((g) => !g.connection)

type Filter = 'all' | 'connected' | 'not'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All Services' },
  { id: 'connected', label: 'Configured' },
  { id: 'not', label: 'Needs Setup' },
]

function isConnected(group: Group, values: Values, result?: TestResult): boolean {
  return result ? result.ok : group.connection!.filled(values)
}

function autoColor(title: string): string {
  const hue = [...title].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 360
  return `hsl(${hue}, 65%, 45%)`
}

export default function Settings() {
  const [values, setValues] = useState<Values>({})
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState<'connections' | 'general'>('connections')
  const [open, setOpen] = useState('')
  const [query, setQuery] = useState('')
  const [only, setOnly] = useState<Filter>('all')
  const [tested, setTested] = useState<Record<string, TestResult>>({})

  useEffect(() => {
    api.getSettings().then(setValues).catch((e) => setError(String(e)))
  }, [])

  const set = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaved('')
    setDirty(true)
  }

  async function save() {
    setSaved('')
    setError('')
    setSaving(true)
    try {
      const updated = await api.saveSettings(values)
      setValues(updated)
      setSaved('Changes saved successfully')
      setDirty(false)
      setTested({})
      toast.success('Settings saved to encrypted database.')
      setTimeout(() => setSaved(''), 3500)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e)
      setError(msg)
      toast.error(`Save failed: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [values])

  const editing = CONNECTIONS.find((g) => g.title === open)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-fg tracking-tight">Settings & Preferences</h1>
          <p className="mt-1 text-xs text-muted">
            Secure configuration saved strictly to local database <code className="font-mono text-accent">backend/data.db</code>.
          </p>
        </div>

        {/* Segmented Tab Controls */}
        <div className="flex items-center p-1 rounded-xl bg-soft border border-line">
          <button
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              tab === 'connections'
                ? 'bg-card text-accent shadow-xs'
                : 'text-muted hover:text-fg'
            }`}
            onClick={() => {
              setTab('connections')
              setOpen('')
            }}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Connections ({CONNECTIONS.length})</span>
          </button>
          <button
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              tab === 'general'
                ? 'bg-card text-accent shadow-xs'
                : 'text-muted hover:text-fg'
            }`}
            onClick={() => {
              setTab('general')
              setOpen('')
            }}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>General Config</span>
          </button>
        </div>
      </div>

      {/* Tab Body */}
      {tab === 'general' ? (
        <div className="flex flex-col gap-5">
          <div className="p-3.5 rounded-xl border border-line bg-soft/50 text-xs text-muted flex items-center gap-2.5">
            <Database className="h-4 w-4 text-accent flex-none" />
            <span>
              All settings are stored in local encrypted SQLite. No external telemetry or cloud persistence.
            </span>
          </div>

          {GENERAL.map((g) => (
            <GroupCard key={g.title} group={g} values={values} set={set} dirty={dirty} />
          ))}
        </div>
      ) : editing ? (
        <div className="flex flex-col gap-4">
          <button
            className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover px-2 py-1 rounded-lg hover:bg-accent/5 transition-colors"
            onClick={() => setOpen('')}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to all connections</span>
          </button>

          <GroupCard
            group={editing}
            values={values}
            set={set}
            dirty={dirty}
            onResult={(r) => setTested((prev) => ({ ...prev, [editing.title]: r }))}
          />
        </div>
      ) : (
        <ConnectorList
          values={values}
          tested={tested}
          query={query}
          setQuery={setQuery}
          only={only}
          setOnly={setOnly}
          onOpen={setOpen}
        />
      )}

      {/* Floating Save Action Bar */}
      <div className="fixed right-0 bottom-0 left-sidebar z-40 flex items-center justify-between border-t border-line bg-card/90 backdrop-blur-md px-8 py-3.5 shadow-lg">
        <div className="flex items-center gap-3">
          {dirty ? (
            <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span>You have unsaved changes</span>
            </div>
          ) : saved ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              <span>{saved}</span>
            </div>
          ) : (
            <span className="text-xs text-muted">All credentials safely stored in database</span>
          )}

          {error && <span className="text-xs text-danger font-medium">{error}</span>}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted hidden sm:inline-block">
            Press <kbd className="px-1.5 py-0.5 rounded bg-soft border border-line font-mono text-[10px]">Ctrl+S</kbd> to save
          </span>

          <button
            className="btn-primary text-xs py-2 px-4 shadow-sm"
            onClick={save}
            disabled={saving || !dirty}
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving changes…' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function ConnectorList({
  values,
  tested,
  query,
  setQuery,
  only,
  setOnly,
  onOpen,
}: {
  values: Values
  tested: Record<string, TestResult>
  query: string
  setQuery: (q: string) => void
  only: Filter
  setOnly: (f: Filter) => void
  onOpen: (title: string) => void
}) {
  const needle = query.trim().toLowerCase()
  const shown = CONNECTIONS.filter((g) => {
    const matches =
      !needle ||
      g.title.toLowerCase().includes(needle) ||
      g.connection!.kind.toLowerCase().includes(needle)
    if (!matches) return false
    if (only === 'all') return true
    return isConnected(g, values, tested[g.title]) === (only === 'connected')
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Search and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-line bg-card shadow-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            type="search"
            className="input pl-9 pr-8 text-xs py-2"
            placeholder="Search connections..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-fg p-0.5 rounded"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-soft border border-line">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                only === f.id
                  ? 'bg-card text-accent shadow-xs'
                  : 'text-muted hover:text-fg'
              }`}
              onClick={() => setOnly(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Connectors Grid / Cards */}
      {shown.length === 0 ? (
        <div className="p-8 text-center card border-dashed">
          <p className="text-xs text-muted">No connections match your current search or filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map((g) => {
            return (
              <div
                key={g.title}
                onClick={() => onOpen(g.title)}
                className="card card-hover cursor-pointer p-5 flex flex-col justify-between border-line group relative"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-white shadow-xs group-hover:scale-105 transition-transform"
                        style={{ background: g.connection!.color ?? autoColor(g.title) }}
                      >
                        {g.connection!.icon ?? g.title[0]}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-fg group-hover:text-accent transition-colors">
                          {g.title}
                        </h3>
                        <span className="text-[11px] text-muted">{g.connection!.kind}</span>
                      </div>
                    </div>

                    <Status
                      group={g}
                      values={values}
                      result={tested[g.title]}
                    />
                  </div>

                  {g.note && (
                    <p className="mt-3 text-xs text-muted leading-relaxed line-clamp-2">
                      {g.note}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs text-accent font-semibold group-hover:translate-x-0.5 transition-transform">
                  <span>Configure credentials</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Status({
  group,
  values,
  result,
}: {
  group: Group
  values: Values
  result?: TestResult
}) {
  if (result) {
    return (
      <span
        className={`badge ${
          result.ok
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
        }`}
        title={result.message}
      >
        {result.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
        <span>{result.ok ? 'Verified' : 'Failed'}</span>
      </span>
    )
  }

  if (!group.connection!.filled(values)) {
    return (
      <span className="badge bg-soft text-muted border border-line">
        Needs Setup
      </span>
    )
  }

  return group.test ? (
    <span className="badge bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
      <Clock className="h-3 w-3" />
      <span>Set up · Untested</span>
    </span>
  ) : (
    <span className="badge bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 className="h-3 w-3" />
      <span>Configured</span>
    </span>
  )
}

function GroupCard({
  group,
  values,
  set,
  dirty,
  onResult,
}: {
  group: Group
  values: Values
  set: (key: string, value: string) => void
  dirty: boolean
  onResult?: (result: TestResult) => void
}) {
  const shown = group.fields.filter((f) => !f.when || f.when(values))
  return (
    <div className="card p-6 border-line">
      <div className="flex items-center gap-3 pb-3 border-b border-line">
        {group.connection && (
          <div
            className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-white shadow-xs"
            style={{ background: group.connection.color ?? autoColor(group.title) }}
          >
            {group.connection.icon ?? group.title[0]}
          </div>
        )}
        <div>
          <h2 className="text-base font-bold text-fg">{group.title}</h2>
          {group.note && <p className="text-xs text-muted mt-0.5">{group.note}</p>}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {shown.map((f) => (
          <Row key={f.key} field={f} value={values[f.key] ?? ''} onChange={set} />
        ))}
      </div>

      {group.test && (
        <TestButton label={group.test.label} run={group.test.run} dirty={dirty} onResult={onResult} />
      )}
    </div>
  )
}

function Row({
  field,
  value,
  onChange,
}: {
  field: Field
  value: string
  onChange: (key: string, value: string) => void
}) {
  const { key, label, type = 'text', options, placeholder, help, half } = field
  const [reveal, setReveal] = useState(false)

  if (type === 'keys') {
    return (
      <div className="col-span-full block min-w-0">
        <span className="mb-2 block text-xs font-semibold text-fg">{label}</span>
        <KeyList value={value} onChange={(v) => onChange(key, v)} />
      </div>
    )
  }

  const locked = type === 'secret' && value.includes(MASK)

  return (
    <label className={`block min-w-0 ${half ? '' : 'col-span-full'}`}>
      <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-fg">
        <span>{label}</span>
        {locked && (
          <button
            type="button"
            className="text-xs font-medium text-accent hover:underline cursor-pointer"
            onClick={() => onChange(key, '')}
          >
            Change secret
          </button>
        )}
      </span>

      {type === 'select' ? (
        <select
          className="input capitalize text-xs py-2"
          value={value}
          onChange={(e) => onChange(key, e.target.value)}
        >
          {!options?.includes(value) && <option value={value}>{value || '—'}</option>}
          {options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : type === 'secret' ? (
        <div className="relative">
          <input
            className="input pr-9 font-mono text-xs py-2"
            type={reveal ? 'text' : 'password'}
            value={value}
            readOnly={locked}
            placeholder={placeholder}
            onChange={(e) => onChange(key, e.target.value)}
          />
          {!locked && value && (
            <button
              type="button"
              className="icon-btn h-7 w-7 absolute right-1.5 top-1/2 -translate-y-1/2"
              onClick={() => setReveal(!reveal)}
              title={reveal ? 'Hide secret' : 'Reveal secret'}
            >
              {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      ) : (
        <input
          className="input text-xs py-2"
          type={type === 'number' ? 'number' : 'text'}
          value={value}
          readOnly={locked}
          placeholder={placeholder}
          onChange={(e) => onChange(key, e.target.value)}
        />
      )}

      {help && <p className="mt-1 text-[11px] text-muted leading-tight">{help}</p>}
    </label>
  )
}
