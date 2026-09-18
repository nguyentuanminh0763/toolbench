import { useState } from 'react'
import { ApiError, type TestResult } from '../lib/api'
import { RefreshCw, CheckCircle2, AlertCircle, Info } from 'lucide-react'

/**
 * "Test connection" for a settings group.
 * Checks what is stored in the database, refusing to run while dirty.
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
    <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-3">
      <button
        className="btn text-xs py-1.5 px-3"
        type="button"
        onClick={click}
        disabled={busy || dirty}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin text-accent' : 'text-muted'}`} />
        <span>{busy ? 'Testing connection…' : label}</span>
      </button>

      {dirty ? (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
          <Info className="h-3.5 w-3.5 flex-none" />
          <span>Save changes first to test live values</span>
        </div>
      ) : (
        result && (
          <div
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${
              result.ok
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 flex-none" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 flex-none" />
            )}
            <span className="font-medium">{result.message}</span>
          </div>
        )
      )}
    </div>
  )
}
