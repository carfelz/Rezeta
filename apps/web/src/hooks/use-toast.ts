import { useState, useCallback } from 'react'
import type { ToastProps } from '@/components/ui/Toast'

interface ToastState extends Omit<ToastProps, 'open' | 'onOpenChange'> {
  id: string
  title?: string
  description?: string
  open: boolean
}

interface ToastOptions extends Omit<ToastProps, 'open' | 'onOpenChange'> {
  title?: string
  description?: string
  duration?: number
}

let toastCounter = 0

export function useToast(): {
  toasts: ToastState[]
  toast: (options: ToastOptions) => void
  dismiss: (id: string) => void
} {
  const [toasts, setToasts] = useState<ToastState[]>([])

  const toast = useCallback(({ duration = 3000, ...options }: ToastOptions) => {
    const id = String(++toastCounter)
    setToasts((prev) => [...prev, { ...options, id, open: true }])
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, open: false } : t)))
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 200)
    }, duration)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, open: false } : t)))
  }, [])

  return { toasts, toast, dismiss }
}
