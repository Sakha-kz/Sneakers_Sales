'use client'

import { useGLTF, useProgress } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { MutableRefObject, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { GLTF } from 'three-stdlib'
import { phase, presentation as placementFor } from './presentation'

const MODEL_URL = '/models/sneaker.glb'

interface MaterialState {
  material: THREE.MeshStandardMaterial
}

interface PreparedModel {
  object: THREE.Group
  materials: MaterialState[]
}

function prepareModel(source: THREE.Group): PreparedModel {
  const object = source.clone(true)
  const materials: MaterialState[] = []
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material]
    const upgraded = sourceMaterials.map((sourceMaterial) => {
      const material =
        sourceMaterial instanceof THREE.MeshStandardMaterial
          ? sourceMaterial.clone()
          : new THREE.MeshStandardMaterial({ color: '#e7e8ee' })
      material.envMapIntensity = 0.5
      material.emissive = new THREE.Color(0x000000)
      material.toneMapped = true
      material.roughness = 0.75
      material.roughnessMap = null
      material.metalness = 0
      material.metalnessMap = null
      material.needsUpdate = true
      materials.push({ material })
      return material
    })
    child.material = Array.isArray(child.material) ? upgraded : upgraded[0]
    child.castShadow = true
    child.receiveShadow = true
  })
  const bounds = new THREE.Box3().setFromObject(object)
  const center = bounds.getCenter(new THREE.Vector3())
  const dimensions = bounds.getSize(new THREE.Vector3())
  const scale = 2.65 / Math.max(dimensions.x, dimensions.z, 0.01)
  object.scale.setScalar(scale)
  object.position.set(-center.x * scale, -center.y * scale, -center.z * scale)
  return { object, materials }
}

export function SneakerModel({
  progressRef,
  colorway,
  stage,
}: {
  progressRef: MutableRefObject<number>
  colorway: number
  stage: number
}) {
  const { scene, parser } = useGLTF(MODEL_URL) as GLTF
  const { size } = useThree()
  const prepared = useMemo(() => prepareModel(scene), [scene])
  const presentation = useRef<THREE.Group>(null)
  const placement = placementFor(size.width, size.height)
  useLayoutEffect(() => () => prepared.materials.forEach(({ material }) => material.dispose()), [prepared])

  const weights = useMemo(() => new THREE.Vector3(1, 0, 0), [])
  const targetWeights = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    let alive = true
    // This GLB is one intact mesh with three authored texture variants. Blending
    // its own maps preserves the white rubber and detailing in every colorway.
    void Promise.all([parser.getDependency('material', 1), parser.getDependency('material', 2)])
      .then(([beach, street]: THREE.Material[]) => {
        if (!alive || !(beach instanceof THREE.MeshStandardMaterial) || !(street instanceof THREE.MeshStandardMaterial))
          return
        prepared.materials.forEach(({ material }) => {
          material.onBeforeCompile = (shader) => {
            shader.uniforms.variantBeach = { value: beach.map }
            shader.uniforms.variantStreet = { value: street.map }
            shader.uniforms.variantWeights = { value: weights }
            shader.fragmentShader =
              'uniform sampler2D variantBeach; uniform sampler2D variantStreet; uniform vec3 variantWeights;\n' +
              shader.fragmentShader
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <map_fragment>',
              THREE.ShaderChunk.map_fragment.replace(
                'texture2D( map, vMapUv )',
                '(texture2D(map, vMapUv) * variantWeights.x + texture2D(variantBeach, vMapUv) * variantWeights.y + texture2D(variantStreet, vMapUv) * variantWeights.z)',
              ),
            )
          }
          material.customProgramCacheKey = () => 'northx-authored-variants-v1'
          material.needsUpdate = true
        })
      })
      .catch(() => {
        /* Keep the original material if an optional variant cannot load. */
      })
    return () => {
      alive = false
    }
  }, [parser, prepared, weights])
  useFrame((state, delta) => {
    const progress = progressRef.current
    // Lid is fully open before the shoe starts rising. Both share BOX coordinates.
    const lift = phase(progress, 0.12, 0.25)
    // A full revolution starts only after the box has faded. Scroll back reverses it.
    const rotation = Math.PI * 2 * phase(progress, 0.32, 0.7) + phase(progress, 0.72, 0.92) * 0.42
    if (presentation.current) {
      presentation.current.position.set(
        placement.x,
        placement.y + THREE.MathUtils.lerp(0, 1.55, lift) * placement.scale,
        0,
      )
      presentation.current.rotation.set(0, rotation, 0)
      presentation.current.scale.setScalar(placement.scale * (1 + phase(progress, 0.32, 0.42) * 0.16))
    }
    const variant = colorway
    targetWeights.set(variant === 0 ? 1 : 0, variant === 1 ? 1 : 0, variant === 2 ? 1 : 0)
    weights.lerp(targetWeights, 1 - Math.exp(-8 * Math.min(delta, 0.05)))
  })
  return (
    <group ref={presentation} position={[placement.x, placement.y, 0]} scale={placement.scale} dispose={null}>
      <primitive object={prepared.object} />
    </group>
  )
}

export function ModelLoader({ label }: { label: string }) {
  const active = useProgress((state) => state.active)
  return active ? (
    <div className='model-loader' role='status'>
      <span />
      <b>{label}</b>
    </div>
  ) : null
}
useGLTF.preload(MODEL_URL)
