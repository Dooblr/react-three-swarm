import { FC, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboard } from '../hooks/useKeyboard'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'

export const Player: FC = () => {
  const meshRef = useRef<THREE.Mesh>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  const velocity = useRef(new THREE.Vector3())
  const speed = 0.1
  const jumpForce = 0.3
  const gravity = 0.01
  const hasDoubleJumped = useRef(false)
  const lastJumpPressed = useRef(false)

  const { forward, backward, left, right, strafeLeft, strafeRight, jump } = useKeyboard()

  useFrame(() => {
    if (!meshRef.current || !cameraRef.current) return

    // Reset horizontal velocity
    velocity.current.x = 0
    velocity.current.z = 0

    // Apply gravity
    if (meshRef.current.position.y > 1) {
      velocity.current.y -= gravity
    }

    // Handle jump
    if (jump && !lastJumpPressed.current) {
      // First jump from ground
      if (meshRef.current.position.y <= 1) {
        velocity.current.y = jumpForce
      }
      // Second jump in air
      else if (!hasDoubleJumped.current) {
        velocity.current.y = jumpForce
        hasDoubleJumped.current = true
      }
    }
    lastJumpPressed.current = jump

    // Reset jump state when landing
    if (meshRef.current.position.y <= 1 && velocity.current.y <= 0) {
      meshRef.current.position.y = 1
      velocity.current.y = 0
      hasDoubleJumped.current = false
    }

    // Forward/Backward
    if (forward) velocity.current.z -= speed
    if (backward) velocity.current.z += speed

    // Left/Right rotation
    if (left) meshRef.current.rotation.y += 0.02
    if (right) meshRef.current.rotation.y -= 0.02

    // Strafe left/right
    if (strafeLeft) velocity.current.x -= speed
    if (strafeRight) velocity.current.x += speed

    // Apply movement in the direction the player is facing
    const direction = new THREE.Vector3()
    meshRef.current.getWorldDirection(direction)
    const movement = velocity.current.clone()
    const horizontalMovement = new THREE.Vector3(movement.x, 0, movement.z)
    horizontalMovement.applyAxisAngle(new THREE.Vector3(0, 1, 0), meshRef.current.rotation.y)
    
    // Apply horizontal and vertical movement separately
    meshRef.current.position.x += horizontalMovement.x
    meshRef.current.position.z += horizontalMovement.z
    meshRef.current.position.y += velocity.current.y

    // Update camera position
    const cameraOffset = new THREE.Vector3(0, 3, 6)
    const cameraPosition = meshRef.current.position.clone()
      .add(cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), meshRef.current.rotation.y))
    
    cameraRef.current.position.lerp(cameraPosition, 0.1)
    cameraRef.current.lookAt(meshRef.current.position)
  })

  return (
    <>
      <PerspectiveCamera 
        ref={cameraRef} 
        makeDefault 
        position={[0, 3, 6]} 
        fov={75}
      />
      <mesh ref={meshRef} position={[0, 1, 0]} castShadow>
        <boxGeometry args={[1, 2, 1]} />
        <meshStandardMaterial color="#1e88e5" />
        <pointLight intensity={1} distance={5} color="#ffffff" />
      </mesh>
    </>
  )
} 