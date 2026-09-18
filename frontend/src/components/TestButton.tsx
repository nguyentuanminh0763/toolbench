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
  onResult,
}: {
  label: string
  run: () => Promise<TestResult>
  dirty: boolean
  /** Lets the caller show the same verdict somewhere else — the connector list. */
  onResult?: (result: TestResult) => void
}) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  async function click() {
    setBusy(true)
    setResult(null)
    let outcome: TestResult
    try {
      outcome = await run()
    } catch (e) {
      outcome = { ok: false, message: e instanceof ApiError ? e.message : String(e) }
    }
    setResult(outcome)
    onResult?.(outcome)
    setBusy(false)
  }

  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
      <button
        className="btn px-3.5 py-1.5 text-[13px]"
        type="button"
        onClick={click}
        disabled={busy || dirty}
      >
        {busy ? 'Testing…' : label}
      </button>
      {dirty ? (
        <span className="text-[13px] text-muted">Save first — this checks the stored values.</span>
      ) : (
        result && (
          <span className={`text-[13px] ${result.ok ? 'text-success' : 'text-danger'}`}>
            {result.ok ? '✓ ' : '✕ '}
            {result.message}
          </span>
        )
      )}
    </div>
  )
}
