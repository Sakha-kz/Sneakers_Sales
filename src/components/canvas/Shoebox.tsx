'use client'

import { RoundedBox, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { MutableRefObject, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BOX, phase, presentation } from './presentation'

const glowVertex = `varying vec2 glowUv;
void main() { glowUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const glowFragment = `varying vec2 glowUv;
uniform float fade;
void main() {
  vec2 p = abs(glowUv - .5) * 2.0;
  float distance = pow(pow(p.x, 4.0) + pow(p.y, 4.0), .25);
  float halo = (1.0 - smoothstep(.35, 1.0, distance)) * .32 * fade;
  gl_FragColor = vec4(.82, .90, 1.0, halo);
}`

export function Shoebox({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const size = useThree((state) => state.size)
  const placement = presentation(size.width, size.height)
  const group = useRef<THREE.Group>(null)
  const lid = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const glow = useMemo(() => ({ fade: { value: 1 } }), [])
  const materials = useRef<{ material: THREE.Material; opacity: number }[]>([])
  const label = useTexture('/northx-box-label.svg')
  useLayoutEffect(() => {
    label.colorSpace = THREE.SRGBColorSpace
    label.anisotropy = 4
    label.needsUpdate = true
    const unique = new Set<THREE.Material>()
    group.current?.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const list = Array.isArray(object.material) ? object.material : [object.material]
        list.forEach((material) => unique.add(material))
      }
    })
    materials.current = Array.from(unique).map((material) => ({ material, opacity: material.opacity }))
  }, [label])
  useFrame(() => {
    const p = progressRef.current
    const opening = phase(p, 0.01, 0.11)
    const fade = phase(p, 0.255, 0.31)
    if (lid.current) lid.current.rotation.x = (-Math.PI / 1.3) * opening
    if (group.current) {
      group.current.visible = fade < 0.999
      group.current.scale.setScalar(1 - fade * 0.12)
      group.current.position.y = -fade * 0.18
    }
    materials.current.forEach(({ material, opacity }) => {
      material.opacity = opacity * (1 - fade)
    })
    glow.fade.value = 1 - fade
    if (light.current) light.current.intensity = 0.45 * opening * (1 - fade)
  })
  const white = (
    <meshStandardMaterial color='#f5f3ee' roughness={0.72} metalness={0} envMapIntensity={0.35} transparent />
  )
  const lining = (
    <meshStandardMaterial color='#ddd9ce' roughness={0.92} metalness={0} envMapIntensity={0.2} transparent />
  )
  const edge = <meshStandardMaterial color='#e3e0d9' roughness={0.66} metalness={0} envMapIntensity={0.3} transparent />
  const wallY = BOX.floor + BOX.height / 2
  return (
    <group position={[placement.x, placement.y, 0]} scale={placement.scale}>
      <group ref={group}>
        {/* Soft halo has no shadow-map or post-processing dependency on mobile. */}
        <mesh position={[0, BOX.floor - 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
          <planeGeometry args={[5.4, 3.8]} />
          <shaderMaterial
            uniforms={glow}
            vertexShader={glowVertex}
            fragmentShader={glowFragment}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <RoundedBox
          name='Podium'
          args={[BOX.width + 0.32, 0.1, BOX.depth + 0.32]}
          radius={0.045}
          smoothness={2}
          position={[0, BOX.floor - 0.1, 0]}
        >
          {white}
        </RoundedBox>
        <RoundedBox
          args={[BOX.width + 0.24, 0.015, BOX.depth + 0.24]}
          radius={0.006}
          smoothness={1}
          position={[0, BOX.floor - 0.145, 0]}
        >
          <meshStandardMaterial color='#d9e9ff' emissive='#b8d6ff' emissiveIntensity={0.65} roughness={1} transparent />
        </RoundedBox>
        <mesh name='BoxFloor' position={[0, BOX.floor, 0]}>
          <boxGeometry args={[BOX.width, BOX.wall, BOX.depth]} />
          {lining}
        </mesh>
        {[1, -1].map((side) => (
          <RoundedBox
            key={'wall' + side}
            name={side === 1 ? 'BoxFrontWall' : 'BoxBackWall'}
            args={[BOX.width, BOX.height, BOX.wall]}
            radius={0.02}
            smoothness={2}
            position={[0, wallY, (side * BOX.depth) / 2]}
          >
            {white}
          </RoundedBox>
        ))}
        {[1, -1].map((side) => (
          <RoundedBox
            key={'side' + side}
            args={[BOX.wall, BOX.height, BOX.depth]}
            radius={0.02}
            smoothness={2}
            position={[(side * BOX.width) / 2, wallY, 0]}
          >
            {white}
          </RoundedBox>
        ))}
        {/* Folded inner rim and a narrow base seam make the cavity read as packaging. */}
        {[1, -1].map((side) => (
          <group key={'trim' + side}>
            <mesh position={[0, BOX.rim - 0.045, side * (BOX.depth / 2 - 0.035)]}>
              <boxGeometry args={[BOX.width - 0.08, 0.035, 0.04]} />
              {edge}
            </mesh>
            <mesh position={[side * (BOX.width / 2 - 0.035), BOX.rim - 0.045, 0]}>
              <boxGeometry args={[0.04, 0.035, BOX.depth - 0.08]} />
              {edge}
            </mesh>
            <mesh position={[0, BOX.floor + 0.085, side * (BOX.depth / 2 + 0.034)]}>
              <boxGeometry args={[BOX.width - 0.08, 0.008, 0.003]} />
              {edge}
            </mesh>
          </group>
        ))}
        <mesh position={[0, wallY + 0.13, BOX.depth / 2 + 0.034]}>
          <planeGeometry args={[1.25, 0.365]} />
          <meshBasicMaterial map={label} transparent depthWrite={false} toneMapped />
        </mesh>
        {/* Small paper stock label, with individual barcode strokes. */}
        <group position={[BOX.width / 2 - 0.46, BOX.floor + 0.32, BOX.depth / 2 + 0.035]}>
          <mesh>
            <planeGeometry args={[0.55, 0.2]} />
            <meshBasicMaterial color='#ebe9e3' transparent toneMapped />
          </mesh>
          {Array.from({ length: 17 }, (_, i) => (
            <mesh key={i} position={[-0.22 + i * 0.027, 0, 0.001]}>
              <planeGeometry args={[i % 3 === 0 ? 0.012 : 0.006, 0.12]} />
              <meshBasicMaterial color='#56595d' transparent toneMapped />
            </mesh>
          ))}
        </group>
        <pointLight
          ref={light}
          position={[0, BOX.floor + 0.22, 0.1]}
          intensity={0}
          distance={2.4}
          decay={2}
          color='#e7f0ff'
        />
        <group name='LidHinge' ref={lid} position={[0, BOX.rim - 0.025, -BOX.depth / 2]}>
          <RoundedBox
            name='LidMesh'
            args={[BOX.width + 0.12, 0.075, BOX.depth + 0.12]}
            radius={0.025}
            smoothness={2}
            position={[0, 0.0375, BOX.depth / 2]}
          >
            {white}
          </RoundedBox>
          {/* A shallow front lip and side lips sit outside the box walls. */}
          <RoundedBox
            args={[BOX.width + 0.12, 0.12, 0.045]}
            radius={0.012}
            smoothness={2}
            position={[0, -0.035, BOX.depth + 0.04]}
          >
            {white}
          </RoundedBox>
          {[-1, 1].map((side) => (
            <RoundedBox
              key={side}
              args={[0.045, 0.12, BOX.depth + 0.12]}
              radius={0.012}
              smoothness={2}
              position={[side * (BOX.width / 2 + 0.04), -0.035, BOX.depth / 2]}
            >
              {white}
            </RoundedBox>
          ))}
          <mesh position={[0, 0.077, BOX.depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.55, 0.452]} />
            <meshBasicMaterial map={label} transparent depthWrite={false} toneMapped />
          </mesh>
          <mesh position={[0, -0.004, BOX.depth / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[BOX.width - 0.1, BOX.depth - 0.1]} />
            {lining}
          </mesh>
        </group>
      </group>
    </group>
  )
}
