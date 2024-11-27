import { useGameStore } from '../store/gameStore'
import { useEffect, useRef, useState } from 'react'
import './HUD.scss'
import { Player } from '../Player'
import { STORE_PRICES } from '../store/gameStore'

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
  const hasHomingShots = useGameStore(state => state.hasHomingShots)
  const homingEnabled = useGameStore(state => state.homingEnabled)
  const toggleHoming = useGameStore(state => state.toggleHoming)

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

      {hasHomingShots && (
        <button 
          className={`homing-toggle ${homingEnabled ? 'active' : ''}`}
          onClick={toggleHoming}
          title="Toggle Homing Shots"
        >
          <svg viewBox="0 0 24 24" width="24" height="24">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
            <line x1="12" y1="3" x2="12" y2="7" stroke="currentColor" strokeWidth="2"/>
            <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2"/>
            <line x1="3" y1="12" x2="7" y2="12" stroke="currentColor" strokeWidth="2"/>
            <line x1="17" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
      )}

      {showStore && (
        <div className="store-modal">
          <h2>Store</h2>
          <div className="store-item">
            <span>Health Boost (+10)</span>
            <button 
              onClick={purchaseHealth}
              disabled={credits < STORE_PRICES.HEALTH_BOOST}
            >
              {STORE_PRICES.HEALTH_BOOST} Credits
            </button>
          </div>
          <div className="store-item">
            <span>Attack Speed Boost (+20%)</span>
            <button 
              onClick={purchaseAttackSpeed}
              disabled={credits < STORE_PRICES.ATTACK_SPEED}
            >
              {STORE_PRICES.ATTACK_SPEED} Credits
            </button>
          </div>
          <div className={`store-item ${useGameStore.getState().maxJumps >= 3 ? 'purchased' : ''}`}>
            <span>Triple Jump</span>
            <button 
              onClick={useGameStore.getState().purchaseTripleJump}
              disabled={credits < STORE_PRICES.TRIPLE_JUMP || useGameStore.getState().maxJumps >= 3}
              className={useGameStore.getState().maxJumps >= 3 ? 'purchased' : ''}
            >
              {useGameStore.getState().maxJumps >= 3 ? 'Purchased' : 
                `${STORE_PRICES.TRIPLE_JUMP} Credits`}
            </button>
          </div>
          <div className={`store-item ${useGameStore.getState().hasHomingShots ? 'purchased' : ''}`}>
            <span>Homing Projectiles</span>
            <button 
              onClick={useGameStore.getState().purchaseHomingShots}
              disabled={credits < STORE_PRICES.HOMING_SHOTS || useGameStore.getState().hasHomingShots}
              className={useGameStore.getState().hasHomingShots ? 'purchased' : ''}
            >
              {useGameStore.getState().hasHomingShots ? 'Purchased' : 
                `${STORE_PRICES.HOMING_SHOTS} Credits`}
            </button>
          </div>
          <div className={`store-item ${useGameStore.getState().hasSpeedBoost ? 'purchased' : ''}`}>
            <span>Speed Boost (+50% Speed)</span>
            <button 
              onClick={useGameStore.getState().purchaseSpeedBoost}
              disabled={credits < STORE_PRICES.SPEED_BOOST || useGameStore.getState().hasSpeedBoost}
              className={useGameStore.getState().hasSpeedBoost ? 'purchased' : ''}
            >
              {useGameStore.getState().hasSpeedBoost ? 'Purchased' : 
                `${STORE_PRICES.SPEED_BOOST} Credits`}
            </button>
          </div>
          <button className="close-store-button" onClick={handleCloseStore}>Close Store</button>
        </div>
      )}
    </>
  )
}

export default HUD 