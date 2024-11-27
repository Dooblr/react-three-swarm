import { create } from 'zustand'
import { CollisionSystem, Collider, CollisionResult } from '../systems/CollisionSystem'

interface CollisionStore {
  system: CollisionSystem
  addCollider: (collider: Collider) => void
  removeCollider: (collider: Collider) => void
  checkCollision: (collider: Collider) => CollisionResult[]
}

export const useCollisionStore = create<CollisionStore>((set, get) => {
  const system = new CollisionSystem()

  return {
    system,
    
    addCollider: (collider: Collider) => {
      get().system.addCollider(collider)
    },
    
    removeCollider: (collider: Collider) => {
      get().system.removeCollider(collider)
    },
    
    checkCollision: (collider: Collider) => {
      return get().system.checkCollision(collider)
    }
  }
}) 