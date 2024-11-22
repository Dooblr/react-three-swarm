import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import "./App.scss"
import { EnemyManager } from "./Enemy"
import { PowerUpManager } from "./PowerUp.tsx"
import { useGameStore } from "./store/gameStore"
import musicLoop from './assets/music_loop.wav'
import { HealthPickupManager } from "./HealthPickup"
import { Player } from "./Player"
import bulletSound from './assets/bullet.wav'

const setupBackgroundMusic = () => {
  // Create audio context
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContext();
  
  // Create a buffer source for looping
  const createBufferSource = async () => {
    const response = await fetch(musicLoop);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = true;
    
    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.value = useGameStore.getState().audioLevels.music;
    
    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    return source;
  };

  // Initialize and start playback
  let source: AudioBufferSourceNode | null = null;
  createBufferSource().then(newSource => {
    source = newSource;
    source.start(0);
  });

  // Return an object with controls
  return {
    pause() {
      audioContext.suspend();
    },
    async play() {
      return audioContext.resume();
    },
    cleanup() {
      if (source) {
        source.stop();
        source.disconnect();
      }
      audioContext.close();
    }
  };
};

const App = () => {
  const mountRef = useRef<HTMLDivElement>(null)
  let enemyManager: EnemyManager;
  let powerUpManager: PowerUpManager;
  let healthPickupManager: HealthPickupManager;
  let player: Player;
  
  // Subscribe to both score and health from Zustand
  const score = useGameStore(state => state.score);
  const health = useGameStore(state => state.health);
  const [isPaused, setIsPaused] = useState(false);

  const playerState = {
    velocity: 0,
    jumpsAvailable: 2,  // Start with 2 jumps
    isJumping: false
  }

  const cameraDistanceRef = useRef(10); // Default camera distance
  const MIN_ZOOM = 5;
  const MAX_ZOOM = 15;

  const audioRef = useRef<ReturnType<typeof setupBackgroundMusic> | null>(null);

  const getHealthBarClass = (health: number) => {
    let classes = ['health-fill']
    if (health <= 20) {
      classes.push('danger')
    } else if (health <= 50) {
      classes.push('warning')
    }
    return classes.join(' ')
  }

  // Add ref for tracking last damage time
  const lastDamageTime = useRef(0)
  const DAMAGE_FLASH_DURATION = 300 // milliseconds

  // Subscribe to health changes
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe(
      (state) => state.health,
      (health, prevHealth) => {
        if (health < prevHealth) {
          // Health decreased, trigger damage effects
          lastDamageTime.current = Date.now()
          player?.takeDamage() // Flash the player red
                    
          // Add and remove flash class from health bar
          const healthFill = document.querySelector('.health-fill')
          if (healthFill) {
            healthFill.classList.add('damage-flash')
            setTimeout(() => {
              healthFill.classList.remove('damage-flash')
            }, DAMAGE_FLASH_DURATION)
          }
        }
      }
    )
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    audioRef.current = setupBackgroundMusic();

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
      topColor: { value: new THREE.Color(0x72B7ED) },    // Light blue
      bottomColor: { value: new THREE.Color(0x0046B8) }  // Darker blue
    }

    const skyGeo = new THREE.SphereGeometry(500, 32, 15)
    const skyMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      side: THREE.BackSide
    })
    const sky = new THREE.Mesh(skyGeo, skyMat)
    scene.add(sky)

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
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
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')!
    
    // Fill base color
    context.fillStyle = '#2d5e1e' // Dark grass green
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
      metalness: 0.2
    })
    const plane = new THREE.Mesh(planeGeometry, planeMaterial)
    plane.rotation.x = -Math.PI / 2
    plane.receiveShadow = true
    scene.add(plane)

    // Create random platforms
    const createPlatforms = () => {
        const platforms: THREE.Mesh[] = [];
        const numPlatforms = 20; // Adjust number of platforms
        
        const boxGeometry = new THREE.BoxGeometry(3, 2, 3);
        const boxMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
            roughness: 0.7,
            metalness: 0.3
        });

        for (let i = 0; i < numPlatforms; i++) {
            const platform = new THREE.Mesh(boxGeometry, boxMaterial);
            
            // Random position within bounds
            platform.position.x = (Math.random() - 0.5) * 90; // Keep away from edges
            platform.position.z = (Math.random() - 0.5) * 90;
            platform.position.y = 1; // Height of platform
            
            // Random rotation for variety
            platform.rotation.y = Math.random() * Math.PI * 2;
            
            platform.castShadow = true;
            platform.receiveShadow = true;
            
            scene.add(platform);
            platforms.push(platform);
        }
        
        return platforms;
    };

    const platforms = createPlatforms();

    // Initialize player first
    player = new Player(scene)

    // Initialize enemy manager with player reference
    enemyManager = new EnemyManager(scene, 50, platforms, player)

    // Add perimeter walls
    const wallGeometry = new THREE.BoxGeometry(1, 3, 100) // Height of 3, length of 100
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.7,
      metalness: 0.3
    })

    // Create four walls
    const walls = [
      { position: [50, 1.5, 0], rotation: [0, 0, 0] },      // Right wall
      { position: [-50, 1.5, 0], rotation: [0, 0, 0] },     // Left wall
      { position: [0, 1.5, 50], rotation: [0, Math.PI / 2, 0] },  // Front wall
      { position: [0, 1.5, -50], rotation: [0, Math.PI / 2, 0] }  // Back wall
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
      q: false,  // Added for left strafe
      e: false,  // Added for right strafe
      arrowup: false,
      arrowdown: false,
      arrowleft: false,
      arrowright: false
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      
      if (key === 'escape') {
        setIsPaused(prev => {
          const newPauseState = !prev;
          useGameStore.getState().setPaused(newPauseState);
          return newPauseState;
        });
        return;
      }

      if (!useGameStore.getState().isPaused) {
        if (key === ' ') {
          player.jump();
          return;
        }

        if (key in keys) {
          keys[key as keyof typeof keys] = true;
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      
      // Handle spacebar release
      if (key === ' ') {
        playerState.isJumping = false;
        return;
      }

      // Handle other keys
      if (key in keys) {
        keys[key as keyof typeof keys] = false;
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Initialize powerUpManager
    powerUpManager = new PowerUpManager(scene, 50);

    // Initialize healthPickupManager
    healthPickupManager = new HealthPickupManager(scene, 50);

    // Add projectile-related variables
    const projectiles: THREE.Mesh[] = [];
    const projectileSpeed = 0.5;
    const levelBounds = 50;

    // Add bullet sound setup
    const bulletAudio = new Audio(bulletSound)
    bulletAudio.volume = useGameStore.getState().audioLevels.bullet

    // Shooting system
    const createProjectile = () => {
      if (!useGameStore.getState().isPaused) {
        // Play bullet sound
        bulletAudio.currentTime = 0
        bulletAudio.play().catch(error => {
          console.log("Audio play failed:", error)
        })

        const projectileGeometry = new THREE.SphereGeometry(0.2)
        const projectileMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 })
        const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial)
        
        // Set position to player position
        projectile.position.copy(player.getPosition())
        projectile.position.y = 0.5 // Match player height
        
        // Calculate direction based on player rotation
        const direction = new THREE.Vector3(
          Math.sin(player.mesh.rotation.y),
          0,
          Math.cos(player.mesh.rotation.y)
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
    const unsubscribe = useGameStore.subscribe(
      state => {
        if (state.fireRate) updateShootingInterval()
      }
    )

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

    window.addEventListener('wheel', handleWheel)

    const animate = () => {
      const gameState = useGameStore.getState()
      
      if (!gameState.isPaused) {
        player.handleMovement(keys)
        player.update(platforms)

        // Update camera position
        const cameraDistance = cameraDistanceRef.current
        const cameraHeight = cameraDistance * 0.5
        const cameraTarget = new THREE.Vector3()
        cameraTarget.copy(player.getPosition())
        cameraTarget.add(new THREE.Vector3(
          Math.sin(player.mesh.rotation.y) * -cameraDistance,
          cameraHeight,
          Math.cos(player.mesh.rotation.y) * -cameraDistance
        ))
        
        camera.position.lerp(cameraTarget, 0.1)
        camera.lookAt(player.getPosition())

        // Update orbiting light position
        const time = Date.now() * 0.001  // Convert to seconds
        const radius = 2  // Distance variation
        const baseHeight = 5  // Base height above the cube
        orbitingLight.position.set(
          player.getPosition().x + Math.cos(time * 0.5) * radius,
          player.getPosition().y + baseHeight + Math.sin(time * 0.3),  // Slight up/down movement
          player.getPosition().z + Math.sin(time * 0.5) * radius
        )
        orbitingLight.target = player.mesh  // Make the light always point at the player

        // Update enemies
        enemyManager.update(player.getPosition(), 0.016) // 0.016 is roughly 60fps delta

        // Update projectiles and check collisions
        for (let i = projectiles.length - 1; i >= 0; i--) {
          const projectile = projectiles[i]
          
          // Move projectile
          projectile.position.add(
            projectile.userData.direction.clone().multiplyScalar(projectileSpeed)
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

        // Add powerUpManager update after enemy update
        powerUpManager.update(player.getPosition(), 0.016)

        // Add health pickup update after powerup update
        healthPickupManager.update(player.getPosition(), 0.016)
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
      player.cleanup(scene)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('wheel', handleWheel)
      mountRef.current?.removeChild(renderer.domElement)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      bulletAudio.pause()
      bulletAudio.src = ''
    }
  }, [])

  useEffect(() => {
    if (audioRef.current) {
      const gameState = useGameStore.getState()
      if (gameState.isPaused) {
        audioRef.current.pause()
      } else {
        audioRef.current.play().catch(error => {
          console.log("Audio playback failed:", error)
        })
      }
    }
  }, [isPaused])

  const handlePauseClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Only process if it's a mouse click (not a keyboard or other event)
    if (e.type === 'click') {
      const newPauseState = !isPaused
      setIsPaused(newPauseState)
      useGameStore.getState().setPaused(newPauseState)
    }
  }

  return (
    <>
      <div ref={mountRef} />
      <div className="health-bar">
        <div 
          className={getHealthBarClass(health)}
          style={{ width: `${health}%` }}
        />
        <div className="health-text">{health}</div>
      </div>
      <div className="hud">
        <div className="score">Score: {score}</div>
        <button 
          className="pause-button" 
          onClick={handlePauseClick}
          onKeyDown={(e) => e.preventDefault()}
          onKeyUp={(e) => e.preventDefault()}
          onKeyPress={(e) => e.preventDefault()}
          tabIndex={-1}
          aria-hidden="true"
        >
          {isPaused ? "Resume" : "Pause"}
        </button>
      </div>
    </>
  )
}

export default App
