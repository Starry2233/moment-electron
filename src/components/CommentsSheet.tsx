import { useEffect, useState } from 'react'
import { X, MessageCircle } from 'lucide-react'
import type { CommentData } from '../types'
import { api } from '../api'

interface Props {
  momentId: string
  deviceId?: string
  onClose: () => void
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  const month = d.getMonth() + 1
  const day = d.getDate()
  if (d.getFullYear() === now.getFullYear()) return `${month}月${day}日`
  return `${d.getFullYear()}年${month}月${day}日`
}

export default function CommentsSheet({ momentId, deviceId, onClose }: Props) {
  const [comments, setComments] = useState<CommentData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getComments(momentId, deviceId)
        setComments(res.comments)
      } catch {
        setComments([])
      }
      setLoading(false)
    }
    load()
  }, [momentId, deviceId])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 1500,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end',
        animation: 'overlay-enter 0.3s var(--mi-ease)',
      }}
    >
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'relative',
          background: 'var(--mi-card)',
          borderRadius: 'var(--mi-radius-xl) var(--mi-radius-xl) 0 0',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'card-pop 0.35s var(--mi-ease)',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--mi-space-lg) var(--mi-space-xl)',
          borderBottom: '1px solid var(--mi-border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageCircle size={18} style={{ color: 'var(--mi-orange)' }} />
            <span style={{ fontSize: 17, fontWeight: 600 }}>
              评论 {!loading && `(${comments.length})`}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: 'none', background: 'rgba(0,0,0,0.05)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--mi-text-secondary)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 'var(--mi-space-sm) 0' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--mi-text-tertiary)', fontSize: 14 }}>
              <div className="mi-spinner" style={{ margin: '0 auto 12px' }} />
              加载中...
            </div>
          ) : comments.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--mi-text-tertiary)', fontSize: 14 }}>
              暂无评论
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.commentId} style={{ padding: '12px var(--mi-space-xl)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FF6900, #FF8C3A)',
                    color: 'white', fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {(c.watchName || '?').charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mi-orange)' }}>
                        {c.watchName || '匿名'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--mi-text-tertiary)' }}>
                        {formatTime(c.createTime)}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--mi-text-primary)', marginTop: 2 }}>
                      {c.parentWatchId && c.replyName && (
                        <span style={{ color: 'var(--mi-orange)', fontSize: 13 }}>回复 {c.replyName}：</span>
                      )}
                      {c.comment}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
