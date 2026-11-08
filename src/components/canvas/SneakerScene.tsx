'use client'

import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ModelLoader } from '@/components/canvas/SneakerModel'
import { Language } from '@/types'
import { ui } from '@/lib/ui-copy'
import { Scene } from '@/components/canvas/Scene'

gsap.registerPlugin(ScrollTrigger)

const colorways = [
  { name: 'Midnight', color: '#2580a6' },
  { name: 'Beach', color: '#e1c0a4' },
  { name: 'Street', color: '#797b80' },
]

interface SneakerSceneProps {
  language: Language
  onStageChange?: (stage: number) => void
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 1024 || window.innerHeight > window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return isMobile
}

export function SneakerScene({ onStageChange, language }: SneakerSceneProps) {
  const [reduced, setReduced] = useState<boolean | null>(null)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const progressRef = useRef(0)
  const isMobile = useIsMobile()
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const element = document.getElementById('story')
    if (!element) return
    let inView = true
    const sync = () => setVisible(inView && !document.hidden)
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting && entry.intersectionRatio > 0.01
        sync()
      },
      { threshold: [0, 0.01] },
    )
    observer.observe(element)
    document.addEventListener('visibilitychange', sync)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])
  const [stage, setStage] = useState(1)
  const [colorway, setColorway] = useState(0)
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem('northx-colorway') ?? 0)
      if (Number.isInteger(saved) && saved >= 0 && saved < colorways.length) setColorway(saved)
    } catch {
      /* Selection remains usable when storage is unavailable. */
    }
  }, [])
  const selectColorway = (index: number) => {
    setColorway(index)
    try {
      localStorage.setItem('northx-colorway', String(index))
    } catch {
      /* Optional persistence. */
    }
  }

  useEffect(() => {
    if (reduced !== false) {
      onStageChange?.(1)
      return
    }
    const driver = { progress: 0 }
    let activeStage = 1
    const syncProgress = (value: number) => {
      progressRef.current = value
      const nextStage = value < 0.3 ? 1 : value < 0.7 ? 2 : 3
      if (nextStage !== activeStage) {
        activeStage = nextStage
        setStage(nextStage)
        onStageChange?.(nextStage)
      }
    }

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: '#story',
        start: 'top top',
        end: '+=200%',
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    })
    timeline.to(driver, { progress: 1, duration: 6, ease: 'none', onUpdate: () => syncProgress(driver.progress) })
    syncProgress(0)
    return () => {
      timeline.scrollTrigger?.kill()
      timeline.kill()
    }
  }, [onStageChange, reduced])

  if (reduced !== false) return null
  return (
    <>
      <div className='canvas-shell' style={{ visibility: visible ? 'visible' : 'hidden' }} aria-hidden='true'>
        <Canvas
          frameloop={visible ? 'always' : 'never'}
          dpr={isMobile ? [1, 1.5] : [1, 2]}
          camera={{ position: [0, isMobile ? 1.2 : 1.65, isMobile ? 6.2 : 7.5], fov: isMobile ? 50 : 38 }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 0.9
          }}
        >
          <Suspense fallback={null}>
            <Scene progressRef={progressRef} colorway={colorway} stage={stage} />
          </Suspense>
        </Canvas>
        <ModelLoader label={ui(language, 'loading')} />
      </div>
      <div className={`colorway-switcher ${visible ? 'is-visible' : ''}`} aria-hidden={!visible}>
        <span>
          {ui(language, 'palette')} / 0{colorway + 1}
        </span>
        <div>
          {colorways.map((option, index) => (
            <button
              key={option.name}
              className={colorway === index ? 'active' : ''}
              onClick={() => selectColorway(index)}
              tabIndex={visible ? 0 : -1}
              aria-pressed={colorway === index}
              aria-label={ui(language, index === 0 ? 'midnight' : index === 1 ? 'beach' : 'street')}
              title={ui(language, index === 0 ? 'midnight' : index === 1 ? 'beach' : 'street')}
            >
              <i style={{ background: option.color }} />
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
