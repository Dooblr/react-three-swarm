import { Canvas } from '@react-three/fiber'
import { Scene } from './components/Scene'
import { AudioManager } from './components/AudioManager'
import './App.scss'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <AudioManager />
      <Canvas shadows>
        <Scene />
      </Canvas>
    </div>
  )
}

export default App
