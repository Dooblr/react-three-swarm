import { useGameStore } from "./store/gameStore"

export class Game {
  private hud: {
    updateScore: (score: number) => void
    updateHealth: (health: number) => void
    updatePauseButtonText: (isPaused: boolean) => void
    cleanup: () => void
    setPauseButtonCallback: (callback: () => void) => void
  }
  private score: number = 0
  private health: number = 100

  constructor() {
    // ... existing initialization code ...

    // Initialize HUD as an object with the required methods
    this.hud = {
      updateScore: () => {},
      updateHealth: () => {},
      updatePauseButtonText: () => {},
      cleanup: () => {},
      setPauseButtonCallback: () => {},
    }

    // Subscribe to health changes
    useGameStore.subscribe((state: any) => {
      this.hud.updateHealth(state.health)
    })
  }

  // private togglePause(): void {
  //   this.isPaused = !this.isPaused
  //   this.hud.updatePauseButtonText(this.isPaused)
  //   // ... rest of pause logic ...
  // }

  // Update these methods to use HUD
  public updateScore(newScore: number): void {
    this.score = newScore
    this.hud.updateScore(this.score)
  }

  public updateHealth(newHealth: number): void {
    this.health = newHealth
    this.hud.updateHealth(this.health)
  }

  public cleanup(): void {
    // ... existing cleanup code ...
    this.hud.cleanup()
  }
}
