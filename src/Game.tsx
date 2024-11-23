class Game {
  private initializeUI() {
    // ... existing score display code ...
    
    const healthBar = document.createElement('div')
    healthBar.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.5);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      font-size: 24px;
    `
    healthBar.id = 'health-display'
    document.body.appendChild(healthBar)
    this.updateHealth(100) // Initial health value
  }

  private updateHealth(health: number) {
    const healthDisplay = document.getElementById('health-display')
    if (healthDisplay) {
      healthDisplay.textContent = `Health: ${health}`
    }
  }
} 