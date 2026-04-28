"use client"

import { useEffect, useRef } from "react"

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const state = useRef({ mouseX: 0, mouseY: 0 })

  useEffect(() => {
    // Only activate on true pointer devices
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return
    // Respect reduced-motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const s = state.current
    s.mouseX = window.innerWidth / 2
    s.mouseY = window.innerHeight / 2

    let rafId: number

    const onMove = (e: MouseEvent) => {
      s.mouseX = e.clientX
      s.mouseY = e.clientY
      if (dotRef.current) dotRef.current.style.opacity = "1"
    }

    const onOver = (e: MouseEvent) => {
      const el = e.target as Element
      if (el.closest("button, a, input, textarea, [role='button'], label, select")) {
        dotRef.current?.classList.add("cursor-dot-hover")
      }
    }

    const onOut = (e: MouseEvent) => {
      const el = e.target as Element
      if (el.closest("button, a, input, textarea, [role='button'], label, select")) {
        dotRef.current?.classList.remove("cursor-dot-hover")
      }
    }

    const tick = () => {
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${s.mouseX}px, ${s.mouseY}px)`
      }
      rafId = requestAnimationFrame(tick)
    }

    window.addEventListener("mousemove", onMove, { passive: true })
    document.addEventListener("mouseover", onOver, { passive: true })
    document.addEventListener("mouseout", onOut, { passive: true })
    rafId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseover", onOver)
      document.removeEventListener("mouseout", onOut)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <>
      <div className="cursor-dot" ref={dotRef} aria-hidden="true">
        <span className="cursor-paw-pad cursor-paw-pad-main" />
        <span className="cursor-paw-pad cursor-paw-pad-toe cursor-paw-pad-toe-1" />
        <span className="cursor-paw-pad cursor-paw-pad-toe cursor-paw-pad-toe-2" />
        <span className="cursor-paw-pad cursor-paw-pad-toe cursor-paw-pad-toe-3" />
        <span className="cursor-paw-pad cursor-paw-pad-toe cursor-paw-pad-toe-4" />
      </div>
    </>
  )
}
