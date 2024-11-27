import { useState, useEffect } from 'react'

export const useKeyboard = () => {
  const [keys, setKeys] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    strafeLeft: false,
    strafeRight: false,
    jump: false,
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w': setKeys(keys => ({ ...keys, forward: true })); break
        case 's': setKeys(keys => ({ ...keys, backward: true })); break
        case 'a': setKeys(keys => ({ ...keys, left: true })); break
        case 'd': setKeys(keys => ({ ...keys, right: true })); break
        case 'q': setKeys(keys => ({ ...keys, strafeLeft: true })); break
        case 'e': setKeys(keys => ({ ...keys, strafeRight: true })); break
        case ' ': setKeys(keys => ({ ...keys, jump: true })); break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w': setKeys(keys => ({ ...keys, forward: false })); break
        case 's': setKeys(keys => ({ ...keys, backward: false })); break
        case 'a': setKeys(keys => ({ ...keys, left: false })); break
        case 'd': setKeys(keys => ({ ...keys, right: false })); break
        case 'q': setKeys(keys => ({ ...keys, strafeLeft: false })); break
        case 'e': setKeys(keys => ({ ...keys, strafeRight: false })); break
        case ' ': setKeys(keys => ({ ...keys, jump: false })); break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return keys
} 