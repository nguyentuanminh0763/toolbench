import { useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, type TestResult } from '../lib/api'
import KeyList from '../components/KeyList'
import TestButton from '../components/TestButton'

/**
 * Values are stored in SQLite, not a .env file — when the tool is copied to
 * another machine the user fills this in instead of editing a text file.
 *
 * Keys ending in _key / _keys / _password / _token / _secret are secrets: the
 * backend returns them masked, and saving a masked value keeps the stored one.
 *
 * To add a setting, add a line to GROUPS. Nothing to change in the backend.
 * `when` hides a field until it is relevant — that is what keeps this screen
 * short as more providers get added.
 *
 * Two sub-tabs. A group with `connection` is something with credentials that
 * points at somewhere else, so it gets a row in Connections; everything else
 * is a plain preference and stays in General.
 */

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
  /** Optional check button. It runs against the SAVED settings, not the form. */
  test?: { label: string; run: () => Promise<TestResult> }
  /**
   * Present = show this group in Connections instead of General.
   * `filled` answers "are the credentials in place", which is all we can know
   * without going out to the network. `test` is what proves they work.
   *
   * `icon` takes an inline <svg> when you want the real logo. Left out, the row
   * gets a lettered tile — so a new connector looks right with no artwork.
   */
  connection?: {
    kind: string
    filled: (v: Values) => boolean
    color?: string
    icon?: ReactNode
  }
}

const GROUPS: Group[] = [
  {
    title: 'WordPress',
    note: 'Application password, not the login password. Users → Profile → Application Passwords.',
    test: { label: 'Test connection', run: api.testWordpress },
    connection: {
      kind: 'Site',
      color: '#21759b',
      filled: (v) => !!(v.wp_base && v.wp_user && v.wp_app_password),
    },
    fields: [
      { key: 'wp_base', label: 'Site URL', placeholder: 'https://example.com' },
      { key: 'wp_user', label: 'Username', placeholder: 'admin', half: true },
      {
        key: 'wp_app_password',
        label: 'Application password',
        type: 'secret',
        placeholder: 'xxxx xxxx xxxx xxxx',
        half: true,
      },
    ],
  },
  {
    title: 'AI',
    note: 'Pick a provider, then paste its API keys.',
    connection: {
      kind: 'Model provider',
      color: '#7c5cff',
      // Only the selected provider's keys matter — the rest are hidden anyway.
      filled: (v) => !!v[`${v.ai_provider}_keys`],
    },
    fields: [
      { key: 'ai_provider', label: 'Provider', type: 'select', options: ['gemini', 'openai', 'claude'] },

      { key: 'gemini_keys', label: 'Gemini keys', type: 'keys', when: ai('gemini') },
      {
        key: 'gemini_model',
        label: 'Model',
        placeholder: 'gemini-2.5-flash',
        help: 'Free quota is per model, so switching model gives a fresh allowance.',
        when: ai('gemini'),
      },

      { key: 'openai_keys', label: 'OpenAI keys', type: 'keys', when: ai('openai') },
      { key: 'openai_model', label: 'Model', placeholder: 'gpt-5', half: true, when: ai('openai') },
      {
        key: 'openai_reasoning',
        label: 'Reasoning effort',
        type: 'select',
        options: ['minimal', 'low', 'medium', 'high'],
        half: true,
        when: ai('openai'),
      },

      { key: 'claude_keys', label: 'Claude keys', type: 'keys', when: ai('claude') },
      { key: 'claude_model', label: 'Model', placeholder: 'claude-opus-5', when: ai('claude') },
    ],
  },
  {
    title: 'Network',
    fields: [
      { key: 'http_user_agent', label: 'User agent' },
      { key: 'http_timeout', label: 'Timeout (seconds)', type: 'number', half: true },
    ],
  },
]

const CONNECTIONS = GROUPS.filter((g) => g.connection)
const GENERAL = GROUPS.filter((g) => !g.connection)

type Filter = 'all' | 'connected' | 'not'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'connected', label: 'Connected' },
  { id: 'not', label: 'Not connected' },
]

/**
 * One yes/no for the filter chips, from the same facts the Status cell shows:
 * a real test verdict wins, and without one we fall back to "the fields are
 * filled in". So a connector that failed its test lands under Not connected,
 * which is where someone looking for something to fix would go hunting.
 */
function isConnected(group: Group, values: Values, result?: TestResult): boolean {
  return result ? result.ok : group.connection!.filled(values)
}

/** Stable colour for a connector that did not pick one. */
function autoColor(title: string): string {
  const hue = [...title].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 360
  return `hsl(${hue} 45% 45%)`
}

export default function Settings() {
  const [values, setValues] = useState<Values>({})
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Unsaved edits matter here: the test button checks what is in the database,
  // not what is on screen. Without this the user tests the old values and
  // cannot work out why the fix did nothing.
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState<'general' | 'connections'>('general')
  /** Title of the connection being edited, '' = show the list. */
  const [open, setOpen] = useState('')
  const [query, setQuery] = useState('')
  const [only, setOnly] = useState<Filter>('all')
  // ponytail: verdicts live in memory, so a reload shows "not tested" again.
  // Persist them in db only if someone actually misses them across restarts.
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
      setValues(await api.saveSettings(values))
      setSaved('Saved')
      setDirty(false)
      // The credentials just changed, so every stored verdict is about the old
      // ones. Dropping them beats showing a tick that is no longer true.
      setTested({})
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  function show(next: 'general' | 'connections') {
    setTab(next)
    setOpen('')
  }

  const editing = CONNECTIONS.find((g) => g.title === open)

  return (
    <section>
      <h1>Settings</h1>

      <div className="mb-4.5 flex gap-1.5">
        {(['general', 'connections'] as const).map((id) => (
          <button
            key={id}
            className={`cursor-pointer rounded-lg border px-3.5 py-1.5 capitalize ${
              tab === id
                ? 'border-accent bg-accent text-white'
                : 'border-line bg-transparent text-fg hover:bg-line'
            }`}
            onClick={() => show(id)}
          >
            {id}
          </button>
        ))}
      </div>

      {tab === 'general' ? (
        <>
          <p className="mb-4 text-[13px] text-muted">
            Stored in <Code>backend/data.db</Code> on this machine. Never committed,
            never sent anywhere.
          </p>
          {GENERAL.map((g) => (
            <GroupCard key={g.title} group={g} values={values} set={set} dirty={dirty} />
          ))}
        </>
      ) : editing ? (
        <>
          <button className="btn-link mb-2.5" onClick={() => setOpen('')}>
            ← All connections
          </button>
          <GroupCard
            group={editing}
            values={values}
            set={set}
            dirty={dirty}
            onResult={(r) => setTested((prev) => ({ ...prev, [editing.title]: r }))}
          />
        </>
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

      {/* Fixed so Save is reachable without scrolling back up. It starts where
          the sidebar ends, hence w-sidebar being a shared value. */}
      <div className="fixed right-0 bottom-0 left-sidebar flex items-center gap-3 border-t border-line bg-soft px-[30px] py-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-[13px] text-success">{saved}</span>}
        {error && <span className="text-[13px] text-danger">{error}</span>}
      </div>
    </section>
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
    <>
      <p className="mb-4 text-[13px] text-muted">
        Credentials for the places this tool talks to. They stay in{' '}
        <Code>backend/data.db</Code> on this machine.
      </p>

      <input
        type="search"
        className="input mb-3"
        placeholder="Search connections"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="mb-1.5 flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`cursor-pointer rounded-full border border-line px-3 py-1 text-[13px] ${
              only === f.id ? 'bg-line text-fg' : 'bg-transparent text-muted hover:bg-line'
            }`}
            onClick={() => setOnly(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        // Without this the table just vanishes and reads as a broken screen.
        <p className="mb-4 text-[13px] text-muted">Nothing matches that.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium text-muted">
              <th className="w-2/5 py-2">Connection</th>
              <th className="py-2">Type</th>
              <th className="py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => (
              <tr key={g.title} className="border-b border-line last:border-b-0">
                <td className="py-2.5">
                  <button
                    className="flex cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 text-left font-medium text-fg hover:text-accent"
                    onClick={() => onOpen(g.title)}
                  >
                    <ConnIcon group={g} />
                    {g.title}
                  </button>
                </td>
                <td className="py-2.5 text-[13px] text-muted">{g.connection!.kind}</td>
                <td className="py-2.5 text-right">
                  <Status
                    group={g}
                    values={values}
                    result={tested[g.title]}
                    onOpen={() => onOpen(g.title)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function ConnIcon({ group }: { group: Group }) {
  const { color, icon } = group.connection!
  return (
    <span
      className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] text-sm font-bold text-white uppercase"
      style={{ background: color ?? autoColor(group.title) }}
      aria-hidden="true"
    >
      {icon ?? group.title[0]}
    </span>
  )
}

/** `backend/data.db` and friends. Inline because it is two lines of styling. */
function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-line bg-soft px-1.5 py-px text-xs">{children}</code>
  )
}

/**
 * What the list says about one connector. Four cases on purpose — "the keys are
 * filled in" and "the keys work" are different claims, and collapsing them into
 * one green tick is how you end up debugging a connection the screen swore was
 * fine.
 */
function Status({
  group,
  values,
  result,
  onOpen,
}: {
  group: Group
  values: Values
  result?: TestResult
  onOpen: () => void
}) {
  if (result) {
    return (
      <span
        className={`text-[13px] ${result.ok ? 'text-success' : 'text-danger'}`}
        title={result.message}
      >
        {result.ok ? '✓ Connected' : '✕ Failed'}
      </span>
    )
  }
  if (!group.connection!.filled(values)) {
    return (
      <button className="btn px-3.5 py-1 text-[13px]" onClick={onOpen}>
        Connect
      </button>
    )
  }
  // Filled in but unproven. Only say so where a test actually exists to run.
  return group.test ? (
    <span className="text-[13px] text-muted">Set up — not tested</span>
  ) : (
    <span className="text-[13px] text-success">✓ Set up</span>
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
    <div className="card">
      <h2>{group.title}</h2>
      {group.note && <p className="mt-0.5 mb-3.5 text-[13px] text-muted">{group.note}</p>}
      {/* Two columns; a field marked full spans both, so short fields pair up
          and the card stays short instead of one endless column. */}
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-3">
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

  if (type === 'keys') {
    return (
      <div className="col-span-full block min-w-0">
        <span className="mb-1 block text-[13px] font-medium">{label}</span>
        <KeyList value={value} onChange={(v) => onChange(key, v)} />
      </div>
    )
  }

  const locked = type === 'secret' && value.includes(MASK)

  return (
    <label className={`block min-w-0 ${half ? '' : 'col-span-full'}`}>
      <span className="mb-1 block text-[13px] font-medium">
        {label}
        {locked && (
          <button type="button" className="btn-link ml-2" onClick={() => onChange(key, '')}>
            Change
          </button>
        )}
      </span>

      {type === 'select' ? (
        <select className="input" value={value} onChange={(e) => onChange(key, e.target.value)}>
          {!options?.includes(value) && <option value={value}>{value || '—'}</option>}
          {options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="input"
          type={type === 'number' ? 'number' : 'text'}
          value={value}
          readOnly={locked}
          placeholder={placeholder}
          onChange={(e) => onChange(key, e.target.value)}
        />
      )}

      {help && <em className="mt-1 block text-xs text-muted">{help}</em>}
    </label>
  )
}
