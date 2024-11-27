import * as THREE from 'three'

export type ColliderType = 'box' | 'sphere'
export type CollisionLayer = 'player' | 'enemy' | 'barrier' | 'projectile'

export interface Collider {
  type: ColliderType
  position: THREE.Vector3
  size: THREE.Vector3  // For box: half-extents, For sphere: x = radius
  rotation?: THREE.Euler
  layer: CollisionLayer
  entity: any  // Reference to the game entity this collider belongs to
}

export interface CollisionResult {
  hasCollision: boolean
  penetration?: THREE.Vector3
  normal?: THREE.Vector3
  other?: Collider
}

export class CollisionSystem {
  private colliders: Collider[] = []
  
  // Collision matrix defines which layers can collide with each other
  private collisionMatrix: { [key in CollisionLayer]: CollisionLayer[] } = {
    player: ['barrier', 'enemy', 'projectile'],
    enemy: ['barrier', 'player', 'projectile'],
    barrier: ['player', 'enemy', 'projectile'],
    projectile: ['player', 'enemy', 'barrier']
  }

  addCollider(collider: Collider) {
    this.colliders.push(collider)
  }

  removeCollider(collider: Collider) {
    const index = this.colliders.indexOf(collider)
    if (index !== -1) {
      this.colliders.splice(index, 1)
    }
  }

  canLayersCollide(layer1: CollisionLayer, layer2: CollisionLayer): boolean {
    return this.collisionMatrix[layer1].includes(layer2)
  }

  checkCollision(collider: Collider): CollisionResult[] {
    const results: CollisionResult[] = []

    for (const other of this.colliders) {
      // Skip if it's the same collider
      if (other === collider) continue

      // Check if these layers can collide
      if (!this.canLayersCollide(collider.layer, other.layer)) continue

      const result = this.testCollision(collider, other)
      if (result.hasCollision) {
        results.push({ ...result, other })
      }
    }

    return results
  }

  private testCollision(a: Collider, b: Collider): CollisionResult {
    // Box vs Box collision
    if (a.type === 'box' && b.type === 'box') {
      return this.boxVsBox(a, b)
    }
    
    // Sphere vs Sphere collision
    if (a.type === 'sphere' && b.type === 'sphere') {
      return this.sphereVsSphere(a, b)
    }

    // Box vs Sphere collision
    if (a.type === 'box' && b.type === 'sphere') {
      return this.boxVsSphere(a, b)
    }
    if (a.type === 'sphere' && b.type === 'box') {
      const result = this.boxVsSphere(b, a)
      if (result.hasCollision && result.normal) {
        result.normal.multiplyScalar(-1) // Flip normal since we swapped a and b
      }
      return result
    }

    return { hasCollision: false }
  }

  private boxVsBox(a: Collider, b: Collider): CollisionResult {
    // Transform points to world space if rotated
    const aMin = new THREE.Vector3().subVectors(a.position, a.size)
    const aMax = new THREE.Vector3().addVectors(a.position, a.size)
    const bMin = new THREE.Vector3().subVectors(b.position, b.size)
    const bMax = new THREE.Vector3().addVectors(b.position, b.size)

    // Check for overlap on each axis
    const overlap = new THREE.Vector3(
      Math.min(aMax.x - bMin.x, bMax.x - aMin.x),
      Math.min(aMax.y - bMin.y, bMax.y - aMin.y),
      Math.min(aMax.z - bMin.z, bMax.z - aMin.z)
    )

    if (overlap.x < 0 || overlap.y < 0 || overlap.z < 0) {
      return { hasCollision: false }
    }

    // Find smallest overlap axis for collision normal
    const normal = new THREE.Vector3()
    let minOverlap = Infinity
    
    if (overlap.x < minOverlap) {
      minOverlap = overlap.x
      normal.set(Math.sign(b.position.x - a.position.x), 0, 0)
    }
    if (overlap.y < minOverlap) {
      minOverlap = overlap.y
      normal.set(0, Math.sign(b.position.y - a.position.y), 0)
    }
    if (overlap.z < minOverlap) {
      minOverlap = overlap.z
      normal.set(0, 0, Math.sign(b.position.z - a.position.z))
    }

    return {
      hasCollision: true,
      penetration: normal.clone().multiplyScalar(minOverlap),
      normal
    }
  }

  private sphereVsSphere(a: Collider, b: Collider): CollisionResult {
    const radiusSum = a.size.x + b.size.x // x component stores radius for spheres
    const distance = a.position.distanceTo(b.position)
    
    if (distance >= radiusSum) {
      return { hasCollision: false }
    }

    const normal = new THREE.Vector3()
      .subVectors(b.position, a.position)
      .normalize()

    return {
      hasCollision: true,
      penetration: normal.clone().multiplyScalar(radiusSum - distance),
      normal
    }
  }

  private boxVsSphere(box: Collider, sphere: Collider): CollisionResult {
    // Find the closest point on the box to the sphere
    const closestPoint = new THREE.Vector3().copy(sphere.position).clamp(
      new THREE.Vector3().subVectors(box.position, box.size),
      new THREE.Vector3().addVectors(box.position, box.size)
    )

    const distance = closestPoint.distanceTo(sphere.position)
    if (distance >= sphere.size.x) { // sphere.size.x is radius
      return { hasCollision: false }
    }

    const normal = new THREE.Vector3()
      .subVectors(sphere.position, closestPoint)
      .normalize()

    return {
      hasCollision: true,
      penetration: normal.clone().multiplyScalar(sphere.size.x - distance),
      normal
    }
  }
} 