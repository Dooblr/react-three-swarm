import { useGameStore } from '../store/gameStore'
import { useEffect, useRef, useState } from 'react'
import './HUD.scss'
import { Player } from '../Player'

interface HUDProps {
  onPauseClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  isPaused: boolean
  player?: Player
}

const HUD = ({ onPauseClick, isPaused, player }: HUDProps) => {
  const [showStore, setShowStore] = useState(false)
  const credits = useGameStore(state => state.credits)
  const health = useGameStore(state => state.health)
  const purchaseHealth = useGameStore(state => state.purchaseHealth)
  const purchaseAttackSpeed = useGameStore(state => state.purchaseAttackSpeed)
  const healthBarRef = useRef<HTMLDivElement>(null)
  const healthFillRef = useRef<HTMLDivElement>(null)
  const lastHealthRef = useRef(health)
  const DAMAGE_FLASH_DURATION = 300

  useEffect(() => {
    // Check if health decreased
    if (health < lastHealthRef.current) {
      const healthBar = healthBarRef.current
      const healthFill = healthFillRef.current
      
      if (healthFill && healthBar) {
        healthFill.classList.add('damage-flash')
        healthBar.classList.add('shake')
        
        setTimeout(() => {
          healthFill.classList.remove('damage-flash')
          healthBar.classList.remove('shake')
        }, DAMAGE_FLASH_DURATION)
      }

      // Trigger player damage effect if player exists
      player?.takeDamage()
    }
    lastHealthRef.current = health
  }, [health, player])

  const getHealthBarClass = (health: number) => {
    let classes = ['health-fill']
    if (health <= 20) {
      classes.push('danger')
    } else if (health <= 50) {
      classes.push('warning')
    }
    return classes.join(' ')
  }

  const handleStoreClick = () => {
    setShowStore(true)
    useGameStore.getState().setPaused(true)
  }

  const handleCloseStore = () => {
    setShowStore(false)
    useGameStore.getState().setPaused(false)
  }

  return (
    <>
      <div className="health-bar" ref={healthBarRef}>
        <div 
          ref={healthFillRef}
          className={getHealthBarClass(health)}
          style={{ width: `${health}%` }}
        />
        <div className="health-text">{health}</div>
      </div>
      <div className="hud">
        <div className="score">Credits: {credits}</div>
        <button 
          className="pause-button" 
          onClick={onPauseClick}
          onKeyDown={(e) => e.preventDefault()}
          onKeyUp={(e) => e.preventDefault()}
          onKeyPress={(e) => e.preventDefault()}
          tabIndex={-1}
          aria-hidden="true"
        >
          {isPaused ? "Resume" : "Pause"}
        </button>
        <button className="store-button" onClick={handleStoreClick}>Store</button>
      </div>

      {showStore && (
        <div className="store-modal">
          <h2>Store</h2>
          <div className="store-item">
            <span>Health Boost (+10)</span>
            <button 
              onClick={purchaseHealth}
              disabled={credits < 10}
            >
              10 Credits
            </button>
          </div>
          <div className="store-item">
            <span>Attack Speed Boost (+20%)</span>
            <button 
              onClick={purchaseAttackSpeed}
              disabled={credits < 20}
            >
              20 Credits
            </button>
          </div>
          <div className="store-item">
            <span>Triple Jump</span>
            <button 
              onClick={useGameStore.getState().purchaseTripleJump}
              disabled={credits < 30 || useGameStore.getState().maxJumps >= 3}
            >
              30 Credits
            </button>
          </div>
          <button onClick={handleCloseStore}>Close</button>
        </div>
      )}
    </>
  )
}

export default HUD 