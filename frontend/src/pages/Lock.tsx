import { useState } from 'react'
import { api, ApiError, token } from '../lib/api'

/** Password box with a reveal toggle. Typing a long password blind and getting
 *  "do not match" twice is how people give up and pick something weak. */
function PasswordField({
  label,
  value,
  onChange,
  autoFocus,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
  autoComplete?: string
}) {
  const [shown, setShown] = useState(false)

  return (
    <label className="field full">
      <span className="label">{label}</span>
      <div className="withicon">
        <input
          type={shown ? 'text' : 'password'}
          value={value}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="icon reveal"
          onClick={() => setShown(!shown)}
          title={shown ? 'Hide' : 'Show'}
          aria-label={shown ? 'Hide password' : 'Show password'}
          // Keep it out of the tab order: it is a convenience, and stopping
          // between the two password boxes to skip a button is annoying.
          tabIndex={-1}
        >
          <Eye off={shown} />
        </button>
      </div>
    </label>
  )
}

/** Inline SVG rather than an icon library — two paths, and it follows
 *  currentColor so it works in both themes. */
function Eye({ off }: { off: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.8 12S5.5 5 12 5s10.2 7 10.2 7-3.7 7-10.2 7S1.8 12 1.8 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  )
}

/**
 * Two screens in one: create the password on a fresh install, enter it every
 * time after. Which one shows is decided by the server, not by the browser.
 */
export default function Lock({
  configured,
  onUnlocked,
}: {
  configured: boolean
  onUnlocked: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const setupMode = !configured

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (setupMode && password !== confirm) {
      setError('The two passwords do not match.')
      return
    }

    setBusy(true)
    try {
      const r = setupMode ? await api.setup(password) : await api.unlock(password)
      token.set(r.token)
      onUnlocked()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
      setPassword('')
      setConfirm('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lockscreen">
      <form className="card lockcard" onSubmit={submit}>
        <h2>{setupMode ? 'Choose a password' : 'Unlock'}</h2>
        <p className="muted">
          {setupMode
            ? 'It encrypts the API keys and passwords stored on this machine. Nobody can read them from data.db without it — including you, so keep it somewhere safe. There is no reset.'
            : 'Enter the password you set on this machine.'}
        </p>

        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoFocus
          autoComplete={setupMode ? 'new-password' : 'current-password'}
        />

        {setupMode && (
          <PasswordField
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
        )}

        <div className="row">
          <button className="primary" type="submit" disabled={busy || !password}>
            {busy ? 'Working…' : setupMode ? 'Create' : 'Unlock'}
          </button>
          {error && <span className="error">{error}</span>}
        </div>
      </form>
    </div>
  )
}
