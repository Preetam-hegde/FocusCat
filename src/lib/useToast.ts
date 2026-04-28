"use client"

import { useCallback, useState } from "react"

export type ToastKind = "success" | "info" | "warn"

export type ToastItem = {
  id: number
  message: string
  kind: ToastKind
}

let _nextId = 1

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = _nextId++
    setToasts((prev) => [...prev, { id, message, kind }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}
