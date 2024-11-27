import * as THREE from 'three'
import { useGameStore } from './store/gameStore'

export class Enemy2 {
    mesh: THREE.Group  // Changed to Group to hold sphere and spikes
    private mainSphere: THREE.Mesh
    private spikes: THREE.Mesh[] = []
    private speed: number = 0.04
    private health: number = 3
    private originalColor: number = 0xff4444
    private damageFlashTime: number = 0
    private readonly FLASH_DURATION = 200
    private readonly SIZE = 2
    private readonly SPIKE_COUNT = 15  // Number of spikes
    private scene: THREE.Scene
    private readonly LASER_SPEED = 0.8
    private readonly LASER_COLOR = 0xff0000
    private lastShotTime: number = 0
    private readonly SHOT_DELAY = 1000  // Fire every 1 second (increased frequency)
    private activeLasers: THREE.Line[] = []

    constructor(scene: THREE.Scene, position: THREE.Vector3) {
        this.scene = scene  // Store scene reference
        this.mesh = new THREE.Group()
        
        // Create main sphere
        const sphereGeometry = new THREE.SphereGeometry(this.SIZE / 2, 32, 32)
        const material = new THREE.MeshStandardMaterial({ 
            color: this.originalColor,
            metalness: 0.7,
            roughness: 0.3
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
                this.spikes.forEach(spike => {
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

        // Update active lasers and check for player collision
        for (let i = this.activeLasers.length - 1; i >= 0; i--) {
            const laser = this.activeLasers[i]
            const positions = laser.geometry.attributes.position.array as Float32Array
            
            // Move laser forward
            for (let j = 0; j < 6; j += 3) {
                positions[j] += laser.userData.direction.x * this.LASER_SPEED
                positions[j + 1] += laser.userData.direction.y * this.LASER_SPEED
                positions[j + 2] += laser.userData.direction.z * this.LASER_SPEED
            }
            
            laser.geometry.attributes.position.needsUpdate = true
            laser.userData.distanceTraveled += this.LASER_SPEED

            // Get laser position (using first point of the line)
            const laserPosition = new THREE.Vector3(
                positions[0],
                positions[1],
                positions[2]
            )

            // Check for player collision
            const distanceToPlayer = laserPosition.distanceTo(playerPosition)
            if (distanceToPlayer < 1) { // Collision radius of 1 unit
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
        // Create laser geometry
        const geometry = new THREE.BufferGeometry()
        const positions = new Float32Array(6)  // Two points (x,y,z) each
        
        // Calculate direction to player
        const direction = new THREE.Vector3()
            .subVectors(playerPosition, this.mesh.position)
            .normalize()
        
        // Set initial positions with some length (2 units long)
        positions[0] = this.mesh.position.x
        positions[1] = this.mesh.position.y
        positions[2] = this.mesh.position.z
        positions[3] = this.mesh.position.x + direction.x * 2
        positions[4] = this.mesh.position.y + direction.y * 2
        positions[5] = this.mesh.position.z + direction.z * 2
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

        // Create laser material with enhanced appearance
        const material = new THREE.LineBasicMaterial({ 
            color: 0xff0000,  // Pure red
            linewidth: 3,     // Thicker line
            transparent: true,
            opacity: 1,       // Full opacity
        })

        // Create laser beam
        const laser = new THREE.Line(geometry, material)
        
        // Add glow effect
        const glowMaterial = new THREE.LineBasicMaterial({
            color: 0xff3333,  // Lighter red for glow
            linewidth: 6,     // Thicker for glow effect
            transparent: true,
            opacity: 0.5      // More visible glow
        })
        const glowLine = new THREE.Line(geometry.clone(), glowMaterial)
        laser.add(glowLine)   // Add glow as child of main laser
        
        // Store direction in userData for movement
        laser.userData = {
            direction: direction,
            distanceTraveled: 0
        }

        this.scene.add(laser)
        this.activeLasers.push(laser)
    }

    takeDamage(): boolean {
        this.health--
        this.damageFlashTime = Date.now()
        this.mainSphere.material.color.setHex(0xffffff)
        this.spikes.forEach(spike => {
            spike.material.color.setHex(0xffffff)
        })
        
        if (this.health <= 0) {
            useGameStore.getState().setCredits(prev => prev + 2)
            return true
        }
        return false
    }

    cleanup(scene: THREE.Scene) {
        // Clean up all active lasers
        this.activeLasers.forEach(laser => {
            scene.remove(laser)
        })
        this.activeLasers = []
        scene.remove(this.mesh)
    }
} 