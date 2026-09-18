import { useState } from 'react'

/**
 * A named list of API keys: one row by default, "+ Add key" for spares.
 *
 * Stored as a JSON string in one setting, so the backend needs no extra table.
 * Each entry carries an `id` the backend matches on when merging masked values
 * back in — that is what lets you add a fourth key without retyping the first
 * three, and rename or reorder without losing any.
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
  // The placeholder row's id is minted ONCE. Generating it inline would hand
  // React a new `key` on every parent re-render — which happens on every
  // keystroke in any other field — tearing the row down and losing focus.
  const [placeholder] = useState(blank)

  // Always show at least one row, but do not write it to state until the user
  // types: an empty row must not count as a key.
  const entries = parse(value)
  const rows = entries.length ? entries : [placeholder]

  const commit = (next: Entry[]) => onChange(JSON.stringify(next))

  const edit = (id: string, patch: Partial<Entry>) =>
    commit(rows.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  return (
    <div className="keylist">
      {rows.map((e, i) => {
        const locked = e.value.includes(MASK)
        return (
          <div key={e.id} className="keyrow">
            <input
              className="keyname"
              value={e.name}
              placeholder={i === 0 ? 'Main' : `Spare ${i}`}
              onChange={(ev) => edit(e.id, { name: ev.target.value })}
            />
            <input
              className="keyval"
              value={e.value}
              readOnly={locked}
              placeholder="paste the API key"
              onChange={(ev) => edit(e.id, { value: ev.target.value })}
            />
            {locked ? (
              <button
                type="button"
                className="icon"
                title="Replace this key"
                // Clear it so the user retypes: merging a typed fragment with a
                // masked one would be guesswork.
                onClick={() => edit(e.id, { value: '' })}
              >
                ✎
              </button>
            ) : (
              <span className="icon-spacer" />
            )}
            <button
              type="button"
              className="icon"
              title="Remove"
              disabled={rows.length === 1 && !e.name && !e.value}
              onClick={() => commit(rows.filter((r) => r.id !== e.id))}
            >
              ×
            </button>
          </div>
        )
      })}

      <button type="button" className="link" onClick={() => commit([...rows, blank()])}>
        + Add key
      </button>
    </div>
  )
}
