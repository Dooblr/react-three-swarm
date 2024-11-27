import { FC, useMemo } from 'react'
import * as THREE from 'three'

interface Barrier {
  id: number
  position: THREE.Vector3
  rotation: number
  scale: THREE.Vector3
}

const MAP_SIZE = 50 // Should match ground plane size
const BARRIER_COUNT = 15
const MIN_SCALE = new THREE.Vector3(2, 3, 2)
const MAX_SCALE = new THREE.Vector3(6, 5, 2)
const SPAWN_MARGIN = 10 // Keep barriers away from center

const BARRIER_COLORS = [
  '#1a4a1a', // Dark green
  '#2a5a2a', // Medium green
  '#1a3a1a', // Darker green
]

export const Barriers: FC = () => {
  const barriers = useMemo(() => {
    const result: Barrier[] = []
    
    for (let i = 0; i < BARRIER_COUNT; i++) {
      // Generate random position (avoiding center area)
      const x = (Math.random() * (MAP_SIZE - SPAWN_MARGIN * 2) - (MAP_SIZE - SPAWN_MARGIN * 2) / 2)
      const z = (Math.random() * (MAP_SIZE - SPAWN_MARGIN * 2) - (MAP_SIZE - SPAWN_MARGIN * 2) / 2)
      
      // If too close to center, push outward
      const distanceFromCenter = Math.sqrt(x * x + z * z)
      if (distanceFromCenter < SPAWN_MARGIN) {
        const angle = Math.atan2(z, x)
        const adjustedX = Math.cos(angle) * SPAWN_MARGIN
        const adjustedZ = Math.sin(angle) * SPAWN_MARGIN
        result.push({
          id: i,
          position: new THREE.Vector3(adjustedX, 0, adjustedZ),
          rotation: Math.random() * Math.PI * 2,
          scale: new THREE.Vector3(
            MIN_SCALE.x + Math.random() * (MAX_SCALE.x - MIN_SCALE.x),
            MIN_SCALE.y + Math.random() * (MAX_SCALE.y - MIN_SCALE.y),
            MIN_SCALE.z
          ),
        })
      } else {
        result.push({
          id: i,
          position: new THREE.Vector3(x, 0, z),
          rotation: Math.random() * Math.PI * 2,
          scale: new THREE.Vector3(
            MIN_SCALE.x + Math.random() * (MAX_SCALE.x - MIN_SCALE.x),
            MIN_SCALE.y + Math.random() * (MAX_SCALE.y - MIN_SCALE.y),
            MIN_SCALE.z
          ),
        })
      }
    }
    
    return result
  }, [])

  return (
    <group>
      {barriers.map(barrier => (
        <mesh
          key={barrier.id}
          position={barrier.position}
          rotation={[0, barrier.rotation, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[barrier.scale.x, barrier.scale.y, barrier.scale.z]} />
          <meshStandardMaterial
            color={BARRIER_COLORS[barrier.id % BARRIER_COLORS.length]}
            metalness={0.4}
            roughness={0.6}
            emissive={BARRIER_COLORS[barrier.id % BARRIER_COLORS.length]}
            emissiveIntensity={0.1}
          />
        </mesh>
      ))}
    </group>
  )
} 