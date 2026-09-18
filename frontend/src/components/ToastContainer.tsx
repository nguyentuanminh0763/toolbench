import { useEffect, useState } from 'react'
import { toast, type ToastItem } from '../lib/toast'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

export default function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    return toast.subscribe(setItems)
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {items.map((t) => {
        const icons = {
          success: <CheckCircle2 className="w-4 h-4 text-success flex-none" />,
          error: <AlertCircle className="w-4 h-4 text-danger flex-none" />,
          warning: <AlertTriangle className="w-4 h-4 text-warning flex-none" />,
          info: <Info className="w-4 h-4 text-accent flex-none" />,
        }

        const borders = {
          success: 'border-success/30 bg-card/95 text-fg shadow-lg shadow-success/5',
          error: 'border-danger/30 bg-card/95 text-fg shadow-lg shadow-danger/5',
          warning: 'border-warning/30 bg-card/95 text-fg shadow-lg shadow-warning/5',
          info: 'border-accent/30 bg-card/95 text-fg shadow-lg shadow-accent/5',
        }

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${borders[t.type]}`}
          >
            <div className="mt-0.5">{icons[t.type]}</div>
            <p className="flex-1 text-xs font-medium leading-relaxed">{t.message}</p>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="text-muted hover:text-fg p-0.5 rounded-md hover:bg-soft transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
