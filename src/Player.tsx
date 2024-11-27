import * as THREE from 'three'
import { Keys, PlayerMovement, PlayerState } from './types/player'

export class Player {
    mesh: THREE.Mesh
    movement: PlayerMovement
    state: PlayerState
    boundaryLimit: number = 48.5
    private damageFlashTime: number = 0
    private readonly FLASH_DURATION = 200
    private originalColor: number = 0x888888
    private readonly BASE_MOVEMENT_SPEED = 0.3
    private readonly BASE_ROTATION_SPEED = 0.05

    constructor(scene: THREE.Scene, hasSpeedBoost: boolean, initialMaxJumps: number) {
        this.maxJumps = initialMaxJumps
        
        // Initialize movement with fixed values
        this.movement = {
            rotation: 0,
            speed: 0,
            strafeSpeed: this.BASE_MOVEMENT_SPEED,
            rotationSpeed: this.BASE_ROTATION_SPEED,
            maxSpeed: this.BASE_MOVEMENT_SPEED,
            acceleration: 0.01,
            deceleration: 0.01,
            jumpForce: 0.15,
            verticalVelocity: 0,
            gravity: 0.006,
            isGrounded: false
        }

        // Create player mesh
        const cubeGeometry = new THREE.BoxGeometry(1, 1, 1)
        const cubeMaterial = new THREE.MeshStandardMaterial({ 
            color: this.originalColor,
            metalness: 0.9,
            roughness: 0.1
        })
        this.mesh = new THREE.Mesh(cubeGeometry, cubeMaterial)
        this.mesh.position.y = 0.5
        this.mesh.castShadow = true
        scene.add(this.mesh)

        // Apply speed boost if available
        if (hasSpeedBoost) {
            this.movement.maxSpeed *= 1.5
            this.movement.strafeSpeed *= 1.5
        }

        this.state = {
            velocity: 0,
            jumpsAvailable: initialMaxJumps,
            isJumping: false
        }
    }

    handleMovement(keys: Keys) {
        // Handle rotation
        if (keys.a || keys.arrowleft) {
            this.mesh.rotation.y += this.movement.rotationSpeed
        }
        if (keys.d || keys.arrowright) {
            this.mesh.rotation.y -= this.movement.rotationSpeed
        }

        // Handle forward/backward movement with proper acceleration
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
            const moveX = Math.sin(this.mesh.rotation.y) * this.movement.speed
            const moveZ = Math.cos(this.mesh.rotation.y) * this.movement.speed
            this.mesh.position.x += moveX
            this.mesh.position.z += moveZ
            this.enforceBoundaries()
        }

        // Handle strafing
        if (keys.q || keys.e) {
            const strafeDirection = keys.e ? -1 : 1
            const strafeX = Math.cos(this.mesh.rotation.y) * this.movement.strafeSpeed * strafeDirection
            const strafeZ = -Math.sin(this.mesh.rotation.y) * this.movement.strafeSpeed * strafeDirection
            this.mesh.position.x += strafeX
            this.mesh.position.z += strafeZ
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
            this.state.jumpsAvailable = this.maxJumps
            this.state.isJumping = false
        }

        let onPlatform = false;
        
        // Platform collisions
        platforms.forEach(platform => {
            if (this.handlePlatformCollision(platform, 0.5)) {
                onPlatform = true;
            }
        });

        // Reset rotation when not on a platform
        if (!onPlatform && this.movement.isGrounded) {
            this.mesh.rotation.x = 0;
            this.mesh.rotation.z = 0;
        }

        // Update damage flash
        if (this.damageFlashTime > 0) {
            const timeSinceFlash = Date.now() - this.damageFlashTime
            if (timeSinceFlash >= this.FLASH_DURATION) {
                this.damageFlashTime = 0
                ;(this.mesh.material as THREE.MeshStandardMaterial).color.setHex(this.originalColor)
            }
        }
    }

    private handlePlatformCollision(platform: THREE.Mesh, playerRadius: number) {
        const platformGeometry = platform.geometry as THREE.BoxGeometry;
        const size = platformGeometry.parameters.width;
        const height = platformGeometry.parameters.height;

        // Get platform bounds
        const halfSize = size / 2;
        const platformMinX = platform.position.x - halfSize;
        const platformMaxX = platform.position.x + halfSize;
        const platformMinZ = platform.position.z - halfSize;
        const platformMaxZ = platform.position.z + halfSize;
        const platformTopY = platform.position.y + height/2;
        const platformBottomY = platform.position.y - height/2;

        // Check if player is within platform XZ bounds (accounting for player radius)
        const withinX = this.mesh.position.x + playerRadius > platformMinX && 
                        this.mesh.position.x - playerRadius < platformMaxX;
        const withinZ = this.mesh.position.z + playerRadius > platformMinZ && 
                        this.mesh.position.z - playerRadius < platformMaxZ;

        if (withinX && withinZ) {
            const playerY = this.mesh.position.y;
            const playerBottomY = playerY - playerRadius;
            const playerTopY = playerY + playerRadius;

            // Top collision (landing)
            if (playerBottomY >= platformTopY - 0.1 && 
                this.movement.verticalVelocity <= 0 && 
                playerBottomY <= platformTopY + 0.5) {
                
                this.mesh.position.y = platformTopY + playerRadius;
                this.movement.verticalVelocity = 0;
                this.movement.isGrounded = true;
                this.state.jumpsAvailable = this.maxJumps;
                this.state.isJumping = false;
                return true;
            }
            
            // Bottom collision
            else if (playerTopY <= platformBottomY + 0.1 && 
                     this.movement.verticalVelocity > 0) {
                this.mesh.position.y = platformBottomY - playerRadius;
                this.movement.verticalVelocity = 0;
                return true;
            }
            
            // Side collision
            else if (playerBottomY < platformTopY && playerTopY > platformBottomY) {
                // Push player out horizontally
                const centerX = platform.position.x;
                const centerZ = platform.position.z;
                const pushDirection = new THREE.Vector3(
                    this.mesh.position.x - centerX,
                    0,
                    this.mesh.position.z - centerZ
                ).normalize();
                
                this.mesh.position.x += pushDirection.x * 0.2;
                this.mesh.position.z += pushDirection.z * 0.2;
                return true;
            }
        }
        return false;
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

    takeDamage() {
        this.damageFlashTime = Date.now()
        ;(this.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xff0000)
    }

    resetJumps(maxJumps: number) {
        this.maxJumps = maxJumps
        this.state.jumpsAvailable = maxJumps
    }
} 