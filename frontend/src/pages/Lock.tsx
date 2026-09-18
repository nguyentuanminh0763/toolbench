import { useState } from 'react'
import { api, ApiError, token } from '../lib/api'
import {
  Lock as LockIcon,
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
  AlertCircle,
  Database,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'

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
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-fg">
        <span>{label}</span>
      </span>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted/60">
          <KeyRound className="h-4 w-4" />
        </div>
        <input
          className="input pl-9.5 pr-10 py-2.5 text-sm"
          type={shown ? 'text' : 'password'}
          value={value}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          placeholder="••••••••••••"
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="icon-btn h-8 w-8 absolute right-1.5 top-1/2 -translate-y-1/2"
          onClick={() => setShown(!shown)}
          title={shown ? 'Hide password' : 'Show password'}
          aria-label={shown ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  )
}

function PasswordStrength({ pass }: { pass: string }) {
  if (!pass) return null
  let score = 0
  if (pass.length >= 8) score++
  if (pass.length >= 12) score++
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++
  if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score++

  const labels = ['Too short', 'Weak', 'Fair', 'Strong', 'Excellent']
  const colors = [
    'bg-rose-500',
    'bg-rose-500',
    'bg-amber-500',
    'bg-indigo-500',
    'bg-emerald-500',
  ]

  return (
    <div className="flex flex-col gap-1 mt-2">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>Vault Password Strength:</span>
        <span className="font-semibold text-fg">{labels[score]}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              score > i ? colors[score] : 'bg-line'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

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

    if (setupMode && password.length < 6) {
      setError('Password must be at least 6 characters long.')
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
    <div className="relative flex min-h-screen items-center justify-center p-6 bg-bg overflow-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-600/15 blur-3xl" />

      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <form
          className="card p-8 border-line shadow-2xl backdrop-blur-xl bg-card/90"
          onSubmit={submit}
        >
          {/* Header Icon */}
          <div className="flex flex-col items-center text-center">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-accent to-purple-600 text-white shadow-lg shadow-accent/30 mb-4">
              {setupMode ? <Sparkles className="h-7 w-7" /> : <LockIcon className="h-7 w-7" />}
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-card border border-line text-emerald-500">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
            </div>

            <h1 className="text-xl font-bold tracking-tight text-fg">
              {setupMode ? 'Initialize Security Vault' : 'Unlock Toolbench Vault'}
            </h1>

            <p className="mt-1.5 text-xs text-muted leading-relaxed max-w-xs">
              {setupMode
                ? 'Create a master password. It encrypts all local credentials in data.db using AES-GCM. Keep it safe — there is no reset.'
                : 'Enter your master vault password to decrypt stored secrets and resume session.'}
            </p>
          </div>

          {/* Form Fields */}
          <div className="mt-6 flex flex-col gap-4">
            <PasswordField
              label={setupMode ? 'Master Vault Password' : 'Password'}
              value={password}
              onChange={setPassword}
              autoFocus
              autoComplete={setupMode ? 'new-password' : 'current-password'}
            />

            {setupMode && (
              <>
                <PasswordStrength pass={password} />

                <PasswordField
                  label="Confirm Master Password"
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                />
              </>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-danger/30 bg-danger/10 text-danger text-xs animate-in fade-in duration-150">
                <AlertCircle className="h-4 w-4 flex-none" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <button
              className="btn-primary w-full py-2.5 text-sm mt-2 font-semibold shadow-md shadow-accent/20"
              type="submit"
              disabled={busy || !password}
            >
              {busy ? (
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Decrypting vault…</span>
                </div>
              ) : setupMode ? (
                'Create & Initialize Vault'
              ) : (
                'Unlock Workspace'
              )}
            </button>
          </div>

          {/* Footer security badge */}
          <div className="mt-6 pt-5 border-t border-line/70 flex items-center justify-between text-[11px] text-muted">
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-accent" />
              <span>data.db · Local PBKDF2</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>127.0.0.1 Isolated</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
