import { useState, useEffect, useCallback } from 'react'
import {
  Smartphone, Shield, Key, CheckCircle, XCircle,
  ChevronRight, Save, RefreshCw, AlertCircle,
} from 'lucide-react'
import { api } from '../api'
import type { ConfigInfo, DeviceInfo } from '../types'

interface Props {
  onDeviceSelect: (serial: string | undefined) => void
  selectedDevice?: string
}

export default function SettingsPage({ onDeviceSelect, selectedDevice }: Props) {
  const [config, setConfig] = useState<ConfigInfo | null>(null)
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [gettingKey, setGettingKey] = useState(false)
  const [toast, setToast] = useState('')

  // Full config form
  const [fullForm, setFullForm] = useState({
    aes_key: '',
    eebbk_key: '',
    key_id: '',
    watch_id: '',
    device_id: '',
    token: '',
    mac: '',
  })

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  // Load config and devices
  useEffect(() => {
    async function load() {
      try {
        const [cfg, fullCfg, devs] = await Promise.all([
          api.getConfig(),
          api.getFullConfig(),
          api.getDevices().catch(() => [] as DeviceInfo[]),
        ])
        setConfig(cfg)
        setDevices(Array.isArray(devs) ? devs : [])
        if (fullCfg) {
          setFullForm({
            aes_key: fullCfg.aes_key || '',
            eebbk_key: fullCfg.eebbk_key || '',
            key_id: fullCfg.key_id || '',
            watch_id: fullCfg.watch_id || '',
            device_id: fullCfg.device_id || '',
            token: fullCfg.token || '',
            mac: fullCfg.mac || '',
          })
        }
      } catch {
        // ignore
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleModeSwitch = async (mode: 'lite' | 'full') => {
    try {
      await api.setMode(mode)
      setConfig(prev => prev ? { ...prev, mode } : null)
      showToast(`已切换到 ${mode === 'full' ? 'Full' : 'Lite'} 模式`)
    } catch (err: any) {
      showToast('切换失败: ' + (err?.message || '未知错误'))
    }
  }

  const handleSaveFullConfig = async () => {
    setSaving(true)
    try {
      await api.updateFullConfig(fullForm)
      setConfig(prev => prev ? { ...prev, full_configured: true, has_aes_key: true } : null)
      showToast('配置已保存')
    } catch (err: any) {
      showToast('保存失败: ' + (err?.message || '未知错误'))
    }
    setSaving(false)
  }

  const handleGetKey = async () => {
    setGettingKey(true)
    showToast('正在获取密钥，请在手表上操作...')
    try {
      const result = await api.getkey()
      if (result.status === 'ok') {
        showToast('密钥获取成功！')
        // Reload config
        const fullCfg = await api.getFullConfig()
        if (fullCfg) {
          setFullForm({
            aes_key: fullCfg.aes_key || '',
            eebbk_key: fullCfg.eebbk_key || '',
            key_id: fullCfg.key_id || '',
            watch_id: fullCfg.watch_id || '',
            device_id: fullCfg.device_id || '',
            token: fullCfg.token || '',
            mac: fullCfg.mac || '',
          })
        }
        const cfg = await api.getConfig()
        setConfig(cfg)
      }
    } catch (err: any) {
      showToast('获取失败: ' + (err?.message || '请确保手表已连接'))
    }
    setGettingKey(false)
  }

  if (loading) {
    return (
      <div className="settings-page">
        <div className="mi-loading">
          <div className="mi-spinner" />
          <p>加载设置...</p>
        </div>
      </div>
    )
  }

  const isFull = config?.mode === 'full'
  const isConfigured = config?.full_configured

  return (
    <div className="settings-page">
      {/* ── Device Section ── */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Smartphone size={16} />
          <span>设备管理</span>
        </div>
        <div className="settings-card">
          {devices.length === 0 ? (
            <div className="settings-empty">
              <p>未检测到 ADB 设备</p>
              <span className="settings-hint">请确保手机已通过 USB 连接并开启 ADB 调试</span>
            </div>
          ) : (
            devices.map(d => (
              <div
                key={d.serial}
                className={`settings-device-item ${selectedDevice === d.serial ? 'active' : ''}`}
                onClick={() => onDeviceSelect(selectedDevice === d.serial ? undefined : d.serial)}
              >
                <Smartphone size={18} />
                <div className="settings-device-info">
                  <div className="settings-device-name">{d.serial}</div>
                  <div className="settings-device-status">
                    <span className={`settings-status-dot ${d.state === 'device' ? 'connected' : ''}`} />
                    {d.state === 'device' ? '已连接' : '未授权'}
                  </div>
                </div>
                {selectedDevice === d.serial && <CheckCircle size={18} className="settings-checked" />}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Mode Section ── */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Shield size={16} />
          <span>运行模式</span>
        </div>
        <div className="settings-card">
          <div className="settings-mode-item" onClick={() => handleModeSwitch('lite')}>
            <div className="settings-mode-info">
              <div className="settings-mode-name">Lite 模式</div>
              <div className="settings-mode-desc">通过数据库读取，风险低，无法使用发送、点赞功能</div>
            </div>
            {!isFull && <CheckCircle size={20} className="settings-checked" />}
          </div>
          <div className="settings-mode-divider" />
          <div className="settings-mode-item" onClick={() => handleModeSwitch('full')}>
            <div className="settings-mode-info">
              <div className="settings-mode-name">Full 模式</div>
              <div className="settings-mode-desc">V3 API 直连，速度快，支持发布和点赞，风险较高</div>
            </div>
            {isFull && <CheckCircle size={20} className="settings-checked" />}
          </div>
        </div>
        <div className={`settings-mode-badge ${isFull ? 'full' : 'lite'}`}>
          当前: {isFull ? 'Full 模式' : 'Lite 模式'}
        </div>
      </div>

      {/* ── Full Mode Config ── */}
      {isFull && (
        <div className="settings-section">
          <div className="settings-section-header">
            <Key size={16} />
            <span>V3 密钥配置</span>
            {isConfigured && <span className="settings-badge-ok">已配置</span>}
          </div>
          <div className="settings-card">
            {/* Getkey Button */}
            <button
              className="settings-getkey-btn"
              onClick={handleGetKey}
              disabled={gettingKey}
            >
              <RefreshCw size={16} className={gettingKey ? 'mi-spin' : ''} />
              {gettingKey ? '正在获取...' : '自动获取密钥（Frida）'}
            </button>

            <div className="settings-form-hint">
              或手动填写以下密钥信息：
            </div>

            <div className="settings-form">
              <label className="settings-label">AES Key</label>
              <input
                className="settings-input"
                value={fullForm.aes_key}
                onChange={e => setFullForm(prev => ({ ...prev, aes_key: e.target.value }))}
                placeholder="416d44d033be6269"
              />

              <label className="settings-label">Eebbk Key</label>
              <input
                className="settings-input"
                value={fullForm.eebbk_key}
                onChange={e => setFullForm(prev => ({ ...prev, eebbk_key: e.target.value }))}
                placeholder="RSA 加密后的 Eebbk-Key"
              />

              <label className="settings-label">Key ID</label>
              <input
                className="settings-input"
                value={fullForm.key_id}
                onChange={e => setFullForm(prev => ({ ...prev, key_id: e.target.value }))}
                placeholder="599bf75c01fe40f9..."
              />

              <label className="settings-label">Watch ID（用户 ID）</label>
              <input
                className="settings-input"
                value={fullForm.watch_id}
                onChange={e => setFullForm(prev => ({ ...prev, watch_id: e.target.value }))}
                placeholder="d515b5e73cac..."
              />

              <label className="settings-label">Device ID</label>
              <input
                className="settings-input"
                value={fullForm.device_id}
                onChange={e => setFullForm(prev => ({ ...prev, device_id: e.target.value }))}
                placeholder="13800138000"
              />

              <label className="settings-label">Token</label>
              <input
                className="settings-input"
                value={fullForm.token}
                onChange={e => setFullForm(prev => ({ ...prev, token: e.target.value }))}
                placeholder="chip-id-or-imei"
              />

              <label className="settings-label">MAC（可选）</label>
              <input
                className="settings-input"
                value={fullForm.mac}
                onChange={e => setFullForm(prev => ({ ...prev, mac: e.target.value }))}
                placeholder="AA:BB:CC:DD:EE:FF"
              />
            </div>

            <button
              className="settings-save-btn"
              onClick={handleSaveFullConfig}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="mi-toast settings-toast">{toast}</div>}
    </div>
  )
}
