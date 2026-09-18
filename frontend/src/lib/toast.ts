export type ToastType = 'success' | 'error' | 'info' | 'warning'

export type ToastItem = {
  id: string
  message: string
  type: ToastType
  duration?: number
}

type Listener = (toasts: ToastItem[]) => void

let toasts: ToastItem[] = []
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach((fn) => fn([...toasts]))
}

export const toast = {
  show: (message: string, type: ToastType = 'info', duration = 3500) => {
    const id = Math.random().toString(36).slice(2, 9)
    const item: ToastItem = { id, message, type, duration }
    toasts = [...toasts, item]
    notify()

    if (duration > 0) {
      setTimeout(() => {
        toast.dismiss(id)
      }, duration)
    }
    return id
  },
  success: (msg: string, duration?: number) => toast.show(msg, 'success', duration),
  error: (msg: string, duration?: number) => toast.show(msg, 'error', duration || 4500),
  info: (msg: string, duration?: number) => toast.show(msg, 'info', duration),
  warning: (msg: string, duration?: number) => toast.show(msg, 'warning', duration),
  dismiss: (id: string) => {
    toasts = toasts.filter((t) => t.id !== id)
    notify()
  },
  subscribe: (fn: Listener) => {
    listeners.add(fn)
    fn([...toasts])
    return () => {
      listeners.delete(fn)
    }
  },
}
