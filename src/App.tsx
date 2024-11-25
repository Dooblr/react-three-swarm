import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import "./App.scss"
import { EnemyManager } from "./Enemy"
import { PowerUpManager } from "./PowerUp.tsx"
import { useGameStore } from "./store/gameStore"
import musicLoop from "./assets/music_loop.wav"
import musicLoop2 from "./assets/music_loop_2.wav"
import { HealthPickupManager } from "./HealthPickup"
import { Player } from "./Player"
import bulletSound from "./assets/bullet.wav"
import HUD from "./components/HUD"

const setupBackgroundMusic = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext
  const audioContext = new AudioContext()
  let loopCount = 0
  let currentTrack = 2
  let source: AudioBufferSourceNode | null = null
  let audioBuffer1: AudioBuffer | null = null
  let audioBuffer2: AudioBuffer | null = null

  const loadAudioBuffers = async () => {
    const response1 = await fetch(musicLoop)
    const arrayBuffer1 = await response1.arrayBuffer()
    audioBuffer1 = await audioContext.decodeAudioData(arrayBuffer1)

    const response2 = await fetch(musicLoop2)
    const arrayBuffer2 = await response2.arrayBuffer()
    audioBuffer2 = await audioContext.decodeAudioData(arrayBuffer2)
  }

  const createAndStartSource = (buffer: AudioBuffer) => {
    if (source) {
      source.stop()
      source.disconnect()
    }

    source = audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = false

    const gainNode = audioContext.createGain()
    gainNode.gain.value = 0.25

    source.connect(gainNode)
    gainNode.connect(audioContext.destination)

    source.onended = () => {
      loopCount++
      if (loopCount >= 4) {
        loopCount = 0
        currentTrack = currentTrack === 1 ? 2 : 1
      }
      createAndStartSource(currentTrack === 1 ? audioBuffer1! : audioBuffer2!)
    }

    source.start(0)
  }

  loadAudioBuffers().then(() => {
    createAndStartSource(audioBuffer2!)
  })

  return {
    pause() {
      audioContext.suspend()
    },
    async play() {
      return audioContext.resume()
    },
    cleanup() {
      if (source) {
        source.stop()
        source.disconnect()
      }
      audioContext.close()
    },
  }
}

const App = () => {
  const mountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  let enemyManager: EnemyManager
  let powerUpManager: PowerUpManager
  let healthPickupManager: HealthPickupManager

  // Subscribe to both score and health from Zustand
  //@ts-ignore
  const score = useGameStore((state) => state.score)
  //@ts-ignore
  const health = useGameStore((state) => state.health)
  const [isPaused, setIsPaused] = useState(false)

  const playerState = {
    velocity: 0,
    jumpsAvailable: 2, // Start with 2 jumps
    isJumping: false,
  }

  const cameraDistanceRef = useRef(10) // Default camera distance
  const MIN_ZOOM = 5
  const MAX_ZOOM = 15

  const audioRef = useRef<ReturnType<typeof setupBackgroundMusic> | null>(null)

  useEffect(() => {
    audioRef.current = setupBackgroundMusic()

    // Scene setup
    const scene = new THREE.Scene()
    // Add gradient background
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
      }
    `

    const uniforms = {
      topColor: { value: new THREE.Color(0x72b7ed) }, // Light blue
      bottomColor: { value: new THREE.Color(0x0046b8) }, // Darker blue
    }

    const skyGeo = new THREE.SphereGeometry(500, 32, 15)
    const skyMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      side: THREE.BackSide,
    })
    const sky = new THREE.Mesh(skyGeo, skyMat)
    scene.add(sky)

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true
    mountRef.current?.appendChild(renderer.domElement)

    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(50, 75, 50)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    // Create procedural grass texture
    const canvas = document.createElement("canvas")
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext("2d")!

    // Fill base color
    context.fillStyle = "#2d5e1e" // Dark grass green
    context.fillRect(0, 0, 256, 256)

    // Add noise for texture
    for (let i = 0; i < 50000; i++) {
      const x = Math.random() * 256
      const y = Math.random() * 256
      const brightness = Math.random() * 0.3 // Variation amount

      context.fillStyle = `rgba(255, 255, 255, ${brightness})`
      context.fillRect(x, y, 2, 2)
    }

    const grassTexture = new THREE.CanvasTexture(canvas)
    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping
    grassTexture.repeat.set(25, 25) // Adjust texture tiling

    const planeGeometry = new THREE.PlaneGeometry(100, 100)
    const planeMaterial = new THREE.MeshStandardMaterial({
      map: grassTexture,
      roughness: 0.8,
      metalness: 0.2,
    })
    const plane = new THREE.Mesh(planeGeometry, planeMaterial)
    plane.rotation.x = -Math.PI / 2
    plane.receiveShadow = true
    scene.add(plane)

    // Create random platforms
    const createPlatforms = () => {
      const platforms: THREE.Mesh[] = []
      const numPlatforms = 20

      const platformMaterial = new THREE.MeshStandardMaterial({
        color: 0x8fbc8f,
        roughness: 0.8,
        metalness: 0.1,
      })

      for (let i = 0; i < numPlatforms; i++) {
        const size = 3 + Math.random() * 2
        const height = 2 + Math.random() * 3

        const platformGeometry = new THREE.BoxGeometry(size, height, size)
        const platformMesh = new THREE.Mesh(platformGeometry, platformMaterial)

        // Random position within bounds
        const positionX = (Math.random() - 0.5) * 80
        const positionZ = (Math.random() - 0.5) * 80

        platformMesh.position.set(positionX, height / 2, positionZ)
        platformMesh.castShadow = true
        platformMesh.receiveShadow = true

        scene.add(platformMesh)
        platforms.push(platformMesh)
      }

      return platforms
    }

    const platforms = createPlatforms()

    // Initialize player
    playerRef.current = new Player(scene)

    // Add perimeter walls
    const wallGeometry = new THREE.BoxGeometry(1, 3, 100) // Height of 3, length of 100
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.7,
      metalness: 0.3,
    })

    // Create four walls
    const walls = [
      { position: [50, 1.5, 0], rotation: [0, 0, 0] }, // Right wall
      { position: [-50, 1.5, 0], rotation: [0, 0, 0] }, // Left wall
      { position: [0, 1.5, 50], rotation: [0, Math.PI / 2, 0] }, // Front wall
      { position: [0, 1.5, -50], rotation: [0, Math.PI / 2, 0] }, // Back wall
    ]

    walls.forEach(({ position, rotation }) => {
      const wall = new THREE.Mesh(wallGeometry, wallMaterial)
      wall.position.set(position[0], position[1], position[2])
      wall.rotation.set(rotation[0], rotation[1], rotation[2])
      wall.castShadow = true
      wall.receiveShadow = true
      scene.add(wall)
    })

    // Add orbiting light
    const orbitingLight = new THREE.DirectionalLight(0xffffff, 0.8)
    orbitingLight.castShadow = true
    scene.add(orbitingLight)

    const keys = {
      w: false,
      s: false,
      a: false,
      d: false,
      q: false, // Added for left strafe
      e: false, // Added for right strafe
      arrowup: false,
      arrowdown: false,
      arrowleft: false,
      arrowright: false,
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      if (key === "escape") {
        setIsPaused((prev) => {
          const newPauseState = !prev
          useGameStore.getState().setPaused(newPauseState)
          return newPauseState
        })
        return
      }

      if (!useGameStore.getState().isPaused) {
        if (key === " ") {
          playerRef.current?.jump()
          return
        }

        if (key in keys) {
          keys[key as keyof typeof keys] = true
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      // Handle spacebar release
      if (key === " ") {
        playerState.isJumping = false
        return
      }

      // Handle other keys
      if (key in keys) {
        keys[key as keyof typeof keys] = false
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    // Initialize enemy manager with platforms
    enemyManager = new EnemyManager(scene, 50, platforms)

    // Initialize powerUpManager
    powerUpManager = new PowerUpManager(scene, 50)

    // Initialize healthPickupManager
    healthPickupManager = new HealthPickupManager(scene, 50)

    // Add projectile-related variables
    const projectiles: THREE.Mesh[] = []
    const projectileSpeed = 0.5
    const levelBounds = 50

    // Add bullet sound setup
    const bulletAudio = new Audio()
    bulletAudio.src = bulletSound // Use the imported asset
    bulletAudio.volume = 0.2

    // Shooting system
    const createProjectile = () => {
      if (!useGameStore.getState().isPaused && playerRef.current) {
        // Play bullet sound
        bulletAudio.currentTime = 0
        bulletAudio.play().catch((error) => {
          console.log("Audio play failed:", error)
        })

        const projectileGeometry = new THREE.SphereGeometry(0.2)
        const projectileMaterial = new THREE.MeshStandardMaterial({
          color: 0xff0000,
        })
        const projectile = new THREE.Mesh(
          projectileGeometry,
          projectileMaterial
        )

        // Set position to player position
        projectile.position.copy(playerRef.current.getPosition())
        projectile.position.y = 0.5 // Match player height

        // Calculate direction based on player rotation
        const direction = new THREE.Vector3(
          Math.sin(playerRef.current.mesh.rotation.y),
          0,
          Math.cos(playerRef.current.mesh.rotation.y)
        ).normalize()

        projectile.userData.direction = direction
        scene.add(projectile)
        projectiles.push(projectile)
      }
    }

    // Auto-shooting interval
    let shootingInterval: ReturnType<typeof setInterval>
    const BASE_FIRE_RATE = 1000 // Base fire rate of 1 shot per second (1000ms)
    const updateShootingInterval = () => {
      if (shootingInterval) clearInterval(shootingInterval)
      const actualFireRate = BASE_FIRE_RATE / useGameStore.getState().fireRate
      shootingInterval = setInterval(createProjectile, actualFireRate)
    }
    updateShootingInterval()

    // Subscribe to fireRate changes
    const unsubscribe = useGameStore.subscribe((state) => {
      if (state.fireRate) updateShootingInterval()
    })

    // Add wheel event handler
    const handleWheel = (event: WheelEvent) => {
      // Adjust zoom speed by changing this multiplier
      const zoomSpeed = 0.001
      cameraDistanceRef.current = THREE.MathUtils.clamp(
        cameraDistanceRef.current + event.deltaY * zoomSpeed,
        MIN_ZOOM,
        MAX_ZOOM
      )
    }

    window.addEventListener("wheel", handleWheel)

    const animate = () => {
      const gameState = useGameStore.getState()

      if (!gameState.isPaused && playerRef.current) {
        playerRef.current.handleMovement(keys)
        playerRef.current.update(platforms)

        // Update camera position
        const cameraDistance = cameraDistanceRef.current
        const cameraHeight = cameraDistance * 0.5
        const cameraTarget = new THREE.Vector3()
        cameraTarget.copy(playerRef.current.getPosition())
        cameraTarget.add(
          new THREE.Vector3(
            Math.sin(playerRef.current.mesh.rotation.y) * -cameraDistance,
            cameraHeight,
            Math.cos(playerRef.current.mesh.rotation.y) * -cameraDistance
          )
        )

        camera.position.lerp(cameraTarget, 0.1)
        camera.lookAt(playerRef.current.getPosition())

        // Update orbiting light position
        const time = Date.now() * 0.001 // Convert to seconds
        const radius = 2 // Distance variation
        const baseHeight = 5 // Base height above the cube
        orbitingLight.position.set(
          playerRef.current.getPosition().x + Math.cos(time * 0.5) * radius,
          playerRef.current.getPosition().y + baseHeight + Math.sin(time * 0.3), // Slight up/down movement
          playerRef.current.getPosition().z + Math.sin(time * 0.5) * radius
        )
        orbitingLight.target = playerRef.current.mesh // Make the light always point at the player

        // Update enemies
        enemyManager.update(playerRef.current.getPosition(), 0.016) // 0.016 is roughly 60fps delta

        // Update projectiles and check collisions
        for (let i = projectiles.length - 1; i >= 0; i--) {
          const projectile = projectiles[i]

          // Move projectile
          projectile.position.add(
            projectile.userData.direction
              .clone()
              .multiplyScalar(projectileSpeed)
          )

          // Check for boundary collisions
          if (
            Math.abs(projectile.position.x) > levelBounds ||
            Math.abs(projectile.position.z) > levelBounds
          ) {
            scene.remove(projectile)
            projectiles.splice(i, 1)
            continue
          }

          // Check enemy collisions
          if (enemyManager.handleProjectileCollision(projectile)) {
            scene.remove(projectile)
            projectiles.splice(i, 1)
          }
        }

        // Update powerups and health pickups with player position only
        powerUpManager.update(playerRef.current.getPosition())
        healthPickupManager.update(playerRef.current.getPosition())
      }

      // Always render the scene, even when paused
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    // Cleanup
    return () => {
      clearInterval(shootingInterval)
      unsubscribe()
      enemyManager.cleanup()
      powerUpManager.cleanup()
      healthPickupManager.cleanup()
      if (playerRef.current) {
        playerRef.current.cleanup(scene)
      }
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("wheel", handleWheel)
      mountRef.current?.removeChild(renderer.domElement)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      bulletAudio.pause()
      bulletAudio.src = ""
    }
  }, [])

  useEffect(() => {
    if (audioRef.current) {
      const gameState = useGameStore.getState()
      if (gameState.isPaused) {
        audioRef.current.pause()
      } else {
        audioRef.current.play().catch((error) => {
          console.log("Audio playback failed:", error)
        })
      }
    }
  }, [isPaused])

  const handlePauseClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Only process if it's a mouse click (not a keyboard or other event)
    if (e.type === "click") {
      const newPauseState = !isPaused
      setIsPaused(newPauseState)
      useGameStore.getState().setPaused(newPauseState)
    }
  }

  return (
    <>
      <div ref={mountRef} />
      <HUD
        onPauseClick={handlePauseClick}
        isPaused={isPaused}
        player={playerRef.current ?? undefined}
      />
    </>
  )
}

export default App
