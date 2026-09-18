import { useEffect, useState } from 'react'
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
   */
  connection?: { kind: string; filled: (v: Values) => boolean }
}

const GROUPS: Group[] = [
  {
    title: 'WordPress',
    note: 'Application password, not the login password. Users → Profile → Application Passwords.',
    test: { label: 'Test connection', run: api.testWordpress },
    connection: {
      kind: 'Site',
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

      <div className="subtabs">
        <button
          className={tab === 'general' ? 'active' : ''}
          onClick={() => show('general')}
        >
          General
        </button>
        <button
          className={tab === 'connections' ? 'active' : ''}
          onClick={() => show('connections')}
        >
          Connections
        </button>
      </div>

      {tab === 'general' ? (
        <>
          <p className="muted">
            Stored in <code>backend/data.db</code> on this machine. Never committed,
            never sent anywhere.
          </p>
          {GENERAL.map((g) => (
            <GroupCard key={g.title} group={g} values={values} set={set} dirty={dirty} />
          ))}
        </>
      ) : editing ? (
        <>
          <button className="link back" onClick={() => setOpen('')}>
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
        <>
          <p className="muted">
            Credentials for the places this tool talks to. They stay in{' '}
            <code>backend/data.db</code> on this machine.
          </p>
          <table className="table conns">
            <tbody>
              {CONNECTIONS.map((g) => (
                <tr key={g.title}>
                  <td>
                    <button className="rowname" onClick={() => setOpen(g.title)}>
                      {g.title}
                    </button>
                  </td>
                  <td className="muted inline">{g.connection!.kind}</td>
                  <td>
                    <Status group={g} values={values} result={tested[g.title]} onOpen={() => setOpen(g.title)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="savebar">
        <button className="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="ok">{saved}</span>}
        {error && <span className="error">{error}</span>}
      </div>
    </section>
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
      <span className={result.ok ? 'ok' : 'error'} title={result.message}>
        {result.ok ? '✓ Connected' : '✕ Failed'}
      </span>
    )
  }
  if (!group.connection!.filled(values)) {
    return (
      <button className="plain" onClick={onOpen}>
        Connect
      </button>
    )
  }
  // Filled in but unproven. Only say so where a test actually exists to run.
  return group.test ? (
    <span className="muted inline">Set up — not tested</span>
  ) : (
    <span className="ok">✓ Set up</span>
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
      {group.note && <p className="muted">{group.note}</p>}
      <div className="grid">
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
      <div className="field full">
        <span className="label">{label}</span>
        <KeyList value={value} onChange={(v) => onChange(key, v)} />
      </div>
    )
  }

  const locked = type === 'secret' && value.includes(MASK)

  return (
    <label className={`field${half ? '' : ' full'}`}>
      <span className="label">
        {label}
        {locked && (
          <button type="button" className="link" onClick={() => onChange(key, '')}>
            Change
          </button>
        )}
      </span>

      {type === 'select' ? (
        <select value={value} onChange={(e) => onChange(key, e.target.value)}>
          {!options?.includes(value) && <option value={value}>{value || '—'}</option>}
          {options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type === 'number' ? 'number' : 'text'}
          value={value}
          readOnly={locked}
          placeholder={placeholder}
          onChange={(e) => onChange(key, e.target.value)}
        />
      )}

      {help && <em className="hint">{help}</em>}
    </label>
  )
}
