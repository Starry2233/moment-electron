import { useEffect, useState } from 'react'
import { Wifi, BatteryFull, Signal } from 'lucide-react'

export default function StatusBar() {
  const [time, setTime] = useState('')

  useEffect(() => {
    function update() {
      const now = new Date()
      setTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="mi-status-bar">
      <span className="time">{time}</span>
      <div className="mi-status-icons">
        <Signal />
        <Wifi />
        <BatteryFull />
      </div>
    </div>
  )
}
