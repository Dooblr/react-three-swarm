import * as THREE from "three"
import { useGameStore } from "./store/gameStore"

export interface Enemy {
  mesh: THREE.Mesh
  health: number
  position: THREE.Vector3
}

export class EnemyManager {
  private enemies: Enemy[] = []
  private scene: THREE.Scene
  private levelBounds: number
  private lastSpawnTime: number = 0
  private spawnRate: number = 3000 // 3 seconds

  // Add time tracking for wobble
  private wobbleTime: number = 0

  constructor(scene: THREE.Scene, levelBounds: number) {
    this.scene = scene
    this.levelBounds = levelBounds
  }

  createEnemy(): Enemy {
    // Random edge position
    let x, z
    if (Math.random() < 0.5) {
      // Spawn on X edges
      x = Math.random() < 0.5 ? -this.levelBounds : this.levelBounds
      z = Math.random() * this.levelBounds * 2 - this.levelBounds
    } else {
      // Spawn on Z edges
      x = Math.random() * this.levelBounds * 2 - this.levelBounds
      z = Math.random() < 0.5 ? -this.levelBounds : this.levelBounds
    }

    // Create the base sphere
    const enemyGeometry = new THREE.SphereGeometry(0.5, 16, 16)
    const enemyMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      metalness: 0.3,
      roughness: 0.7,
    })
    const enemyMesh = new THREE.Mesh(enemyGeometry, enemyMaterial)

    // Create spikes
    const spikeGroup = new THREE.Group()
    const numberOfSpikes = Math.floor(Math.random() * 8) + 4 // 4-12 spikes
    
    for (let i = 0; i < numberOfSpikes; i++) {
      const spikeGeometry = new THREE.ConeGeometry(0.1, 0.3, 4) // thin, short spikes
      const spikeMaterial = new THREE.MeshStandardMaterial({
        color: 0x009900, // Slightly darker green
        metalness: 0.5,
        roughness: 0.5,
      })
      const spike = new THREE.Mesh(spikeGeometry, spikeMaterial)

      // Random position on sphere surface
      const phi = Math.random() * Math.PI * 2 // random angle around sphere
      const theta = Math.random() * Math.PI // random angle from top to bottom
      
      // Position spike on sphere surface
      spike.position.setFromSpherical(new THREE.Spherical(0.5, theta, phi))
      
      // Orient spike to point outward
      spike.lookAt(spike.position.clone().multiplyScalar(2))
      
      spikeGroup.add(spike)
    }

    enemyMesh.add(spikeGroup)
    enemyMesh.position.set(x, 0.5, z)
    enemyMesh.castShadow = true

    const enemy: Enemy = {
      mesh: enemyMesh,
      health: 3,
      position: enemyMesh.position,
    }

    this.scene.add(enemyMesh)
    this.enemies.push(enemy)
    return enemy
  }

  update(playerPosition: THREE.Vector3, deltaTime: number) {
    // Update wobble time
    this.wobbleTime += deltaTime

    // Spawn check
    const now = Date.now()
    if (now - this.lastSpawnTime > this.spawnRate) {
      this.createEnemy()
      this.lastSpawnTime = now
    }

    // Update enemies
    const enemySpeed = 0.1
    this.enemies.forEach((enemy) => {
      const direction = new THREE.Vector3()
        .subVectors(playerPosition, enemy.mesh.position)
        .normalize()

      // Increased wobble values
      const wobbleAmount = 1.2     // Increased from 0.3
      const wobbleFrequency = 4    // Increased from 2
      
      // Create offset based on sine waves with more variation
      const offsetX = Math.sin(this.wobbleTime * wobbleFrequency + enemy.mesh.position.x) * wobbleAmount
      const offsetZ = Math.cos(this.wobbleTime * wobbleFrequency + enemy.mesh.position.z) * wobbleAmount
      
      // Apply movement with wobble
      enemy.mesh.position.add(direction.multiplyScalar(enemySpeed))
      enemy.mesh.position.x += offsetX * deltaTime
      enemy.mesh.position.z += offsetZ * deltaTime

      // Increased rotation wobble
      enemy.mesh.rotation.x = Math.sin(this.wobbleTime * wobbleFrequency) * 0.3  // Increased from 0.1
      enemy.mesh.rotation.z = Math.cos(this.wobbleTime * wobbleFrequency) * 0.3  // Increased from 0.1
    })
  }

  handleProjectileCollision(projectile: THREE.Mesh): boolean {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      const distance = projectile.position.distanceTo(enemy.mesh.position)

      if (distance < 1) { // Collision detected
        enemy.health--

        // Change color based on health
        const healthColor = new THREE.Color(
          1 - enemy.health / 3, // More red as health decreases
          enemy.health / 3, // Less green as health decreases
          0
        )
        ;(enemy.mesh.material as THREE.MeshStandardMaterial).color = healthColor

        // If enemy is destroyed (health <= 0)
        if (enemy.health <= 0) {
          // Remove enemy from scene and array
          this.scene.remove(enemy.mesh)
          this.enemies.splice(i, 1)
          
          // Increment score using Zustand store
          const gameStore = useGameStore.getState()
          gameStore.incrementScore()
          
          return true
        }
        return true // Hit but not destroyed
      }
    }
    return false // No collision
  }

  getEnemies(): Enemy[] {
    return this.enemies
  }

  cleanup() {
    this.enemies.forEach((enemy) => {
      this.scene.remove(enemy.mesh)
    })
    this.enemies = []
  }
}
