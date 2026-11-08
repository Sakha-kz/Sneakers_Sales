'use client'

import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import { MutableRefObject, useMemo } from 'react'
import * as THREE from 'three'
import { SneakerModel } from '@/components/canvas/SneakerModel'
import { phase, presentation } from '@/components/canvas/presentation'

import { Shoebox } from './Shoebox'

interface SceneProps {
  progressRef: MutableRefObject<number>
  colorway: number
  stage: number
}

function CameraRig({ progressRef }: Pick<SceneProps, 'progressRef'>) {
  const size = useThree((state) => state.size)
  const position = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }, delta) => {
    const { mobile } = presentation(size.width, size.height)
    const progress = progressRef.current
    const inspection = phase(progress, 0.32, 0.62)
    const portrait = phase(progress, 0.68, 0.94)
    const fov = mobile ? 50 : 38
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    // Keep the closed box, full lid sweep and raised shoe inside one frame.
    // A gentle pan replaces the old jumps between unrelated camera positions.
    position.set(
      THREE.MathUtils.lerp(0, mobile ? 0.28 : 0.8, portrait),
      mobile ? 1.2 : 1.65,
      mobile ? 6.2 : THREE.MathUtils.lerp(7.5, 6.7, inspection),
    )
    target.set(mobile ? 0 : 0.1 + inspection * 0.18, mobile ? 0.1 : 0.45, 0)
    camera.position.lerp(position, 1 - Math.exp(-7 * Math.min(delta, 0.05)))
    camera.lookAt(target)
  })
  return null
}

export function Scene({ progressRef, colorway, stage }: SceneProps) {
  const mobile = useThree((state) => presentation(state.size.width, state.size.height).mobile)
  return (
    <>
      <color attach='background' args={['#25282d']} />
      {/* A baked local studio: no external HDRI request and no per-frame capture. */}
      <Environment resolution={128} frames={1}>
        <Lightformer
          position={[0, 4, -3]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[5, 3, 1]}
          intensity={1.5}
          color='#ffffff'
        />
        <Lightformer
          position={[-4, 1, 1]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[2, 5, 1]}
          intensity={1.2}
          color='#d8dfeb'
        />
        <Lightformer
          position={[4, 2, 2]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[2, 4, 1]}
          intensity={1.6}
          color='#ffffff'
        />
      </Environment>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 5]} intensity={1.5} color='#ffffff' />
      <directionalLight position={[-4, 3, -3]} intensity={0.7} color='#cbd4e4' />
      <Shoebox progressRef={progressRef} />
      <SneakerModel progressRef={progressRef} colorway={colorway} stage={stage} />
      <CameraRig progressRef={progressRef} />
      {/* Mobile avoids full-screen render targets and shadow-map recaptures. */}
      {!mobile && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom intensity={0.08} luminanceThreshold={0.96} luminanceSmoothing={0.02} mipmapBlur />
          <Vignette offset={0.28} darkness={0.22} />
        </EffectComposer>
      )}
    </>
  )
}
