import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Smartphone, AlertCircle, Clock, Image, Settings, Plus } from 'lucide-react'
import StatusBar from './components/StatusBar'
import DeviceSelector from './components/DeviceSelector'
import DevicePage from './components/DevicePage'
import MomentCard from './components/MomentCard'
import SettingsPage from './components/SettingsPage'
import PostDialog from './components/PostDialog'
import { api } from './api'
import type { MomentData, ConfigInfo } from './types'

type AppState = 'loading' | 'ready' | 'error' | 'no-device'
type Tab = 'moments' | 'device' | 'settings'

export default function App() {
  const [state, setState] = useState<AppState>('loading')
  const [moments, setMoments] = useState<MomentData[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [deviceId, setDeviceId] = useState<string | undefined>()
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('moments')
  const [config, setConfig] = useState<ConfigInfo | null>(null)
  const [showPost, setShowPost] = useState(false)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await api.getConfig()
      setConfig(cfg)
    } catch {
      // backend might not be ready yet
    }
  }, [])

  const fetchMoments = useCallback(async (showLoading = true) => {
    if (showLoading) setState('loading')
    loadConfig()
    try {
      const res = await api.getMoments({ device_id: deviceId, limit: 100 })
      setMoments(res.moments)
      setLastUpdate(new Date())
      setState('ready')
    } catch (err: any) {
      const msg = err?.message || '无法连接到手机，请确保 ADB 已连接'
      if (msg.includes('No connected')) {
        setState('no-device')
      } else {
        setErrorMsg(msg)
        setState('error')
      }
    }
  }, [deviceId, loadConfig])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await api.refreshMoments(deviceId)
      showToast('好友圈已刷新')
      // Wait a moment for the device to refresh, then fetch
      setTimeout(() => {
        fetchMoments(false)
        setRefreshing(false)
      }, 2000)
    } catch (err: any) {
      setRefreshing(false)
      showToast('刷新失败: ' + (err?.message || '未知错误'))
    }
  }, [deviceId, fetchMoments, showToast])

  // Initial load
  useEffect(() => {
    fetchMoments()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when deviceId changes (user selects a device)
  useEffect(() => {
    if (deviceId) {
      fetchMoments()
    }
  }, [deviceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto refresh every 60 seconds
  useEffect(() => {
    if (state !== 'ready') return
    const id = setInterval(() => fetchMoments(false), 60000)
    return () => clearInterval(id)
  }, [state, fetchMoments])

  const formatLastUpdate = () => {
    if (!lastUpdate) return ''
    const h = String(lastUpdate.getHours()).padStart(2, '0')
    const m = String(lastUpdate.getMinutes()).padStart(2, '0')
    const s = String(lastUpdate.getSeconds()).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const handleSelectDevice = (serial: string | undefined) => {
    setDeviceId(serial)
    if (serial && activeTab === 'settings') {
      setActiveTab('moments')
    }
  }

  const isFullMode = config?.mode === 'full' && config?.full_configured

  return (
    <div className="app-container">
      {/* MIUI Status Bar */}
      <StatusBar />

      {/* Navigation */}
      <nav className="mi-nav">
        <h1 className="mi-nav-title">
          {activeTab === 'device' ? '设备' :
           activeTab === 'settings' ? '设置' : '好友圈'}
        </h1>
        <div className="mi-nav-actions">
          {activeTab === 'moments' && (
            <>
              <DeviceSelector selected={deviceId} onSelect={setDeviceId} />
              <button
                className="mi-nav-btn"
                onClick={handleRefresh}
                disabled={refreshing}
                title="刷新"
              >
                <RefreshCw
                  style={{ animation: refreshing ? 'mi-spin 0.8s linear infinite' : 'none' }}
                />
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Device Status (only in moments tab) */}
      {activeTab === 'moments' && (
        <div className="mi-device-bar">
          <span className={`mi-device-dot ${state === 'error' || state === 'no-device' ? 'disconnected' : ''}`} />
          <span>
            {state === 'no-device' ? '未检测到设备' :
             state === 'error' ? '连接失败' :
             state === 'loading' ? '加载中...' :
             `已连接${lastUpdate ? ` · 更新 ${formatLastUpdate()}` : ''}`}
          </span>
        </div>
      )}

      {/* Content */}
      <main className="mi-content">
        {activeTab === 'settings' && (
          <SettingsPage
            selectedDevice={deviceId}
            onDeviceSelect={handleSelectDevice}
          />
        )}

        {activeTab === 'device' && (
          <DevicePage
            selectedDevice={deviceId}
            onSelectDevice={handleSelectDevice}
          />
        )}

        {activeTab === 'moments' && state === 'loading' && (
          <div className="mi-loading">
            <div className="mi-spinner" />
            <p>正在拉取好友圈数据...</p>
          </div>
        )}

        {activeTab === 'moments' && state === 'error' && (
          <div className="mi-error">
            <AlertCircle />
            <h3>连接失败</h3>
            <p>{errorMsg}</p>
            <button className="mi-btn-retry" onClick={() => fetchMoments()}>
              重新连接
            </button>
          </div>
        )}

        {activeTab === 'moments' && state === 'no-device' && (
          <div className="mi-error">
            <Smartphone size={48} />
            <h3>未检测到设备</h3>
            <p>请通过 ADB 连接您的手机，然后点击重试</p>
            <button className="mi-btn-retry" onClick={() => fetchMoments()}>
              重试
            </button>
          </div>
        )}

        {activeTab === 'moments' && state === 'ready' && moments.length === 0 && (
          <div className="mi-empty">
            <Image />
            <h3>暂无好友圈动态</h3>
            <p>好友圈数据为空，请确认是否已授权读取</p>
          </div>
        )}

        {activeTab === 'moments' && state === 'ready' && moments.length > 0 && (
          <>
            {moments.map((m, i) => (
              <MomentCard
                key={m.momentId || i}
                moment={m}
                index={i}
                deviceId={deviceId}
                isFullMode={isFullMode}
              />
            ))}
          </>
        )}
      </main>

      {/* Full Mode: Post FAB */}
      {isFullMode && activeTab === 'moments' && (
        <button className="mi-fab" onClick={() => setShowPost(true)}>
          <Plus size={24} />
        </button>
      )}

      {/* Post Dialog */}
      {showPost && (
        <PostDialog
          onClose={() => setShowPost(false)}
          onPosted={() => {
            setShowPost(false)
            setTimeout(() => fetchMoments(false), 1000)
          }}
        />
      )}

      {/* Bottom Tab Bar */}
      <nav className="mi-tab-bar">
        <button
          className={`mi-tab ${activeTab === 'moments' ? 'active' : ''}`}
          onClick={() => setActiveTab('moments')}
        >
          <Clock />
          <span>动态</span>
        </button>
        <button
          className={`mi-tab ${activeTab === 'device' ? 'active' : ''}`}
          onClick={() => setActiveTab('device')}
        >
          <Smartphone />
          <span>设备</span>
        </button>
        <button
          className={`mi-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings />
          <span>设置</span>
        </button>
      </nav>

      {/* Refresh Overlay */}
      {refreshing && (
        <div className="mi-refresh-overlay">
          <div className="mi-refresh-card">
            <div className="mi-spinner" />
            <p>正在刷新好友圈...</p>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="mi-toast">{toast}</div>}
    </div>
  )
}
