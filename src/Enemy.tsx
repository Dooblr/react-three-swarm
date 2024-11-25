import * as THREE from "three"
import { useGameStore } from "./store/gameStore"
import enemyHitSound from "./assets/enemy_hit.wav"
import enemyDeathSound from "./assets/enemy_death.wav"
import playerHitSound from "./assets/player_hit.wav"

export interface Enemy {
  mesh: THREE.Mesh
  health: number
  position: THREE.Vector3
}

export class EnemyManager {
  // Explosion effect parameters
  private readonly EXPLOSION_PARAMS = {
    colors: [0xff0000, 0xff8800, 0xffff00, 0xff3300, 0xff5500, 0xff1100],
    particleCount: 120,
    baseSpeed: 8,
    speedVariation: 3.0, // Multiplier for random speed variation
    burstVelocity: 2.0, // Multiplier for additional random velocity
    particleSize: 0.1,
    lifetime: 1000,
    gravity: 0.0002,
    drag: 0.9
  }

  private enemies: Enemy[] = []
  private scene: THREE.Scene
  private levelBounds: number
  private lastSpawnTime: number = 0
  private spawnRate: number = 3000 // 3 seconds
  private hitAudio: HTMLAudioElement
  private deathAudio: HTMLAudioElement
  private playerHitAudio: HTMLAudioElement
  private platforms: THREE.Mesh[]
  private particles: THREE.Points[] = []

  // Add time tracking for wobble
  private wobbleTime: number = 0
  private lastPlayerCollisionTime: number = 0
  private collisionCooldown: number = 1000 // 1 second cooldown between hits

  constructor(
    scene: THREE.Scene,
    levelBounds: number,
    platforms: THREE.Mesh[]
  ) {
    this.scene = scene
    this.levelBounds = levelBounds
    this.platforms = platforms
    // Initialize audio
    this.hitAudio = new Audio(enemyHitSound)
    this.hitAudio.volume = useGameStore.getState().audioLevels.enemyHit
    this.deathAudio = new Audio(enemyDeathSound)
    this.deathAudio.volume = useGameStore.getState().audioLevels.enemyDeath
    this.playerHitAudio = new Audio(playerHitSound)
    this.playerHitAudio.volume = useGameStore.getState().audioLevels.playerHit
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

    // Create the base sphere with initial healthy color
    const enemyGeometry = new THREE.SphereGeometry(0.5, 16, 16)
    const enemyMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00, // Start with green
      metalness: 0.3,
      roughness: 0.7,
    })
    const enemyMesh = new THREE.Mesh(enemyGeometry, enemyMaterial)

    // Create spikes with matching color
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

    // Set initial health
    const enemy: Enemy = {
      mesh: enemyMesh,
      health: 3, // Assuming 3 is max health
      position: enemyMesh.position,
    }

    // Store max health in userData for color interpolation
    enemyMesh.userData.maxHealth = enemy.health

    this.scene.add(enemyMesh)
    this.enemies.push(enemy)
    return enemy
  }

  private createExplosion(position: THREE.Vector3) {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(this.EXPLOSION_PARAMS.particleCount * 3)
    const velocities: THREE.Vector3[] = []
    
    for (let i = 0; i < this.EXPLOSION_PARAMS.particleCount; i++) {
      positions[i * 3] = position.x
      positions[i * 3 + 1] = position.y
      positions[i * 3 + 2] = position.z

      const phi = Math.random() * Math.PI * 2
      const theta = Math.random() * Math.PI
      const speed = this.EXPLOSION_PARAMS.baseSpeed * 
                   (1 + Math.random() * this.EXPLOSION_PARAMS.speedVariation)

      const velocityVector = new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
        Math.cos(theta)
      ).multiplyScalar(speed)

      // Add burst velocity
      const burst = this.EXPLOSION_PARAMS.burstVelocity
      velocityVector.x += (Math.random() - 0.5) * burst
      velocityVector.y += (Math.random() - 0.5) * burst
      velocityVector.z += (Math.random() - 0.5) * burst

      velocities.push(velocityVector)
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: this.EXPLOSION_PARAMS.colors[
          Math.floor(Math.random() * this.EXPLOSION_PARAMS.colors.length)
        ],
        size: this.EXPLOSION_PARAMS.particleSize,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )

    points.userData = {
      velocities,
      createdAt: Date.now(),
      lifetime: this.EXPLOSION_PARAMS.lifetime,
      gravity: this.EXPLOSION_PARAMS.gravity,
      drag: this.EXPLOSION_PARAMS.drag
    }

    this.scene.add(points)
    this.particles.push(points)
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
      // Calculate direction to player
      const direction = new THREE.Vector3()
        .subVectors(playerPosition, enemy.mesh.position)
        .normalize()

      // Move enemy
      enemy.mesh.position.add(direction.multiplyScalar(enemySpeed))

      // Check collisions with platforms
      this.platforms.forEach((platform) => {
        const platformGeometry = platform.geometry as THREE.BoxGeometry
        const size = platformGeometry.parameters.width
        const height = platformGeometry.parameters.height

        // Get platform bounds
        const halfSize = size / 2
        const platformMinX = platform.position.x - halfSize
        const platformMaxX = platform.position.x + halfSize
        const platformMinZ = platform.position.z - halfSize
        const platformMaxZ = platform.position.z + halfSize
        const platformTopY = platform.position.y + height / 2
        const platformBottomY = platform.position.y - height / 2

        // Check if enemy is within platform XZ bounds
        const withinX =
          enemy.mesh.position.x + enemyRadius > platformMinX &&
          enemy.mesh.position.x - enemyRadius < platformMaxX
        const withinZ =
          enemy.mesh.position.z + enemyRadius > platformMinZ &&
          enemy.mesh.position.z - enemyRadius < platformMaxZ

        if (withinX && withinZ) {
          const enemyY = enemy.mesh.position.y

          // If enemy is at platform height, push it away horizontally
          if (
            enemyY < platformTopY + enemyRadius &&
            enemyY > platformBottomY - enemyRadius
          ) {
            const pushDirection = new THREE.Vector3(
              enemy.mesh.position.x - platform.position.x,
              0,
              enemy.mesh.position.z - platform.position.z
            ).normalize()
            enemy.mesh.position.add(
              pushDirection.multiplyScalar(enemySpeed * 2)
            )
          }
        }
      })

      // Existing wobble effect
      const wobbleAmount = 1.2
      const wobbleFrequency = 4

      const offsetX =
        Math.sin(this.wobbleTime * wobbleFrequency + enemy.mesh.position.x) *
        wobbleAmount
      const offsetZ =
        Math.cos(this.wobbleTime * wobbleFrequency + enemy.mesh.position.z) *
        wobbleAmount

      enemy.mesh.position.x += offsetX * deltaTime
      enemy.mesh.position.z += offsetZ * deltaTime

      // Check player collision after all movement
      const distanceToPlayer = enemy.mesh.position.distanceTo(playerPosition)
      if (
        distanceToPlayer < playerCollisionRadius &&
        now - this.lastPlayerCollisionTime > this.collisionCooldown
      ) {
        useGameStore.getState().decrementHealth()
        this.lastPlayerCollisionTime = now

        // Play player hit sound
        this.playerHitAudio.currentTime = 0
        this.playerHitAudio.play().catch((error) => {
          console.log("Audio play failed:", error)
        })

        // Remove the enemy after collision
        this.scene.remove(enemy.mesh)
        this.enemies.splice(index, 1)
        return
      }

      // Existing rotation code
      enemy.mesh.rotation.x = Math.sin(this.wobbleTime * wobbleFrequency) * 0.3
      enemy.mesh.rotation.z = Math.cos(this.wobbleTime * wobbleFrequency) * 0.3
    })

    // Update particle effects
    if (this.particles.length > 0) {
        console.log("Updating particles:", this.particles.length)
    }
    this.updateParticles(deltaTime)
  }

  private updateParticles(deltaTime: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const points = this.particles[i]
      const positions = points.geometry.attributes.position.array as Float32Array
      const velocities = points.userData.velocities
      const age = Date.now() - points.userData.createdAt

      // Update particle positions
      for (let j = 0; j < positions.length; j += 3) {
        // Apply gravity and drag
        velocities[j/3].multiplyScalar(points.userData.drag)
        velocities[j/3].y -= points.userData.gravity * deltaTime

        // Update positions
        positions[j] += velocities[j/3].x * deltaTime
        positions[j + 1] += velocities[j/3].y * deltaTime
        positions[j + 2] += velocities[j/3].z * deltaTime
      }
      points.geometry.attributes.position.needsUpdate = true

      // Fade out with a more dramatic curve
      const fadeProgress = age / points.userData.lifetime
      const opacity = Math.cos(fadeProgress * Math.PI * 0.5)
      ;(points.material as THREE.PointsMaterial).opacity = Math.max(0, opacity)

      // Remove if expired
      if (age >= points.userData.lifetime) {
        this.scene.remove(points)
        this.particles.splice(i, 1)
      }
    }
  }

  handleProjectileCollision(projectile: THREE.Mesh): boolean {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      const distance = projectile.position.distanceTo(enemy.mesh.position)

      if (distance < 1) {
        enemy.health--

        // Update color based on health
        const healthPercent = enemy.health / enemy.mesh.userData.maxHealth
        const color = new THREE.Color()
        color.r = 1 - healthPercent // Red increases as health decreases
        color.g = healthPercent    // Green decreases as health decreases
        color.b = 0                // No blue component
        
        // Update main body color
        ;(enemy.mesh.material as THREE.MeshStandardMaterial).color = color
        
        // Update spike colors to a slightly darker version
        enemy.mesh.children[0].children.forEach(spike => {
          const darkerColor = color.clone().multiplyScalar(0.6)
          ;((spike as THREE.Mesh).material as THREE.MeshStandardMaterial).color = darkerColor
        })

        if (enemy.health <= 0) {
          // Create explosion at enemy position before removing it
          this.createExplosion(enemy.mesh.position.clone())
          
          // Play death sound
          this.deathAudio.currentTime = 0
          this.deathAudio.play().catch(error => {
            console.log("Audio play failed:", error)
          })

          this.scene.remove(enemy.mesh)
          this.enemies.splice(i, 1)
          useGameStore.getState().incrementCredits()
          return true
        } else {
          // Play hit sound for non-fatal hits
          this.hitAudio.currentTime = 0
          this.hitAudio.play().catch(error => {
            console.log("Audio play failed:", error)
          })
        }
        return true
      }
    }
    return false
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
    this.playerHitAudio.pause()
    this.playerHitAudio.src = ""
    this.particles.forEach(points => {
      this.scene.remove(points)
    })
    this.particles = []
  }
}
