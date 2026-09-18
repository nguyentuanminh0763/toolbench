import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function Home() {
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    api.health().then((r) => setOk(r.ok)).catch(() => setOk(false))
  }, [])

  return (
    <section>
      <h1>Home</h1>
      <p className="mb-4 text-[13px] text-muted">
        Backend: {ok === null ? 'checking…' : ok ? 'connected' : 'unreachable'}
      </p>
      <p className="mb-4 text-[13px] text-muted">
        Replace this page with the tool's first screen.
      </p>
    </section>
  )
}
