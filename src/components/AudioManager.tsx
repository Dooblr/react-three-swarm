import { FC, useEffect, useState, useCallback } from 'react'
import { useGameAudio } from '../hooks/useGameAudio'
import { useGameState } from '../store/gameState'

export const AudioManager: FC = () => {
  const [isInitialized, setIsInitialized] = useState(false)
  const { playBackgroundMusic } = useGameAudio()
  const { masterVolume, isMuted, setMasterVolume, toggleMute } = useGameState()

  const startAudio = useCallback(() => {
    const audioContext = new AudioContext()
    playBackgroundMusic()
    setIsInitialized(true)
  }, [playBackgroundMusic])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setMasterVolume(newVolume)
  }, [setMasterVolume])

  const handleMuteClick = useCallback(() => {
    toggleMute()
  }, [toggleMute])

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '20px', 
      right: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '10px',
      background: 'rgba(0,0,0,0.5)',
      borderRadius: '8px',
      zIndex: 1000 
    }}>
      {!isInitialized && (
        <button onClick={startAudio}>
          Start Music
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button 
          onClick={handleMuteClick}
          style={{ minWidth: '30px' }}
        >
          {isMuted ? '🔇' : masterVolume > 0.5 ? '🔊' : masterVolume > 0 ? '🔉' : '🔈'}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={isMuted ? 0 : masterVolume}
          onChange={handleVolumeChange}
          style={{ width: '100px' }}
        />
        <span style={{ 
          color: 'white', 
          minWidth: '40px',
          userSelect: 'none'
        }}>
          {Math.round((isMuted ? 0 : masterVolume) * 100)}%
        </span>
      </div>
    </div>
  )
} 