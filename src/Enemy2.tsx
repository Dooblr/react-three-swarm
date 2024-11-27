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

    constructor(scene: THREE.Scene, position: THREE.Vector3) {
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
        scene.remove(this.mesh)
    }
} 