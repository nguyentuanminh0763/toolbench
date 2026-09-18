import { useState } from 'react'
import { ApiError } from '../../lib/api'
import { exampleTwoApi, type Result } from './api'

/** A screen that sends something in and shows what came back. */
export default function ExampleTwo() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run() {
    setError('')
    setResult(null)
    setBusy(true)
    try {
      setResult(await exampleTwoApi.process(text))
    } catch (e) {
      // The 400 from core.InvalidInput arrives here as a readable sentence.
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h1>Example two</h1>
      <p className="muted">
        A screen that sends input. Validation lives in{' '}
        <code>features/example_two/core.py</code>, not in the route.
      </p>

      <div className="card">
        <label className="field full">
          <span className="label">Text</span>
          <input
            value={text}
            placeholder="type anything"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
        </label>

        <div className="row">
          <button className="primary" onClick={run} disabled={busy}>
            {busy ? 'Working…' : 'Run'}
          </button>
          {error && <span className="error">{error}</span>}
        </div>

        {result && (
          <table className="table">
            <tbody>
              <tr>
                <td className="muted inline">Characters</td>
                <td>{result.characters}</td>
              </tr>
              <tr>
                <td className="muted inline">Words</td>
                <td>{result.words}</td>
              </tr>
              <tr>
                <td className="muted inline">Unique words</td>
                <td>{result.unique_words}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
