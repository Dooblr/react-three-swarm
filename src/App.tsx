import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Scene } from './components/Scene'
import { Player } from './components/Player'
import { AudioManager } from './components/AudioManager'
import './App.scss'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <AudioManager />
      <Canvas shadows camera={{ position: [0, 5, 10], fov: 75 }}>
        <Scene />
        <Player />
        <OrbitControls />
      </Canvas>
    </div>
  )
}

export default App
