import { FC, useRef } from 'react'
import { SpaceEnvironment } from './SpaceEnvironment'
import { ProjectileManager } from './ProjectileManager'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PsychedelicShader } from '../shaders/PsychedelicShader'
import { Player } from './Player'

export const Scene: FC = () => {
  const floorRef = useRef<THREE.ShaderMaterial>(null)

  useFrame(({ clock }) => {
    if (floorRef.current) {
      floorRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <>
      <SpaceEnvironment />
      <ProjectileManager />
      <Player />
      
      {/* Psychedelic ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50, 32, 32]} />
        <shaderMaterial
          ref={floorRef}
          vertexShader={PsychedelicShader.vertexShader}
          fragmentShader={PsychedelicShader.fragmentShader}
          uniforms={{
            uTime: { value: 0 },
          }}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  )
} 