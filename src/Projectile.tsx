import * as THREE from "three"
import { useGameStore } from "./store/gameStore"
import { EnemyManager } from "./EnemyManager"
import bulletSound from "./assets/bullet.wav"
import upgradedBulletSound from "./assets/bullet2.wav"

export class ProjectileManager {
  private scene: THREE.Scene
  private projectiles: THREE.Mesh[] = []
  private bulletAudio: HTMLAudioElement
  private upgradedBulletAudio: HTMLAudioElement
  private levelBounds: number
  private projectileSpeed = 0.5
  private PROJECTILE_INITIAL_Y_VELOCITY = 0.2

  constructor(scene: THREE.Scene, levelBounds: number) {
    this.scene = scene
    this.levelBounds = levelBounds
    this.bulletAudio = new Audio(bulletSound)
    this.upgradedBulletAudio = new Audio(upgradedBulletSound)
    this.bulletAudio.volume = useGameStore.getState().audioLevels.bullet
    this.upgradedBulletAudio.volume = useGameStore.getState().audioLevels.bullet
  }

  createProjectile(
    playerPosition: THREE.Vector3,
    playerRotation: number,
    isPoweredShot: boolean
  ): void {
    if (!useGameStore.getState().isPaused) {
      const audioToPlay = isPoweredShot ? this.upgradedBulletAudio : this.bulletAudio
      audioToPlay.currentTime = 0
      audioToPlay.play().catch((error) => {
        console.log("Audio play failed:", error)
      })

      const projectileGeometry = new THREE.SphereGeometry(
        isPoweredShot ? 0.3 : 0.2
      )
      const projectileMaterial = new THREE.MeshStandardMaterial({
        color: isPoweredShot ? 0xffff00 : 0xff0000,
        emissive: isPoweredShot ? 0xffff00 : 0xff0000,
        emissiveIntensity: isPoweredShot ? 0.5 : 0.2,
      })

      const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial)
      projectile.position.copy(playerPosition)
      projectile.position.y += 0.5

      projectile.userData = {
        direction: new THREE.Vector3(
          Math.sin(playerRotation),
          0,
          Math.cos(playerRotation)
        ).normalize(),
        isPowered: isPoweredShot,
        timeAlive: 0,
        targetEnemy: null,
        yVelocity: this.PROJECTILE_INITIAL_Y_VELOCITY,
      }

      this.scene.add(projectile)
      this.projectiles.push(projectile)
    }
  }

  update(enemyManager: EnemyManager): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i]
      projectile.userData.timeAlive += 1

      // Only find nearest enemy if we have homing shots AND homing is enabled
      if (
        useGameStore.getState().hasHomingShots && 
        useGameStore.getState().homingEnabled &&
        !projectile.userData.targetEnemy
      ) {
        this.findNearestEnemy(projectile, enemyManager)
      }

      // Use homing behavior only if we have the powerup AND homing is enabled
      if (
        useGameStore.getState().hasHomingShots && 
        useGameStore.getState().homingEnabled
      ) {
        const homingStrength = projectile.userData.isPowered ? 0.1 : 0.05
        this.updateHomingProjectile(projectile, homingStrength)
      } else {
        // Normal straight movement
        projectile.position.add(
          projectile.userData.direction
            .clone()
            .multiplyScalar(this.projectileSpeed)
        )
      }

      // Remove old projectiles
      if (
        projectile.userData.timeAlive > 300 ||
        this.isOutOfBounds(projectile)
      ) {
        this.removeProjectile(i)
        continue
      }

      // Check enemy collisions
      if (enemyManager.handleProjectileCollision(projectile.position, projectile.userData.isPowered)) {
        this.removeProjectile(i)
      }
    }
  }

  private updateHomingProjectile(
    projectile: THREE.Mesh,
    homingStrength: number
  ): void {
    if (projectile.userData.targetEnemy) {
      const target = projectile.userData.targetEnemy.mesh.position
      const toTarget = new THREE.Vector3()
        .subVectors(target, projectile.position)
        .normalize()

      // Keep projectile at constant height
      toTarget.y = 0

      // Lerp towards target with different strengths based on power
      projectile.userData.direction.lerp(toTarget, homingStrength)

      // Move projectile
      projectile.position.add(
        projectile.userData.direction
          .clone()
          .multiplyScalar(this.projectileSpeed)
      )
    } else {
      // If no target, move forward normally
      projectile.position.add(
        projectile.userData.direction
          .clone()
          .multiplyScalar(this.projectileSpeed)
      )
    }
  }

  private findNearestEnemy(
    projectile: THREE.Mesh,
    enemyManager: EnemyManager
  ): void {
    const enemies = enemyManager.getEnemies()
    let nearestEnemy = null
    let nearestDistance = Infinity

    enemies.forEach((enemy: { mesh: THREE.Mesh }) => {
      const distance = projectile.position.distanceTo(enemy.mesh.position)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestEnemy = enemy
      }
    })
    projectile.userData.targetEnemy = nearestEnemy
  }

  private isOutOfBounds(projectile: THREE.Mesh): boolean {
    return (
      Math.abs(projectile.position.x) > this.levelBounds ||
      Math.abs(projectile.position.z) > this.levelBounds
    )
  }

  private removeProjectile(index: number): void {
    this.scene.remove(this.projectiles[index])
    this.projectiles.splice(index, 1)
  }

  cleanup(): void {
    this.projectiles.forEach((projectile) => {
      this.scene.remove(projectile)
    })
    this.projectiles = []
    this.bulletAudio.pause()
    this.upgradedBulletAudio.pause()
    this.bulletAudio.src = ""
    this.upgradedBulletAudio.src = ""
  }
}
