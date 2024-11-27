import * as THREE from 'three'
import { useGameStore } from './store/gameStore'
import healthSound from './assets/powerup.wav' // You can create a different sound if desired

export class HealthPickupManager {
  private pickups: THREE.Group[] = []
  private scene: THREE.Scene
  private levelBounds: number
  private lastSpawnTime: number = 0
  private spawnRate: number = 15000 // 15 seconds
  private healthAudio: HTMLAudioElement

  constructor(scene: THREE.Scene, levelBounds: number) {
    this.scene = scene
    this.levelBounds = levelBounds
    this.healthAudio = new Audio(healthSound)
    this.healthAudio.volume = useGameStore.getState().audioLevels.powerup
  }

  createHealthPickup(): THREE.Group {
    // Create a group to hold both sphere and cube
    const group = new THREE.Group()

    // Create red glowing sphere
    const sphereGeometry = new THREE.SphereGeometry(0.3)
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      metalness: 0.3,
      roughness: 0.2,
      emissive: 0xff0000,
      emissiveIntensity: 0.5
    })
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
    group.add(sphere)

    // Create wireframe cube
    const cubeGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8)
    const cubeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    })
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial)
    group.add(cube)

    // Random position within bounds
    group.position.set(
      (Math.random() * 2 - 1) * (this.levelBounds - 5),
      1,
      (Math.random() * 2 - 1) * (this.levelBounds - 5)
    )

    // Add rotation animation data
    group.userData.rotationSpeed = 0.02
    group.userData.floatOffset = Math.random() * Math.PI * 2
    group.userData.spawnTime = Date.now()

    this.scene.add(group)
    this.pickups.push(group)
    return group
  }

  update(playerPosition: THREE.Vector3) {
    const now = Date.now()
    if (now - this.lastSpawnTime > this.spawnRate) {
      this.createHealthPickup()
      this.lastSpawnTime = now
    }

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i]
      
      // Rotate both inner and outer parts
      pickup.rotation.y += 0.02
      pickup.rotation.x += 0.01

      // Float effect
      pickup.position.y = 1 + Math.sin(now * 0.002 + pickup.userData.floatOffset) * 0.2

      // Check for player collision
      if (playerPosition.distanceTo(pickup.position) < 2.5) {
        this.healthAudio.currentTime = 0
        this.healthAudio.play().catch(error => {
          console.log("Audio play failed:", error)
        })

        // Get current health and add 10, capped at 100
        const currentHealth = useGameStore.getState().health;
        useGameStore.getState().setHealth(Math.min(currentHealth + 10, 100));

        // Remove pickup
        this.scene.remove(pickup)
        this.pickups.splice(i, 1)
      }
    }
  }

  cleanup() {
    this.pickups.forEach(pickup => {
      this.scene.remove(pickup)
    })
    this.pickups = []
    this.healthAudio.pause()
    this.healthAudio.src = ''
  }
} 