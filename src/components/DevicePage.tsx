import { useState, useEffect, useCallback, useRef } from 'react'
import { Smartphone, RefreshCw, Check, Usb, Wifi, Monitor, AlertCircle } from 'lucide-react'
import type { DeviceInfo } from '../types'

interface Props {
  selectedDevice?: string
  onSelectDevice: (serial: string | undefined) => void
}

export default function DevicePage({ selectedDevice, onSelectDevice }: Props) {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const mountedRef = useRef(true)

  const fetchDevices = useCallback(async () => {
    try {
      setError('')
      if (window.electronAPI) {
        const res = await window.electronAPI.backendRequest('/api/devices')
        if (Array.isArray(res)) {
          setDevices(res as DeviceInfo[])
        }
      }
    } catch (err: any) {
      setError(err?.message || '无法获取设备列表')
      setDevices([])
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    await fetchDevices()
    if (mountedRef.current) setLoading(false)
  }, [fetchDevices])

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [load])

  const handleScan = async () => {
    setScanning(true)
    await fetchDevices()
    setTimeout(() => {
      if (mountedRef.current) setScanning(false)
    }, 800)
  }

  const connectedDevices = devices.filter(d => d.state === 'device')
  const otherDevices = devices.filter(d => d.state !== 'device')

  return (
    <div className="device-page">
      {/* Header */}
      <div className="device-header">
        <div className="device-header-icon">
          <Smartphone size={32} />
        </div>
        <h2>设备管理</h2>
        <p className="device-header-desc">
          通过 ADB 连接您的手机以查看好友圈动态
        </p>
        <button
          className="device-scan-btn"
          onClick={handleScan}
          disabled={scanning}
        >
          <RefreshCw
            size={16}
            style={{ animation: scanning ? 'mi-spin 0.8s linear infinite' : 'none' }}
          />
          <span>{scanning ? '扫描中...' : '扫描设备'}</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="device-alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="device-loading">
          <div className="mi-spinner" />
          <p>正在检测设备...</p>
        </div>
      )}

      {/* Connected Devices */}
      {!loading && connectedDevices.length > 0 && (
        <div className="device-section">
          <div className="device-section-title">
            已连接的设备 ({connectedDevices.length})
          </div>
          {connectedDevices.map(d => (
            <div
              key={d.serial}
              className={`device-item ${selectedDevice === d.serial ? 'active' : ''}`}
              onClick={() => onSelectDevice(selectedDevice === d.serial ? undefined : d.serial)}
            >
              <div className="device-item-icon connected">
                <Smartphone size={20} />
              </div>
              <div className="device-item-info">
                <div className="device-item-name">{d.serial}</div>
                <div className="device-item-status">
                  <span className="device-status-dot connected" />
                  已连接
                  {selectedDevice === d.serial && (
                    <span className="device-status-active"> · 使用中</span>
                  )}
                </div>
              </div>
              <div className="device-item-check">
                {selectedDevice === d.serial && <Check size={18} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Other/Unauthorized Devices */}
      {!loading && otherDevices.length > 0 && (
        <div className="device-section">
          <div className="device-section-title">
            其他设备 ({otherDevices.length})
          </div>
          {otherDevices.map(d => (
            <div key={d.serial} className="device-item">
              <div className="device-item-icon unauthorized">
                <Smartphone size={20} />
              </div>
              <div className="device-item-info">
                <div className="device-item-name">{d.serial}</div>
                <div className="device-item-status">
                  <span className="device-status-dot unauthorized" />
                  {d.state === 'unauthorized' ? '未授权' : d.state}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Devices */}
      {!loading && !error && devices.length === 0 && (
        <div className="device-empty">
          <Monitor size={48} />
          <h3>未检测到设备</h3>
          <p>请确保您的手机已通过 ADB 连接到电脑</p>
          <div className="device-help">
            <div className="device-help-item">
              <Usb size={16} />
              <div>
                <strong>USB 连接</strong>
                <p>使用 USB 数据线连接手机，开启 USB 调试</p>
              </div>
            </div>
            <div className="device-help-item">
              <Wifi size={16} />
              <div>
                <strong>无线连接</strong>
                <p>ADB 配对后通过局域网连接：adb connect 手机IP:5555</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
