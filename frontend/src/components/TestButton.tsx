import { useState } from 'react'
import { ApiError, type TestResult } from '../lib/api'

/**
 * "Test connection" for a settings group.
 *
 * It checks what is stored, not what is on screen — so it refuses to run while
 * there are unsaved edits. Testing stale values and reporting success is worse
 * than not testing at all.
 */
export default function TestButton({
  label,
  run,
  dirty,
}: {
  label: string
  run: () => Promise<TestResult>
  dirty: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  async function click() {
    setBusy(true)
    setResult(null)
    try {
      setResult(await run())
    } catch (e) {
      setResult({ ok: false, message: e instanceof ApiError ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="row testrow">
      <button className="plain" type="button" onClick={click} disabled={busy || dirty}>
        {busy ? 'Testing…' : label}
      </button>
      {dirty ? (
        <span className="muted inline">Save first — this checks the stored values.</span>
      ) : (
        result && (
          <span className={result.ok ? 'ok' : 'error'}>
            {result.ok ? '✓ ' : '✕ '}
            {result.message}
          </span>
        )
      )}
    </div>
  )
}
