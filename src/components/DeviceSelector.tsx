import { useState, useEffect } from 'react'
import { Smartphone, ChevronDown } from 'lucide-react'
import type { DeviceInfo } from '../types'

interface Props {
  selected?: string
  onSelect: (serial: string | undefined) => void
}

export default function DeviceSelector({ selected, onSelect }: Props) {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        if (window.electronAPI) {
          const res = await window.electronAPI.backendRequest('/api/devices')
          if (Array.isArray(res)) setDevices(res as DeviceInfo[])
        }
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  if (devices.length <= 1) return null

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="mi-nav-btn"
        onClick={() => setOpen(!open)}
        title="切换设备"
      >
        <Smartphone />
      </button>
      {open && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 200,
            }}
            onClick={() => setOpen(false)}
          />
          <div
            className="miui-card"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              minWidth: 200,
              zIndex: 201,
              overflow: 'hidden',
              padding: 4,
            }}
          >
            {devices.map((d) => (
              <button
                key={d.serial}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  background: selected === d.serial ? 'rgba(255,105,0,0.08)' : 'transparent',
                  color: selected === d.serial ? 'var(--mi-orange)' : 'var(--mi-text-primary)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  textAlign: 'left',
                }}
                onClick={() => {
                  onSelect(selected === d.serial ? undefined : d.serial)
                  setOpen(false)
                }}
              >
                <Smartphone size={16} />
                <span style={{ flex: 1 }}>{d.serial}</span>
                {d.state === 'device' && (
                  <span style={{ fontSize: 11, color: 'var(--mi-green)' }}>已连接</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
