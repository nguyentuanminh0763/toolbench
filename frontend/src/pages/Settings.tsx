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

type Group = {
  title: string
  note?: string
  fields: Field[]
  /** Optional check button. It runs against the SAVED settings, not the form. */
  test?: { label: string; run: () => Promise<TestResult> }
}

const GROUPS: Group[] = [
  {
    title: 'WordPress',
    note: 'Application password, not the login password. Users → Profile → Application Passwords.',
    test: { label: 'Test connection', run: api.testWordpress },
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

export default function Settings() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Unsaved edits matter here: the test button checks what is in the database,
  // not what is on screen. Without this the user tests the old values and
  // cannot work out why the fix did nothing.
  const [dirty, setDirty] = useState(false)

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
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h1>Settings</h1>
      <p className="muted">
        Stored in <code>backend/data.db</code> on this machine. Never committed,
        never sent anywhere.
      </p>

      {GROUPS.map((g) => {
        const shown = g.fields.filter((f) => !f.when || f.when(values))
        return (
          <div key={g.title} className="card">
            <h2>{g.title}</h2>
            {g.note && <p className="muted">{g.note}</p>}
            <div className="grid">
              {shown.map((f) => (
                <Row key={f.key} field={f} value={values[f.key] ?? ''} onChange={set} />
              ))}
            </div>
            {g.test && <TestButton label={g.test.label} run={g.test.run} dirty={dirty} />}
          </div>
        )
      })}

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
