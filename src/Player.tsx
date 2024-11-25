import * as THREE from 'three'
import { useGameStore } from './store/gameStore'

export interface PlayerMovement {
    rotation: number
    speed: number
    strafeSpeed: number
    rotationSpeed: number
    maxSpeed: number
    acceleration: number
    deceleration: number
    jumpForce: number
    verticalVelocity: number
    gravity: number
    isGrounded: boolean
}

export interface PlayerState {
    velocity: number
    jumpsAvailable: number
    isJumping: boolean
}

export class Player {
    mesh: THREE.Mesh
    movement: PlayerMovement
    state: PlayerState
    boundaryLimit: number = 48.5

    constructor(scene: THREE.Scene) {
        // Create player cube
        const cubeGeometry = new THREE.BoxGeometry(1, 1, 1)
        const cubeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x888888,
            metalness: 0.9,
            roughness: 0.1
        })
        this.mesh = new THREE.Mesh(cubeGeometry, cubeMaterial)
        this.mesh.position.y = 0.5
        this.mesh.castShadow = true
        scene.add(this.mesh)

        this.movement = {
            rotation: 0,
            speed: 0,
            strafeSpeed: 0.2,
            rotationSpeed: 0.05,
            maxSpeed: 0.3,
            acceleration: 0.01,
            deceleration: 0.01,
            jumpForce: 0.15,
            verticalVelocity: 0,
            gravity: 0.006,
            isGrounded: false
        }

        this.state = {
            velocity: 0,
            jumpsAvailable: 2,
            isJumping: false
        }
    }

    handleMovement(keys: { [key: string]: boolean }) {
        // Handle rotation
        if (keys.a || keys.arrowleft) {
            this.mesh.rotation.y += this.movement.rotationSpeed
        }
        if (keys.d || keys.arrowright) {
            this.mesh.rotation.y -= this.movement.rotationSpeed
        }

        // Handle forward/backward movement
        if (keys.w || keys.arrowup) {
            this.movement.speed = Math.min(
                this.movement.speed + this.movement.acceleration, 
                this.movement.maxSpeed
            )
        } else if (keys.s || keys.arrowdown) {
            this.movement.speed = Math.max(
                this.movement.speed - this.movement.acceleration, 
                -this.movement.maxSpeed
            )
        } else {
            // Decelerate when no forward/backward keys are pressed
            if (Math.abs(this.movement.speed) < this.movement.deceleration) {
                this.movement.speed = 0
            } else {
                this.movement.speed -= Math.sign(this.movement.speed) * this.movement.deceleration
            }
        }

        // Apply movement in facing direction
        if (this.movement.speed !== 0) {
            this.mesh.position.x += Math.sin(this.mesh.rotation.y) * this.movement.speed
            this.mesh.position.z += Math.cos(this.mesh.rotation.y) * this.movement.speed
            this.enforceBoundaries()
        }

        // Handle strafing
        if (keys.q || keys.e) {
            const strafeDirection = keys.e ? -1 : 1
            this.mesh.position.x += Math.cos(this.mesh.rotation.y) * this.movement.strafeSpeed * strafeDirection
            this.mesh.position.z -= Math.sin(this.mesh.rotation.y) * this.movement.strafeSpeed * strafeDirection
            this.enforceBoundaries()
        }
    }

    update(platforms: THREE.Mesh[]) {
        // Apply gravity
        this.movement.verticalVelocity -= this.movement.gravity
        this.mesh.position.y += this.movement.verticalVelocity

        // Ground collision
        if (this.mesh.position.y <= 0.5) {
            this.mesh.position.y = 0.5
            this.movement.verticalVelocity = 0
            this.movement.isGrounded = true
            this.state.jumpsAvailable = 2
            this.state.isJumping = false
        }

        // Platform collisions
        platforms.forEach(platform => {
            this.handlePlatformCollision(platform, 0.5)
        })
    }

    private handlePlatformCollision(platform: THREE.Mesh, playerRadius: number) {
        const platformWidth = 1.5
        const platformDepth = 1.5
        const platformHeight = 1

        const dx = this.mesh.position.x - platform.position.x
        const dz = this.mesh.position.z - platform.position.z
        const dy = this.mesh.position.y - platform.position.y

        if (Math.abs(dx) < (platformWidth + playerRadius) && 
            Math.abs(dz) < (platformDepth + playerRadius) && 
            Math.abs(dy) < (platformHeight + playerRadius)) {
            
            this.resolvePlatformCollision(dx, dy, dz, platformWidth, platformHeight, platformDepth, playerRadius)
        }
    }

    private resolvePlatformCollision(
        dx: number, dy: number, dz: number,
        platformWidth: number, platformHeight: number, platformDepth: number,
        playerRadius: number
    ) {
        const overlapX = (platformWidth + playerRadius) - Math.abs(dx)
        const overlapZ = (platformDepth + playerRadius) - Math.abs(dz)
        const overlapY = (platformHeight + playerRadius) - Math.abs(dy)

        if (overlapX < overlapY && overlapX < overlapZ) {
            // X-axis collision
            this.mesh.position.x += dx > 0 ? overlapX : -overlapX
        } else if (overlapZ < overlapY && overlapZ < overlapX) {
            // Z-axis collision
            this.mesh.position.z += dz > 0 ? overlapZ : -overlapZ
        } else {
            // Y-axis collision
            if (dy > 0) {
                this.mesh.position.y += overlapY
                this.movement.verticalVelocity = 0
                this.movement.isGrounded = true
                this.state.jumpsAvailable = 2
                this.state.isJumping = false
            } else {
                this.mesh.position.y -= overlapY
                this.movement.verticalVelocity = 0
            }
        }
    }

    private enforceBoundaries() {
        this.mesh.position.x = Math.max(-this.boundaryLimit, Math.min(this.boundaryLimit, this.mesh.position.x))
        this.mesh.position.z = Math.max(-this.boundaryLimit, Math.min(this.boundaryLimit, this.mesh.position.z))
    }

    jump() {
        if (this.state.jumpsAvailable > 0) {
            this.movement.verticalVelocity = this.movement.jumpForce
            this.state.jumpsAvailable--
            this.movement.isGrounded = false
        }
    }

    getPosition(): THREE.Vector3 {
        return this.mesh.position
    }

    cleanup(scene: THREE.Scene) {
        scene.remove(this.mesh)
    }
} 