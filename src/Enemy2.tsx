import * as THREE from "three"
import { useGameStore } from "./store/gameStore"

export class Enemy2 {
  mesh: THREE.Group // Changed to Group to hold sphere and spikes
  private mainSphere: THREE.Mesh
  private spikes: THREE.Mesh[] = []
  private speed: number = 0.04
  private health: number = 3
  private originalColor: number = 0xff4444
  private damageFlashTime: number = 0
  private readonly FLASH_DURATION = 200
  private readonly SIZE = 2
  private readonly SPIKE_COUNT = 15 // Number of spikes
  private scene: THREE.Scene
  private readonly LASER_SPEED = 0.4
  private readonly LASER_LENGTH = 1.2 // Length of cylinder
  private readonly LASER_RADIUS = 0.2 // Radius of cylinder
  private readonly SHOT_DELAY = 1000 // Fire every 1 second
  private activeLasers: THREE.Mesh[] = []

  constructor(scene: THREE.Scene, position: THREE.Vector3) {
    this.scene = scene // Store scene reference
    this.mesh = new THREE.Group()

    // Create main sphere
    const sphereGeometry = new THREE.SphereGeometry(this.SIZE / 2, 32, 32)
    const material = new THREE.MeshStandardMaterial({
      color: this.originalColor,
      metalness: 0.7,
      roughness: 0.3,
    })
    this.mainSphere = new THREE.Mesh(sphereGeometry, material)
    this.mainSphere.castShadow = true
    this.mesh.add(this.mainSphere)

    // Create spikes
    const spikeGeometry = new THREE.ConeGeometry(0.2, 1, 8)
    for (let i = 0; i < this.SPIKE_COUNT; i++) {
      const spike = new THREE.Mesh(spikeGeometry, material.clone())

      // Random position on sphere surface
      const phi = Math.random() * Math.PI * 2
      const theta = Math.random() * Math.PI
      const radius = this.SIZE / 2

      spike.position.x = radius * Math.sin(theta) * Math.cos(phi)
      spike.position.y = radius * Math.sin(theta) * Math.sin(phi)
      spike.position.z = radius * Math.cos(theta)

      // Point spikes outward
      spike.lookAt(new THREE.Vector3(0, 0, 0))
      spike.rotateX(Math.PI / 2)

      this.spikes.push(spike)
      this.mesh.add(spike)
    }

    this.mesh.position.copy(position)
    this.mesh.position.y = this.SIZE / 2
    scene.add(this.mesh)

    // Initialize lastShotTime to ensure first shot happens immediately
    this.lastShotTime = Date.now() - this.SHOT_DELAY
  }

  update(playerPosition: THREE.Vector3) {
    // Move towards player
    const direction = new THREE.Vector3()
    direction.subVectors(playerPosition, this.mesh.position)
    direction.y = 0
    direction.normalize()

    this.mesh.position.add(direction.multiplyScalar(this.speed))

    // Update damage flash
    if (this.damageFlashTime > 0) {
      const timeSinceFlash = Date.now() - this.damageFlashTime
      if (timeSinceFlash >= this.FLASH_DURATION) {
        this.damageFlashTime = 0
        this.mainSphere.material.color.setHex(this.originalColor)
        this.spikes.forEach((spike) => {
          spike.material.color.setHex(this.originalColor)
        })
      }
    }

    // Rotate towards player
    this.mesh.lookAt(playerPosition)

    // Fire new laser
    const currentTime = Date.now()
    if (currentTime - this.lastShotTime > this.SHOT_DELAY) {
      this.shootLaser(playerPosition)
      this.lastShotTime = currentTime
    }

    // Update active lasers
    for (let i = this.activeLasers.length - 1; i >= 0; i--) {
      const laser = this.activeLasers[i]
      const laserDirection = laser.userData.direction.clone()

      // Move laser forward
      laser.position.add(laserDirection.multiplyScalar(this.LASER_SPEED))
      laser.userData.distanceTraveled += this.LASER_SPEED

      // Check for player collision
      const distanceToPlayer = laser.position.distanceTo(playerPosition)
      if (distanceToPlayer < 1) {
        // Collision radius of 1 unit
        useGameStore.getState().decrementHealth()
        this.scene.remove(laser)
        this.activeLasers.splice(i, 1)
        continue
      }

      // Remove laser after traveling certain distance
      if (laser.userData.distanceTraveled > 50) {
        this.scene.remove(laser)
        this.activeLasers.splice(i, 1)
      }
    }
  }

  private shootLaser(playerPosition: THREE.Vector3): void {
    // Calculate direction to player
    const direction = new THREE.Vector3()
      .subVectors(playerPosition, this.mesh.position)
      .normalize()

    // Laser cylinder geometry
    const cylinderGeometry = new THREE.CylinderGeometry(
      this.LASER_RADIUS, // radiusTop
      this.LASER_RADIUS, // radiusBottom
      this.LASER_LENGTH, // height
      12, // radialSegments
      1, // heightSegments
      false // open ended
    )

    // Cap geometry (spheres for rounded edges)
    const capGeometry = new THREE.SphereGeometry(this.LASER_RADIUS, 12, 12)

    // Laser material with emissive glow
    const laserMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff5555, // Glow effect
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.9,
    })

    // Create main cylinder (laser body)
    const laserBody = new THREE.Mesh(cylinderGeometry, laserMaterial)
    laserBody.castShadow = true

    // Rotate cylinder to align with direction of travel
    laserBody.rotateX(Math.PI / 2)
    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1), // Default cylinder orientation
      direction // Target direction
    )
    laserBody.setRotationFromQuaternion(quaternion)

    // Create caps for the laser (rounded edges)
    const capStart = new THREE.Mesh(capGeometry, laserMaterial)
    const capEnd = new THREE.Mesh(capGeometry, laserMaterial)

    // Position caps at cylinder ends
    const offset = direction.clone().multiplyScalar(this.LASER_LENGTH / 2)
    capStart.position.copy(laserBody.position).sub(offset)
    capEnd.position.copy(laserBody.position).add(offset)

    // Combine cylinder and caps into a single group
    const laserGroup = new THREE.Group()
    laserGroup.add(laserBody)
    laserGroup.add(capStart)
    laserGroup.add(capEnd)

    // Set initial position at enemy
    laserGroup.position.copy(this.mesh.position)

    // Offset the laser's group position slightly forward in firing direction
    laserGroup.position.add(direction.multiplyScalar(this.SIZE))

    // Store direction for movement and tracking
    laserGroup.userData = {
      direction: direction,
      distanceTraveled: 0,
    }

    // Add to scene and active lasers list
    this.scene.add(laserGroup)
    this.activeLasers.push(laserGroup)
  }

  takeDamage(): boolean {
    this.health--
    this.damageFlashTime = Date.now()
    this.mainSphere.material.color.setHex(0xffffff)
    this.spikes.forEach((spike) => {
      spike.material.color.setHex(0xffffff)
    })

    if (this.health <= 0) {
      useGameStore.getState().setCredits((prev) => prev + 2)
      return true
    }
    return false
  }

  cleanup(scene: THREE.Scene) {
    // Clean up all active lasers
    this.activeLasers.forEach((laser) => {
      scene.remove(laser)
    })
    this.activeLasers = []
    scene.remove(this.mesh)
  }
}
