'use client'
import Lenis from 'lenis'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { PropsWithChildren, useEffect } from 'react'
export function SmoothScroll({ children }: PropsWithChildren) {
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (preference.matches) return
    const lenis = new Lenis({ lerp: 0.12, smoothWheel: true, anchors: true })
    let frame = 0
    let lastInput = 0
    const tick = (time: number) => {
      lenis.raf(time)
      if (!document.hidden && (lenis.isScrolling || performance.now() - lastInput < 180))
        frame = requestAnimationFrame(tick)
      else frame = 0
    }
    const wake = () => {
      lastInput = performance.now()
      if (!frame && !document.hidden) frame = requestAnimationFrame(tick)
    }
    lenis.on('scroll', ScrollTrigger.update)
    const events = ['wheel', 'touchstart', 'touchmove', 'keydown', 'click', 'scroll', 'visibilitychange'] as const
    events.forEach((event) => window.addEventListener(event, wake, { passive: true }))
    wake()
    return () => {
      cancelAnimationFrame(frame)
      events.forEach((event) => window.removeEventListener(event, wake))
      lenis.destroy()
    }
  }, [])
  return <>{children}</>
}
