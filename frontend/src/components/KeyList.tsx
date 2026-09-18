import { useState } from 'react'
import { Plus, Trash2, Pencil, Copy, Check, Key } from 'lucide-react'
import { toast } from '../lib/toast'

/**
 * A named list of API keys: one row by default, "+ Add key" for spares.
 * Stored as a JSON string in one setting, so the backend needs no extra table.
 */
const MASK = '••••••••'

type Entry = { id: string; name: string; value: string }

const newId = () => Math.random().toString(36).slice(2, 10)
const blank = (): Entry => ({ id: newId(), name: '', value: '' })

function parse(raw: string): Entry[] {
  try {
    const items = JSON.parse(raw || '[]')
    if (!Array.isArray(items)) return []
    return items.map((i) => ({
      id: String(i?.id || newId()),
      name: String(i?.name || ''),
      value: String(i?.value || ''),
    }))
  } catch {
    return []
  }
}

export default function KeyList({
  value,
  onChange,
}: {
  value: string
  onChange: (raw: string) => void
}) {
  const [placeholder] = useState(blank)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const entries = parse(value)
  const rows = entries.length ? entries : [placeholder]

  const commit = (next: Entry[]) => onChange(JSON.stringify(next))

  const edit = (id: string, patch: Partial<Entry>) =>
    commit(rows.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  const copyKey = async (id: string, val: string) => {
    if (!val || val.includes(MASK)) return
    try {
      await navigator.clipboard.writeText(val)
      setCopiedId(id)
      toast.success('API Key copied to clipboard')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Failed to copy key')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((e, i) => {
        const locked = e.value.includes(MASK)
        return (
          <div
            key={e.id}
            className="grid grid-cols-[minmax(120px,1fr)_minmax(0,2.5fr)_auto_auto] items-center gap-2 p-2 rounded-xl border border-line bg-card/60 shadow-2xs"
          >
            {/* Key label */}
            <div className="relative">
              <input
                className="input py-1.5 px-2.5 text-xs"
                value={e.name}
                placeholder={i === 0 ? 'Primary Key' : `Backup Key ${i}`}
                onChange={(ev) => edit(e.id, { name: ev.target.value })}
              />
            </div>

            {/* Key secret input */}
            <div className="relative">
              <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/60">
                <Key className="h-3.5 w-3.5" />
              </div>
              <input
                className="input pl-8 py-1.5 px-2.5 font-mono text-xs text-fg tracking-wide"
                value={e.value}
                readOnly={locked}
                placeholder="Paste your API key (e.g. sk-ant-..., AIza...)"
                onChange={(ev) => edit(e.id, { value: ev.target.value })}
              />
            </div>

            {/* Replace / Copy actions */}
            <div className="flex items-center gap-1">
              {!locked && e.value && (
                <button
                  type="button"
                  className="icon-btn h-7 w-7"
                  title="Copy API key"
                  onClick={() => copyKey(e.id, e.value)}
                >
                  {copiedId === e.id ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              )}

              {locked ? (
                <button
                  type="button"
                  className="icon-btn h-7 w-7 text-accent hover:bg-accent/10"
                  title="Replace / update this masked key"
                  onClick={() => edit(e.id, { value: '' })}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className="w-1" />
              )}
            </div>

            {/* Remove button */}
            <button
              type="button"
              className="icon-btn h-7 w-7 hover:text-danger hover:bg-danger/10"
              title="Remove key"
              disabled={rows.length === 1 && !e.name && !e.value}
              onClick={() => commit(rows.filter((r) => r.id !== e.id))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}

      <button
        type="button"
        className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover py-1 px-2 rounded-lg hover:bg-accent/5 transition-colors"
        onClick={() => commit([...rows, blank()])}
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Add spare rotation key</span>
      </button>
    </div>
  )
}
