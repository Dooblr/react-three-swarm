import * as THREE from 'three'
import { useGameStore } from './store/gameStore'

export class Enemy2 {
    mesh: THREE.Mesh
    private speed: number = 0.04
    private health: number = 3
    private originalColor: number = 0xff4444
    private damageFlashTime: number = 0
    private readonly FLASH_DURATION = 200
    private readonly SIZE = 2

    constructor(scene: THREE.Scene, position: THREE.Vector3) {
        // Create larger enemy cube
        const geometry = new THREE.BoxGeometry(this.SIZE, this.SIZE, this.SIZE)
        const material = new THREE.MeshStandardMaterial({ 
            color: this.originalColor,
            metalness: 0.7,
            roughness: 0.3
        })
        this.mesh = new THREE.Mesh(geometry, material)
        this.mesh.position.copy(position)
        this.mesh.position.y = this.SIZE / 2  // Adjust for size
        this.mesh.castShadow = true
        scene.add(this.mesh)
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
                ;(this.mesh.material as THREE.MeshStandardMaterial).color.setHex(this.originalColor)
            }
        }

        // Rotate towards player
        this.mesh.lookAt(playerPosition)
    }

    takeDamage(): boolean {
        this.health--
        this.damageFlashTime = Date.now()
        ;(this.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xffffff)
        
        if (this.health <= 0) {
            useGameStore.getState().setCredits(prev => prev + 2)  // More credits than Enemy1
            return true
        }
        return false
    }

    cleanup(scene: THREE.Scene) {
        scene.remove(this.mesh)
    }
} 