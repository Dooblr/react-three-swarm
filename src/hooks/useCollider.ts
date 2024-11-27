import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useCollisionStore } from '../store/collisionStore'
import { Collider, ColliderType, CollisionLayer, CollisionResult } from '../systems/CollisionSystem'

interface UseColliderProps {
  type: ColliderType
  size: THREE.Vector3
  layer: CollisionLayer
  position: THREE.Vector3
  rotation?: THREE.Euler
  entity: any
}

export const useCollider = ({
  type,
  size,
  layer,
  position,
  rotation,
  entity
}: UseColliderProps) => {
  const colliderRef = useRef<Collider>()
  const { addCollider, removeCollider, checkCollision } = useCollisionStore()

  useEffect(() => {
    // Create collider
    const collider: Collider = {
      type,
      size,
      layer,
      position,
      rotation,
      entity
    }
    
    colliderRef.current = collider
    addCollider(collider)

    // Cleanup
    return () => {
      if (colliderRef.current) {
        removeCollider(colliderRef.current)
      }
    }
  }, []) // Only run on mount/unmount

  // Update collider position/rotation when props change
  useEffect(() => {
    if (colliderRef.current) {
      colliderRef.current.position = position
      colliderRef.current.rotation = rotation
    }
  }, [position, rotation])

  const checkCollisions = (): CollisionResult[] => {
    if (!colliderRef.current) return []
    return checkCollision(colliderRef.current)
  }

  return {
    checkCollisions
  }
} 