import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Scene } from './components/Scene'
import { Player } from './components/Player'
import './App.scss'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas shadows>
        <Scene />
        <Player />
      </Canvas>
    </div>
  )
}

export default App
