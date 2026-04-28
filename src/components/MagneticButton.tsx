"use client"

import { useRef } from "react"
import type { ReactNode, MouseEvent as RMouseEvent } from "react"

type MagneticButtonProps = {
  children: ReactNode
  className?: string
  onClick?: () => void
  type?: "button" | "submit" | "reset"
}

export function MagneticButton({
  children,
  className,
  onClick,
  type = "button",
}: MagneticButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null)

  function onMouseMove(e: RMouseEvent<HTMLButtonElement>) {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return
    const el = btnRef.current
    if (!el) return
    const { left, top, width, height } = el.getBoundingClientRect()
    const x = e.clientX - left - width / 2
    const y = e.clientY - top - height / 2
    el.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px) scale(1.03)`
  }

  function onMouseEnter() {
    const el = btnRef.current
    if (!el) return
    el.style.transition = "transform 0.08s linear, border-color 0.18s ease, background 0.18s ease"
  }

  function onMouseLeave() {
    const el = btnRef.current
    if (!el) return
    el.style.transition =
      "transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.18s ease, background 0.18s ease"
    el.style.transform = "translate(0, 0) scale(1)"
  }

  return (
    <button
      ref={btnRef}
      type={type}
      className={className}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </button>
  )
}
