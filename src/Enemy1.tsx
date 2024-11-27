import * as THREE from 'three'
import { useGameStore } from './store/gameStore'

export class Enemy1 {
    mesh: THREE.Mesh
    private speed: number = 0.06
    private health: number = 2
    private originalColor: number = 0x00ff00
    private damageFlashTime: number = 0
    private readonly FLASH_DURATION = 200
    private readonly SIZE = 1

    constructor(scene: THREE.Scene, position: THREE.Vector3) {
        // Create enemy sphere with spikes
        const geometry = new THREE.SphereGeometry(this.SIZE * 0.5, 16, 16)
        const material = new THREE.MeshStandardMaterial({ 
            color: this.originalColor,
            metalness: 0.3,
            roughness: 0.7
        })
        this.mesh = new THREE.Mesh(geometry, material)
        this.mesh.position.copy(position)
        this.mesh.position.y = this.SIZE / 2
        this.mesh.castShadow = true

        // Add spikes
        const spikeGroup = new THREE.Group()
        const numberOfSpikes = Math.floor(Math.random() * 6) + 4

        for (let i = 0; i < numberOfSpikes; i++) {
            const spikeGeometry = new THREE.ConeGeometry(0.1, 0.3, 4)
            const spikeMaterial = new THREE.MeshStandardMaterial({
                color: 0x009900,
                metalness: 0.5,
                roughness: 0.5,
            })
            const spike = new THREE.Mesh(spikeGeometry, spikeMaterial)

            // Random position on sphere surface
            const phi = Math.random() * Math.PI * 2
            const theta = Math.random() * Math.PI
            spike.position.setFromSpherical(new THREE.Spherical(0.5, theta, phi))
            spike.lookAt(spike.position.clone().multiplyScalar(2))

            spikeGroup.add(spike)
        }

        this.mesh.add(spikeGroup)
        scene.add(this.mesh)

        // Store max health in userData for damage calculation
        this.mesh.userData.maxHealth = this.health
    }

    update(playerPosition: THREE.Vector3) {
        // Move towards player
        const direction = new THREE.Vector3()
        direction.subVectors(playerPosition, this.mesh.position)
        direction.y = 0  // Keep y-position constant
        direction.normalize()
        
        this.mesh.position.add(direction.multiplyScalar(this.speed))

        // Update damage flash
        if (this.damageFlashTime > 0) {
            const timeSinceFlash = Date.now() - this.damageFlashTime
            if (timeSinceFlash >= this.FLASH_DURATION) {
                this.damageFlashTime = 0
                this.updateColor()
            }
        }

        // Add wobble rotation
        this.mesh.rotation.x = Math.sin(Date.now() * 0.004) * 0.3
        this.mesh.rotation.z = Math.cos(Date.now() * 0.004) * 0.3
    }

    takeDamage(): boolean {
        this.health--
        this.damageFlashTime = Date.now()
        ;(this.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xffffff)
        
        if (this.health <= 0) {
            useGameStore.getState().setCredits(prev => prev + 1)
            return true
        }

        this.updateColor()
        return false
    }

    private updateColor() {
        const healthPercent = this.health / this.mesh.userData.maxHealth
        const color = new THREE.Color()
        color.r = 1 - healthPercent
        color.g = healthPercent
        color.b = 0

        // Update main body color
        ;(this.mesh.material as THREE.MeshStandardMaterial).color = color
        
        // Update spike colors to darker version
        this.mesh.children[0].children.forEach(spike => {
            const darkerColor = color.clone().multiplyScalar(0.6)
            ;((spike as THREE.Mesh).material as THREE.MeshStandardMaterial).color = darkerColor
        })
    }

    cleanup(scene: THREE.Scene) {
        scene.remove(this.mesh)
        
        // Dispose of main mesh resources
        this.mesh.geometry.dispose()
        ;(this.mesh.material as THREE.Material).dispose()
        
        // Clean up spike materials and geometries
        const spikeGroup = this.mesh.children[0]
        spikeGroup.children.forEach(spike => {
            const spikeMesh = spike as THREE.Mesh
            if (spikeMesh.geometry) spikeMesh.geometry.dispose()
            if (spikeMesh.material) {
                (spikeMesh.material as THREE.Material).dispose()
            }
        })
    }
} 