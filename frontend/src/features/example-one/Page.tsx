import { useEffect, useState } from 'react'
import { ApiError } from '../../lib/api'
import { exampleOneApi, type Summary } from './api'

/** A read-only screen: fetch on open, show the result. */
export default function ExampleOne() {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState('')

  const load = () =>
    exampleOneApi
      .summary()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)))

  useEffect(() => {
    load()
  }, [])

  return (
    <section>
      <h1>Example one</h1>
      <p className="muted">
        A read-only screen. Frontend in <code>features/example-one/</code>,
        backend in <code>backend/app/features/example_one/</code>.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="card">
        {data ? (
          <table className="table">
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.label}>
                  <td className="muted inline">{r.label}</td>
                  <td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted inline">Loading…</p>
        )}
        <div className="row">
          <button className="plain" onClick={load}>
            Refresh
          </button>
        </div>
      </div>
    </section>
  )
}
