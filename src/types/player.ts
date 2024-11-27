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

export interface Keys {
    w: boolean
    s: boolean
    a: boolean
    d: boolean
    q: boolean
    e: boolean
    arrowup: boolean
    arrowdown: boolean
    arrowleft: boolean
    arrowright: boolean
    [key: string]: boolean
} 