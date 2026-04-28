import { useState } from 'react'
import { X, Send } from 'lucide-react'
import { api } from '../api'

interface Props {
  onClose: () => void
  onPosted: () => void
}

export default function PostDialog({ onClose, onPosted }: Props) {
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [toast, setToast] = useState('')

  const handlePost = async () => {
    if (!content.trim() || posting) return
    setPosting(true)
    try {
      const res: any = await api.fullPost({ content: content.trim(), type: 3 })
      if (res?.code === '000001') {
        setToast('发布成功')
        setTimeout(() => onPosted(), 1000)
      } else {
        setToast('发布失败: ' + (res?.desc || '未知错误'))
      }
    } catch (err: any) {
      setToast('发布失败: ' + (err?.message || '网络错误'))
    }
    setPosting(false)
  }

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        animation: 'overlay-enter 0.2s var(--mi-ease)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--mi-card)',
          borderRadius: 'var(--mi-radius-xl)',
          width: '88%', maxWidth: 360,
          padding: 'var(--mi-space-xl)',
          boxShadow: 'var(--mi-shadow-xl)',
          animation: 'card-pop 0.3s var(--mi-ease)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--mi-text-primary)' }}>
            发布动态
          </h3>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none',
              background: 'rgba(0,0,0,0.05)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--mi-text-secondary)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Input */}
        <textarea
          autoFocus
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="说点什么..."
          rows={5}
          style={{
            width: '100%', padding: 12, borderRadius: 'var(--mi-radius-md)',
            border: '1px solid var(--mi-border)', background: 'var(--mi-bg)',
            fontSize: 15, lineHeight: 1.5, resize: 'none', outline: 'none',
            boxSizing: 'border-box', color: 'var(--mi-text-primary)',
            fontFamily: 'inherit',
          }}
        />

        {/* Send button */}
        <button
          onClick={handlePost}
          disabled={!content.trim() || posting}
          style={{
            marginTop: 16, width: '100%', padding: '12px 0',
            borderRadius: 'var(--mi-radius-full)', border: 'none',
            background: !content.trim() ? 'var(--mi-border)' : 'var(--mi-orange)',
            color: !content.trim() ? 'var(--mi-text-tertiary)' : 'white',
            fontSize: 15, fontWeight: 600, cursor: !content.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s',
          }}
        >
          <Send size={16} />
          {posting ? '发布中...' : '发布'}
        </button>

        {/* Toast */}
        {toast && (
          <div style={{
            marginTop: 12, textAlign: 'center', fontSize: 13,
            color: toast.includes('失败') ? 'var(--mi-red)' : 'var(--mi-green)',
          }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
