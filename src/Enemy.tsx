import * as THREE from "three"
import { useGameStore } from "./store/gameStore"
import enemyHitSound from './assets/enemy_hit.wav'
import enemyDeathSound from './assets/enemy_death.wav'

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
  private hitAudio: HTMLAudioElement
  private deathAudio: HTMLAudioElement
  private platforms: THREE.Mesh[]

  // Add time tracking for wobble
  private wobbleTime: number = 0
  private lastPlayerCollisionTime: number = 0
  private collisionCooldown: number = 1000  // 1 second cooldown between hits

  constructor(scene: THREE.Scene, levelBounds: number, platforms: THREE.Mesh[]) {
    this.scene = scene
    this.levelBounds = levelBounds
    this.platforms = platforms
    // Initialize audio
    this.hitAudio = new Audio(enemyHitSound)
    this.hitAudio.volume = useGameStore.getState().audioLevels.enemyHit
    this.deathAudio = new Audio(enemyDeathSound)
    this.deathAudio.volume = useGameStore.getState().audioLevels.enemyDeath
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
    const enemyRadius = 0.5 // Enemy collision radius
    const playerCollisionRadius = 1

    this.enemies.forEach((enemy, index) => {
        // Store previous position for collision resolution
        const previousPosition = enemy.mesh.position.clone()

        // Calculate direction to player
        const direction = new THREE.Vector3()
            .subVectors(playerPosition, enemy.mesh.position)
            .normalize()

        // Move enemy
        enemy.mesh.position.add(direction.multiplyScalar(enemySpeed))

        // Check collisions with platforms
        this.platforms.forEach(platform => {
            const platformWidth = 1.5  // Half of platform's width
            const platformDepth = 1.5  // Half of platform's depth
            const platformHeight = 1    // Half of platform's height

            const dx = enemy.mesh.position.x - platform.position.x
            const dz = enemy.mesh.position.z - platform.position.z
            const dy = enemy.mesh.position.y - platform.position.y

            // Check if within collision range
            if (Math.abs(dx) < (platformWidth + enemyRadius) && 
                Math.abs(dz) < (platformDepth + enemyRadius) && 
                Math.abs(dy) < (platformHeight + enemyRadius)) {
                
                // Find the overlap on each axis
                const overlapX = (platformWidth + enemyRadius) - Math.abs(dx)
                const overlapZ = (platformDepth + enemyRadius) - Math.abs(dz)
                
                // Push enemy out horizontally (ignore vertical collision)
                if (overlapX < overlapZ) {
                    // X-axis collision
                    enemy.mesh.position.x = dx > 0 ? 
                        platform.position.x + platformWidth + enemyRadius :
                        platform.position.x - platformWidth - enemyRadius
                } else {
                    // Z-axis collision
                    enemy.mesh.position.z = dz > 0 ? 
                        platform.position.z + platformDepth + enemyRadius :
                        platform.position.z - platformDepth - enemyRadius
                }
            }
        })

        // Existing wobble effect
        const wobbleAmount = 1.2
        const wobbleFrequency = 4
        
        const offsetX = Math.sin(this.wobbleTime * wobbleFrequency + enemy.mesh.position.x) * wobbleAmount
        const offsetZ = Math.cos(this.wobbleTime * wobbleFrequency + enemy.mesh.position.z) * wobbleAmount
        
        enemy.mesh.position.x += offsetX * deltaTime
        enemy.mesh.position.z += offsetZ * deltaTime

        // Check player collision after all movement
        const distanceToPlayer = enemy.mesh.position.distanceTo(playerPosition)
        if (distanceToPlayer < playerCollisionRadius && 
            now - this.lastPlayerCollisionTime > this.collisionCooldown) {
            
            useGameStore.getState().decrementHealth();
            this.lastPlayerCollisionTime = now;
            
            // Remove the enemy after collision
            this.scene.remove(enemy.mesh)
            this.enemies.splice(index, 1)
            return // Skip rest of update for this enemy
        }

        // Existing rotation code
        enemy.mesh.rotation.x = Math.sin(this.wobbleTime * wobbleFrequency) * 0.3
        enemy.mesh.rotation.z = Math.cos(this.wobbleTime * wobbleFrequency) * 0.3
    })
  }

  handleProjectileCollision(projectile: THREE.Mesh): boolean {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      const distance = projectile.position.distanceTo(enemy.mesh.position)

      if (distance < 1) { // Collision detected
        enemy.health--

        if (enemy.health <= 0) {
          // Play death sound
          this.deathAudio.currentTime = 0
          this.deathAudio.play().catch(error => {
            console.log("Audio play failed:", error)
          })
          
          // Remove enemy from scene and array
          this.scene.remove(enemy.mesh)
          this.enemies.splice(i, 1)
          
          // Increment score using Zustand store
          const gameStore = useGameStore.getState()
          gameStore.incrementScore()
          
          return true
        } else {
          // Play hit sound only if enemy survives
          this.hitAudio.currentTime = 0
          this.hitAudio.play().catch(error => {
            console.log("Audio play failed:", error)
          })

          // Change color based on health
          const healthColor = new THREE.Color(
            1 - enemy.health / 3, // More red as health decreases
            enemy.health / 3, // Less green as health decreases
            0
          )
          ;(enemy.mesh.material as THREE.MeshStandardMaterial).color = healthColor
        }
        return true // Hit detected
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
    // Clean up audio
    this.hitAudio.pause()
    this.deathAudio.pause()
  }
}
