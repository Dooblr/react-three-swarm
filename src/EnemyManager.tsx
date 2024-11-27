import * as THREE from "three"
//@ts-ignore
import { Enemy1 } from "./Enemy1"
import { Enemy2 } from "./Enemy2"
import { Player } from "./Player"
import { useGameStore } from "./store/gameStore"
import enemyDeathSound from "./assets/enemy_death.wav"
import enemyHitSound from "./assets/enemy_hit.wav"

export class EnemyManager {
  private enemies: (Enemy1 | Enemy2)[] = []
  private scene: THREE.Scene
  private player: Player
  private lastSpawnTime: number = 0
  private readonly SPAWN_DELAY = 3000
  private lastPlayerCollisionTime: number = 0
  private readonly COLLISION_COOLDOWN = 1000
  private readonly SPAWN_DISTANCE = 40 // Distance from center to spawn enemies
  private particles: THREE.Points[] = []
  private deathAudio: HTMLAudioElement
  private hitAudio: HTMLAudioElement

  // Explosion effect parameters
  private readonly EXPLOSION_PARAMS = {
    colors: [0xff0000, 0xff8800, 0xffff00, 0xff3300, 0xff5500, 0xff1100],
    particleCount: 120,
    baseSpeed: 8,
    speedVariation: 3.0,
    burstVelocity: 2.0,
    particleSize: 0.1,
    lifetime: 1000,
    gravity: 0.0002,
    drag: 0.9,
  }

  constructor(scene: THREE.Scene, player: Player) {
    this.scene = scene
    this.player = player
    this.lastSpawnTime = Date.now()

    // Initialize death audio
    this.deathAudio = new Audio(enemyDeathSound)
    this.hitAudio = new Audio(enemyHitSound)
    this.deathAudio.volume = useGameStore.getState().audioLevels.enemyDeath
    this.hitAudio.volume = useGameStore.getState().audioLevels.enemyHit
  }

  update(playerPosition: THREE.Vector3, delta: number) {
    const currentTime = Date.now()
    if (currentTime - this.lastSpawnTime > this.SPAWN_DELAY) {
      this.spawnEnemy()
      this.lastSpawnTime = currentTime
    }

    // Check for collisions with player and update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      enemy.update(playerPosition, delta)

      // Check player collision
      const distance = enemy.mesh.position.distanceTo(playerPosition)
      const collisionRadius = enemy instanceof Enemy2 ? 1.5 : 1.0

      if (distance < collisionRadius + 0.5) {
        // 0.5 is player radius
        if (
          currentTime - this.lastPlayerCollisionTime >
          this.COLLISION_COOLDOWN
        ) {
          this.handlePlayerCollision(enemy, i)
          this.lastPlayerCollisionTime = currentTime
        }
      }
    }

    // Update particle effects
    this.updateParticles(delta)
  }

  private handlePlayerCollision(enemy: Enemy1 | Enemy2, index: number): void {
    this.player.takeDamage()
    useGameStore.getState().decrementHealth()

    this.handleEnemyDeath(enemy, enemy.mesh.position.clone())
    enemy.cleanup(this.scene)
    this.enemies.splice(index, 1)
  }

  private handleEnemyDeath(enemy: Enemy1 | Enemy2, position: THREE.Vector3) {
    // Create explosion
    this.createExplosion(position, enemy instanceof Enemy2)

    // Play death sound
    this.deathAudio.currentTime = 0
    this.deathAudio.play().catch((error) => {
      console.log("Audio play failed:", error)
    })
  }

  spawnEnemy() {
    const spawnPos = this.getRandomSpawnPosition()
    // 30% chance to spawn Enemy2, 70% chance to spawn Enemy1
    const enemy =
      Math.random() > 0.7
        ? new Enemy2(this.scene, spawnPos)
        : new Enemy1(this.scene, spawnPos)
    this.enemies.push(enemy)
  }

  handleProjectileCollision(
    projectilePosition: THREE.Vector3,
    _isPowered: boolean
  ): boolean {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      const distance = enemy.mesh.position.distanceTo(projectilePosition)
      const collisionRadius = enemy instanceof Enemy2 ? 1.5 : 1.0

      if (distance < collisionRadius) {
        const isDead = enemy.takeDamage()
        
        // Play hit sound
        this.hitAudio.currentTime = 0
        this.hitAudio.play().catch(err => console.log('Audio play failed:', err))

        if (isDead) {
          this.handleEnemyDeath(enemy, enemy.mesh.position.clone())
          enemy.cleanup(this.scene)
          this.enemies.splice(i, 1)
        }
        return true
      }
    }
    return false
  }

  private createExplosion(
    position: THREE.Vector3,
    isLargeEnemy: boolean = false
  ) {
    const geometry = new THREE.BufferGeometry()
    const particleCount = isLargeEnemy
      ? 150
      : this.EXPLOSION_PARAMS.particleCount
    const positions = new Float32Array(particleCount * 3)
    const velocities: THREE.Vector3[] = []

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x
      positions[i * 3 + 1] = position.y
      positions[i * 3 + 2] = position.z

      const phi = Math.random() * Math.PI * 2
      const theta = Math.random() * Math.PI
      const speed =
        this.EXPLOSION_PARAMS.baseSpeed *
        (1 + Math.random() * this.EXPLOSION_PARAMS.speedVariation)

      const velocityVector = new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
        Math.cos(theta)
      ).multiplyScalar(speed)

      const burst = this.EXPLOSION_PARAMS.burstVelocity
      velocityVector.x += (Math.random() - 0.5) * burst
      velocityVector.y += (Math.random() - 0.5) * burst
      velocityVector.z += (Math.random() - 0.5) * burst

      velocities.push(velocityVector)
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))

    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color:
          this.EXPLOSION_PARAMS.colors[
            Math.floor(Math.random() * this.EXPLOSION_PARAMS.colors.length)
          ],
        size: isLargeEnemy ? 0.15 : this.EXPLOSION_PARAMS.particleSize,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )

    points.userData = {
      velocities,
      createdAt: Date.now(),
      lifetime: isLargeEnemy ? 1200 : this.EXPLOSION_PARAMS.lifetime,
      gravity: this.EXPLOSION_PARAMS.gravity,
      drag: this.EXPLOSION_PARAMS.drag,
    }

    this.scene.add(points)
    this.particles.push(points)
  }

  private updateParticles(deltaTime: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const points = this.particles[i]
      const positions = points.geometry.attributes.position
        .array as Float32Array
      const velocities = points.userData.velocities
      const age = Date.now() - points.userData.createdAt

      for (let j = 0; j < positions.length; j += 3) {
        velocities[j / 3].multiplyScalar(points.userData.drag)
        velocities[j / 3].y -= points.userData.gravity * deltaTime

        positions[j] += velocities[j / 3].x * deltaTime
        positions[j + 1] += velocities[j / 3].y * deltaTime
        positions[j + 2] += velocities[j / 3].z * deltaTime
      }
      points.geometry.attributes.position.needsUpdate = true

      const fadeProgress = age / points.userData.lifetime
      const opacity = Math.cos(fadeProgress * Math.PI * 0.5)
      ;(points.material as THREE.PointsMaterial).opacity = Math.max(0, opacity)

      if (age >= points.userData.lifetime) {
        this.scene.remove(points)
        this.particles.splice(i, 1)
      }
    }
  }

  cleanup() {
    this.enemies.forEach((enemy) => {
      enemy.cleanup(this.scene)
    })
    this.enemies = []
    this.particles.forEach((points) => {
      this.scene.remove(points)
    })
    this.particles = []
    this.deathAudio.pause()
    this.deathAudio.src = ""
    this.hitAudio.pause()
    this.hitAudio.src = ""
  }

  private getRandomSpawnPosition(): THREE.Vector3 {
    // Get a random angle
    const angle = Math.random() * Math.PI * 2

    // Calculate position on the circle
    const x = Math.cos(angle) * this.SPAWN_DISTANCE
    const z = Math.sin(angle) * this.SPAWN_DISTANCE

    // Return position vector (y = 0 since enemies spawn on the ground)
    return new THREE.Vector3(x, 0, z)
  }

  getEnemies() {
    return this.enemies
  }
}
