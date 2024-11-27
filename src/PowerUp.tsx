import * as THREE from 'three'
import powerupSound from './assets/powerup.wav'
import { useGameStore } from './store/gameStore'

export class PowerUpManager {
  private powerUps: THREE.Mesh[] = []
  private scene: THREE.Scene
  private levelBounds: number
  private lastSpawnTime: number = 0
  private spawnRate: number = 10000 // 10 seconds
  private powerupAudio: HTMLAudioElement

  constructor(scene: THREE.Scene, levelBounds: number) {
    this.scene = scene
    this.levelBounds = levelBounds
    // Initialize audio
    this.powerupAudio = new Audio(powerupSound)
    this.powerupAudio.volume = useGameStore.getState().audioLevels.powerup
  }

  createPowerUp(): THREE.Mesh {
    // Create rhombus geometry (octahedron)
    const geometry = new THREE.OctahedronGeometry(0.5)
    
    // Create glowing gold material
    const material = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 1,
      roughness: 0.1,
      emissive: 0xffd700,
      emissiveIntensity: 0.5
    })

    const powerUp = new THREE.Mesh(geometry, material)

    // Random position within bounds
    powerUp.position.set(
      (Math.random() * 2 - 1) * (this.levelBounds - 5),
      1, // Floating above ground
      (Math.random() * 2 - 1) * (this.levelBounds - 5)
    )

    // Add rotation animation data
    powerUp.userData.rotationSpeed = 0.02
    powerUp.userData.floatOffset = Math.random() * Math.PI * 2
    powerUp.userData.spawnTime = Date.now()

    this.scene.add(powerUp)
    this.powerUps.push(powerUp)
    return powerUp
  }

  update(playerPosition: THREE.Vector3) {
    // Check if we should spawn a new power-up
    const now = Date.now()
    if (now - this.lastSpawnTime > this.spawnRate) {
      this.createPowerUp()
      this.lastSpawnTime = now
    }

    // Update existing power-ups
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i]
      
      // Rotate and float
      powerUp.rotation.y += powerUp.userData.rotationSpeed
      powerUp.position.y = 1 + Math.sin(now * 0.002 + powerUp.userData.floatOffset) * 0.2

      // Check for player collision with wider radius (changed from 1 to 2.5)
      if (playerPosition.distanceTo(powerUp.position) < 2.5) {
        // Play sound effect
        this.powerupAudio.currentTime = 0
        this.powerupAudio.play().catch(error => {
          console.log("Audio play failed:", error)
        })

        // Increment powerups and automatically update fire rate
        useGameStore.getState().incrementPowerups()

        // Remove power-up
        this.scene.remove(powerUp)
        this.powerUps.splice(i, 1)
      }
    }
  }

  cleanup() {
    // Add null checks and proper cleanup
    this.powerUps.forEach(powerUp => {
        if (powerUp.geometry) powerUp.geometry.dispose()
        if (powerUp.material) {
            if (Array.isArray(powerUp.material)) {
                powerUp.material.forEach(m => m.dispose())
            } else {
                powerUp.material.dispose()
            }
        }
        this.scene.remove(powerUp)
    })
    this.powerUps = []
    if (this.powerupAudio) {
        this.powerupAudio.pause()
        this.powerupAudio.src = ''
    }
  }
} 