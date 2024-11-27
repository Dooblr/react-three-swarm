import { FC, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

type ProjectileType = 'enemy'

interface Projectile {
  id: number
  position: THREE.Vector3
  direction: THREE.Vector3
  type: ProjectileType
  speed: number
  lifetime: number
  createdAt: number
}

const PROJECTILE_CONFIGS = {
  enemy: {
    speed: 0.3,
    lifetime: 2000,
    color: '#ff0000',
    size: 0.15,
  },
}

export const ProjectileManager: FC = () => {
  const [projectiles, setProjectiles] = useState<Projectile[]>([])
  const nextId = useRef(0)

  const spawnProjectile = (
    position: THREE.Vector3,
    direction: THREE.Vector3,
    type: ProjectileType
  ) => {
    const newProjectile: Projectile = {
      id: nextId.current++,
      position: position.clone(),
      direction: direction.normalize(),
      type,
      speed: PROJECTILE_CONFIGS[type].speed,
      lifetime: PROJECTILE_CONFIGS[type].lifetime,
      createdAt: Date.now(),
    }

    setProjectiles(prev => [...prev, newProjectile])
  }

  useFrame(() => {
    const now = Date.now()
    setProjectiles(prev => 
      prev
        .filter(projectile => now - projectile.createdAt < projectile.lifetime)
        .map(projectile => ({
          ...projectile,
          position: projectile.position.clone().add(
            projectile.direction.clone().multiplyScalar(projectile.speed)
          ),
        }))
    )
  })

  return (
    <group>
      {projectiles.map(projectile => (
        <mesh
          key={projectile.id}
          position={projectile.position}
        >
          <sphereGeometry args={[PROJECTILE_CONFIGS[projectile.type].size, 8, 8]} />
          <meshStandardMaterial
            color={PROJECTILE_CONFIGS[projectile.type].color}
            emissive={PROJECTILE_CONFIGS[projectile.type].color}
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
    </group>
  )
} 