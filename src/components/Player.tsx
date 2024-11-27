import { FC, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { useKeyboard } from '../hooks/useKeyboard'
import { useCollider } from '../hooks/useCollider'

const MOVEMENT_SPEED = 0.15
const TURN_SPEED = 0.03
const JUMP_FORCE = 0.3
const MULTI_JUMP_FORCE = 0.25  // Slightly weaker subsequent jumps
const GRAVITY = 0.01
const CAMERA_HEIGHT = 3
const CAMERA_DISTANCE = 8
const GROUND_PLANE = 0
const PLAYER_HEIGHT = 2
const FLOOR_SIZE = 25  // Half of 50x50 floor plane
const PLAYER_RADIUS = 0.5  // Half of player width
const COLLIDER_SIZE = { x: 1, y: PLAYER_HEIGHT, z: 1 }
const MAX_JUMPS = 2  // Double jump (can be increased for more jumps)

export const Player: FC = () => {
  // Refs for meshes and transforms
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  
  // Physics state
  const position = useRef(new THREE.Vector3(0, PLAYER_HEIGHT / 2, 0))
  const velocity = useRef(new THREE.Vector3())
  const rotation = useRef(0)
  const isGrounded = useRef(false)
  const jumpCount = useRef(0)
  const lastJumpPressed = useRef(false)

  // Input controls
  const { forward, backward, left, right, strafeLeft, strafeRight, jump } = useKeyboard()

  // Collision detection
  const { checkCollisions } = useCollider({
    type: 'box',
    size: new THREE.Vector3(COLLIDER_SIZE.x / 2, COLLIDER_SIZE.y / 2, COLLIDER_SIZE.z / 2),
    layer: 'player',
    position: position.current,
    entity: meshRef.current
  })

  // Clamp position within floor boundaries
  const clampPosition = (pos: THREE.Vector3): THREE.Vector3 => {
    const maxBound = FLOOR_SIZE - PLAYER_RADIUS
    const minBound = -FLOOR_SIZE + PLAYER_RADIUS
    
    pos.x = Math.max(minBound, Math.min(maxBound, pos.x))
    pos.z = Math.max(minBound, Math.min(maxBound, pos.z))
    return pos
  }

  useFrame((state) => {
    if (!meshRef.current || !groupRef.current || !cameraRef.current) return

    // Handle rotation
    if (left) rotation.current += TURN_SPEED
    if (right) rotation.current -= TURN_SPEED

    // Calculate movement direction
    const direction = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.current)
    
    // Get right direction for strafing
    const rightDirection = new THREE.Vector3(
      -direction.z,
      0,
      direction.x
    )

    // Calculate movement
    const movement = new THREE.Vector3()
    if (forward) movement.add(direction.clone().multiplyScalar(MOVEMENT_SPEED))
    if (backward) movement.add(direction.clone().multiplyScalar(-MOVEMENT_SPEED))
    if (strafeLeft) movement.add(rightDirection.clone().multiplyScalar(-MOVEMENT_SPEED))
    if (strafeRight) movement.add(rightDirection.clone().multiplyScalar(MOVEMENT_SPEED))

    // Test new position before applying
    const nextPosition = position.current.clone().add(movement)
    const clampedPosition = clampPosition(nextPosition)
    
    // Only apply movement if we're within bounds
    position.current.copy(clampedPosition)

    // Apply gravity and vertical movement
    if (!isGrounded.current) {
      velocity.current.y -= GRAVITY
    }

    // Handle jump
    if (jump && !lastJumpPressed.current && jumpCount.current < MAX_JUMPS) {
      // First jump uses full force, subsequent jumps use reduced force
      const force = jumpCount.current === 0 ? JUMP_FORCE : MULTI_JUMP_FORCE
      velocity.current.y = force
      jumpCount.current++
      isGrounded.current = false
    }
    lastJumpPressed.current = jump

    // Apply vertical movement
    position.current.y += velocity.current.y

    // Ground collision
    if (position.current.y <= PLAYER_HEIGHT / 2) {
      position.current.y = PLAYER_HEIGHT / 2
      velocity.current.y = 0
      isGrounded.current = true
      jumpCount.current = 0  // Reset jump count when grounded
    }

    // Check collisions with other objects
    const collisions = checkCollisions()
    for (const collision of collisions) {
      if (collision.hasCollision && collision.penetration && collision.normal) {
        position.current.add(collision.penetration)
        // Clamp after collision response
        clampPosition(position.current)
      }
    }

    // Update transforms
    groupRef.current.position.copy(position.current)
    groupRef.current.rotation.y = rotation.current

    // Update camera position
    const cameraOffset = new THREE.Vector3(
      0,
      CAMERA_HEIGHT,
      -CAMERA_DISTANCE
    ).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.current)
    
    const targetCameraPos = position.current.clone().add(cameraOffset)
    cameraRef.current.position.lerp(targetCameraPos, 0.1)
    cameraRef.current.lookAt(position.current)
  })

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1} 
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      {/* Camera */}
      <PerspectiveCamera 
        ref={cameraRef} 
        makeDefault 
        position={[0, CAMERA_HEIGHT, -CAMERA_DISTANCE]} 
        fov={75}
      />
      
      {/* Player */}
      <group ref={groupRef}>
        {/* Visual mesh */}
        <mesh 
          ref={meshRef}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1, PLAYER_HEIGHT, 1]} />
          <meshStandardMaterial color="#1e88e5" />
        </mesh>

        {/* Collision wireframe */}
        <mesh>
          <boxGeometry args={[COLLIDER_SIZE.x, COLLIDER_SIZE.y, COLLIDER_SIZE.z]} />
          <meshBasicMaterial 
            color="red" 
            wireframe 
            wireframeLinewidth={2}
            transparent
            opacity={0.5}
          />
        </mesh>
      </group>
    </>
  )
} 