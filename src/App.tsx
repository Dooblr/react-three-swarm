import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import "./App.scss"
import { EnemyManager } from "./EnemyManager"
import { PowerUpManager } from "./PowerUp.tsx"
import { useGameStore } from "./store/gameStore"
import musicLoop from "./assets/music_loop.wav"
import musicLoop2 from "./assets/music_loop_2.wav"
import { HealthPickupManager } from "./HealthPickup"
import { Player } from "./Player"
import bulletSound from "./assets/bullet.wav"
import HUD from "./components/HUD"
import { ProjectileManager } from "./Projectile"

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
  const [isAudioInitialized, setIsAudioInitialized] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)

  const playerState = {
    velocity: 0,
    jumpsAvailable: 2, // Start with 2 jumps
    isJumping: false,
  }

  const cameraDistanceRef = useRef(10) // Default camera distance
  const MIN_ZOOM = 5
  const MAX_ZOOM = 15

  const audioRef = useRef<ReturnType<typeof setupBackgroundMusic> | null>(null)

  const setupBackgroundMusic = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      const audioContext = new AudioContext()
      let audioBuffer1: AudioBuffer | null = null
      let audioBuffer2: AudioBuffer | null = null
      let source: AudioBufferSourceNode | null = null
      let gainNode: GainNode | null = null

      const loadAudioBuffers = async () => {
        try {
          const [response1, response2] = await Promise.all([
            fetch(musicLoop),
            fetch(musicLoop2)
          ])
          const [arrayBuffer1, arrayBuffer2] = await Promise.all([
            response1.arrayBuffer(),
            response2.arrayBuffer()
          ])
          audioBuffer1 = await audioContext.decodeAudioData(arrayBuffer1)
          audioBuffer2 = await audioContext.decodeAudioData(arrayBuffer2)
        } catch (error) {
          console.error("Error loading audio:", error)
        }
      }

      const playSound = () => {
        if (!audioBuffer1 || !audioBuffer2) return

        // Create gain node for volume control
        gainNode = audioContext.createGain()
        gainNode.gain.value = useGameStore.getState().audioLevels.music
        gainNode.connect(audioContext.destination)

        // Create and start the source
        source = audioContext.createBufferSource()
        source.buffer = Math.random() > 0.5 ? audioBuffer1 : audioBuffer2
        source.loop = true
        source.connect(gainNode)
        source.start(0)
      }

      return {
        init: async () => {
          await loadAudioBuffers()
          playSound()
          setIsAudioInitialized(true)
        },
        pause() {
          if (audioContext.state === 'running') {
            audioContext.suspend()
          }
        },
        play() {
          if (audioContext.state === 'suspended') {
            return audioContext.resume()
          }
          return Promise.resolve()
        },
        cleanup() {
          if (source) {
            source.stop()
            source.disconnect()
          }
          if (gainNode) {
            gainNode.disconnect()
          }
          audioContext.close()
        }
      }
    } catch (error) {
      console.error("Audio setup failed:", error)
      return null
    }
  }

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

    // Get speed boost state from store
    const hasSpeedBoost = useGameStore.getState().hasSpeedBoost

    // Create player with speed boost state
    const player = new Player(scene, hasSpeedBoost, useGameStore.getState().maxJumps)
    playerRef.current = player

    // Subscribe to store changes for maxJumps
    const unsubscribeMaxJumps = useGameStore.subscribe(
      (state) => {
        if (playerRef.current && state.maxJumps) {
          playerRef.current.resetJumps(state.maxJumps)
        }
      }
    )

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
    enemyManager = new EnemyManager(scene, player)

    // Initialize powerUpManager
    powerUpManager = new PowerUpManager(scene, 50)

    // Initialize healthPickupManager
    healthPickupManager = new HealthPickupManager(scene, 50)

    // Add projectile-related variables
    const levelBounds = 50

    // Add bullet sound setup
    const bulletAudio = new Audio()
    bulletAudio.src = bulletSound // Use the imported asset
    bulletAudio.volume = 0.2

    // Add these constants near the top of the useEffect
    const POWER_SHOT_THRESHOLD = 2.5  // Fire rate threshold for powered shots
    const POWER_SHOT_SPEED_REDUCER = 0.5 // Reduces fire rate for power shots

    // Shooting system
    const projectileManager = new ProjectileManager(scene, levelBounds)

    const createProjectile = () => {
      if (playerRef.current) {
        const isPoweredShot = useGameStore.getState().fireRate >= POWER_SHOT_THRESHOLD
        projectileManager.createProjectile(
          playerRef.current.getPosition(),
          playerRef.current.mesh.rotation.y,
          isPoweredShot
        )
      }
    }

    // Auto-shooting interval
    let shootingInterval: ReturnType<typeof setInterval>
    const updateShootingInterval = () => {
      if (shootingInterval) clearInterval(shootingInterval)
      const fireRate = useGameStore.getState().fireRate
      const isPoweredShot = fireRate >= POWER_SHOT_THRESHOLD
      const actualFireRate = isPoweredShot ? fireRate * POWER_SHOT_SPEED_REDUCER : fireRate
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

        // Update projectiles
        projectileManager.update(enemyManager)

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
      projectileManager.cleanup()
      unsubscribeMaxJumps()
    }
  }, [])

  useEffect(() => {
    if (audioRef.current && isAudioInitialized) {
      const gameState = useGameStore.getState()
      if (gameState.isPaused) {
        audioRef.current.pause()
      } else {
        audioRef.current.play().catch((error) => {
          console.log("Audio playback failed:", error)
        })
      }
    }
  }, [isPaused, isAudioInitialized])

  const handlePauseClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Only process if it's a mouse click (not a keyboard or other event)
    if (e.type === "click") {
      const newPauseState = !isPaused
      setIsPaused(newPauseState)
      useGameStore.getState().setPaused(newPauseState)
    }
  }

  // Add event listener for first interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!isAudioInitialized && audioRef.current) {
        audioRef.current.init().catch(console.error)
        // Remove the event listeners after first interaction
        window.removeEventListener('click', handleFirstInteraction)
        window.removeEventListener('keydown', handleFirstInteraction)
      }
    }

    window.addEventListener('click', handleFirstInteraction)
    window.addEventListener('keydown', handleFirstInteraction)

    return () => {
      window.removeEventListener('click', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
  }, [isAudioInitialized])

  return (
    <>
      <div ref={mountRef} />
      <HUD
        onPauseClick={handlePauseClick}
        isPaused={isPaused}
        player={playerRef.current ?? undefined}
      />

      {/* Start screen overlay */}
      {!gameStarted && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 10
        }}>
          <button 
            onClick={() => setGameStarted(true)}
            style={{
              padding: '20px 40px',
              fontSize: '24px',
              cursor: 'pointer'
            }}
          >
            Play Game
          </button>
        </div>
      )}
    </>
  )
}

export default App
