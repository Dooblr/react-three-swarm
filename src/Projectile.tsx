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
  private PROJECTILE_SPEED = 0.5
  private PROJECTILE_INITIAL_Y_VELOCITY = 0.2
  private readonly YELLOW_SPEED_THRESHOLD = 0.15  // Threshold for yellow projectiles
  private readonly BLUE_SPEED_THRESHOLD = 0.08    // Threshold for blue projectiles

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
    if (useGameStore.getState().isPaused) return;

    const audioToPlay = isPoweredShot ? this.upgradedBulletAudio : this.bulletAudio;
    audioToPlay.currentTime = 0;
    audioToPlay.play().catch(error => console.log("Audio play failed:", error));

    let geometry: THREE.BufferGeometry;
    let material: THREE.MeshStandardMaterial;
    let projectileType: string;

    // Get current attack speed from store
    const currentAttackSpeed = useGameStore.getState().attackSpeed;

    if (currentAttackSpeed <= this.BLUE_SPEED_THRESHOLD) {
        // Third tier - Purple Star
        geometry = new THREE.TetrahedronGeometry(0.4);
        material = new THREE.MeshStandardMaterial({
            color: 0x9932CC,
            emissive: 0x9932CC,
            emissiveIntensity: 0.8
        });
        projectileType = 'purple';
    } else if (currentAttackSpeed <= this.YELLOW_SPEED_THRESHOLD) {
        // Second tier - Blue Diamond
        geometry = new THREE.OctahedronGeometry(0.3);
        material = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.6
        });
        projectileType = 'blue';
    } else {
        // First tier - Basic Projectile
        geometry = new THREE.SphereGeometry(isPoweredShot ? 0.3 : 0.2);
        material = new THREE.MeshStandardMaterial({
            color: isPoweredShot ? 0xffff00 : 0xff0000,
            emissive: isPoweredShot ? 0xffff00 : 0xff0000,
            emissiveIntensity: isPoweredShot ? 0.5 : 0.2
        });
        projectileType = 'yellow';
    }

    const projectile = new THREE.Mesh(geometry, material);
    projectile.position.copy(playerPosition);
    projectile.position.y += 0.5;

    // Add rotation speeds for upgraded projectiles
    const rotationSpeed = projectileType !== 'yellow' ? {
        x: Math.random() * 0.1,
        y: Math.random() * 0.1,
        z: Math.random() * 0.1
    } : null;

    projectile.userData = {
        direction: new THREE.Vector3(
            Math.sin(playerRotation),
            0,
            Math.cos(playerRotation)
        ).normalize(),
        isPowered: isPoweredShot,
        timeAlive: 0,
        projectileType,
        rotationSpeed,
        yVelocity: this.PROJECTILE_INITIAL_Y_VELOCITY
    };

    this.scene.add(projectile);
    this.projectiles.push(projectile);
  }

  update(enemyManager: EnemyManager): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const projectile = this.projectiles[i];
        projectile.userData.timeAlive += 1;

        // Apply rotation for upgraded projectiles
        if (projectile.userData.rotationSpeed) {
            projectile.rotation.x += projectile.userData.rotationSpeed.x;
            projectile.rotation.y += projectile.userData.rotationSpeed.y;
            projectile.rotation.z += projectile.userData.rotationSpeed.z;
        }

        // Move projectile
        projectile.position.add(
            projectile.userData.direction
                .clone()
                .multiplyScalar(this.PROJECTILE_SPEED)
        );

        // Check bounds and lifetime
        if (
            projectile.userData.timeAlive > 300 ||
            this.isOutOfBounds(projectile)
        ) {
            this.removeProjectile(i);
            continue;
        }

        // Calculate damage based on projectile type
        const damage = projectile.userData.projectileType === 'purple' ? 3 :
                      projectile.userData.projectileType === 'blue' ? 2 : 1;

        // Check collisions
        if (enemyManager.handleProjectileCollision(projectile.position, projectile.userData.isPowered, damage)) {
            this.removeProjectile(i);
        }
    }
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
