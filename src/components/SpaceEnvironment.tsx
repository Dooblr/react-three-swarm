import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const STAR_COUNT = 1000
const STAR_SPEED = 0.05
const SPACE_SIZE = 100

export const SpaceEnvironment = () => {
  const starsRef = useRef<THREE.Points>(null)

  // Create star particles
  const starPositions = new Float32Array(STAR_COUNT * 3)
  const starSizes = new Float32Array(STAR_COUNT)

  for (let i = 0; i < STAR_COUNT; i++) {
    const i3 = i * 3
    starPositions[i3] = (Math.random() - 0.5) * SPACE_SIZE
    starPositions[i3 + 1] = (Math.random() - 0.5) * SPACE_SIZE
    starPositions[i3 + 2] = (Math.random() - 0.5) * SPACE_SIZE
    starSizes[i] = Math.random() * 2
  }

  useFrame(() => {
    if (!starsRef.current) return

    const positions = (starsRef.current.geometry as THREE.BufferGeometry).attributes.position.array as Float32Array

    for (let i = 0; i < STAR_COUNT; i++) {
      const i3 = i * 3
      positions[i3 + 2] += STAR_SPEED

      // Reset star position when it goes too far
      if (positions[i3 + 2] > SPACE_SIZE / 2) {
        positions[i3 + 2] = -SPACE_SIZE / 2
      }
    }

    (starsRef.current.geometry as THREE.BufferGeometry).attributes.position.needsUpdate = true
  })

  return (
    <>
      {/* Dark space background */}
      <color attach="background" args={['#000814']} />
      <fog attach="fog" args={['#000814', 20, 90]} />

      {/* Star particles */}
      <points ref={starsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={STAR_COUNT}
            array={starPositions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            count={STAR_COUNT}
            array={starSizes}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.1}
          color="#ffffff"
          sizeAttenuation
          transparent
          opacity={0.8}
          fog={true}
        />
      </points>
    </>
  )
} 