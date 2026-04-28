import { useState, useRef, useEffect } from 'react'
import { Heart, MessageCircle, Play, Music, X } from 'lucide-react'
import type { MomentData, ImageInfo } from '../types'
import { api } from '../api'
import ImageViewer from './ImageViewer'

interface Props {
  moment: MomentData
  index: number
  deviceId?: string
  isFullMode?: boolean
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

function VideoPlayer({ url, onClose }: { url: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    videoRef.current?.play()
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.92)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <button
        style={{
          position: 'fixed', top: 16, right: 16,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', border: 'none',
          color: 'white', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 2001,
        }}
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <video
        ref={videoRef}
        src={url}
        controls
        autoPlay
        style={{
          maxWidth: '95%', maxHeight: '90%',
          borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

import CommentsSheet from './CommentsSheet'

export default function MomentCard({ moment, index, deviceId, isFullMode }: Props) {
  const parsed = (moment as any).parsed as any
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState<number | null>(null)

  const kind = parsed?.kind || 'text'
  const text = parsed?.text || ''
  const images: { url: string; key: string }[] = parsed?.images || []
  const video = parsed?.video
  const app = parsed?.app

  const userName = (moment as any).nickname || (moment as any).username || (moment as any).name || ''
  const likeTotal = (moment as any).likeTotal || 0
  const self = (moment as any).self ?? 0
  const enableLike = (moment as any).enableLike ?? 1
  const momentWatchId = (moment as any).watchId || ''

  // Full mode: like
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(likeTotal)
  const [liking, setLiking] = useState(false)

  const handleLike = async () => {
    if (!isFullMode || liking) return
    setLiking(true)
    try {
      const res = await api.fullLike({
        momentId: moment.momentId,
        momentWatchId,
        emotionId: 0,
      })
      const data = res as any
      if (data?.code === '000001') {
        setLiked(data?.data?.id !== null)
        setLikeCount(prev => data?.data?.id !== null ? prev + 1 : Math.max(0, prev - 1))
      }
    } catch {
      // ignore
    }
    setLiking(false)
  }

  // Full mode: comment input
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commenting, setCommenting] = useState(false)

  const handleSubmitComment = async () => {
    if (!isFullMode || !commentText.trim() || commenting) return
    setCommenting(true)
    try {
      const res = await api.fullComment({
        momentId: moment.momentId,
        momentWatchId,
        comment: commentText.trim(),
      })
      if ((res as any)?.code === '000001') {
        setCommentText('')
        setShowCommentInput(false)
        setCommentCount(prev => (prev ?? 0) + 1)
      }
    } catch {
      // ignore
    }
    setCommenting(false)
  }

  // Comments (Lite: read from DB, Full: track local count)
  const handleCommentClick = async () => {
    setShowComments(true)
    if (commentCount === null) {
      try {
        const res = await api.getComments(moment.momentId, deviceId)
        setCommentCount(res.total)
      } catch {
        setCommentCount(0)
      }
    }
  }

  // Grid class for images
  const imgCount = images.length
  const gridClass = imgCount === 0 ? ''
    : imgCount === 1 ? 'single'
    : imgCount === 2 ? 'two'
    : imgCount === 4 ? 'four'
    : ''

  // Open image viewer
  const openImageViewer = (idx: number) => {
    const viewerImages = images.filter(img => img.url)
    const found = viewerImages.findIndex(img => img.url === images[idx]?.url)
    if (found >= 0) setViewerIndex(found)
  }

  return (
    <>
      <div
        className="moment-card"
        style={{ animationDelay: `${index * 0.05}s` }}
      >
        {/* Header */}
        <div className="moment-header">
          <div className="moment-avatar">
            M
          </div>
          <div className="moment-author-info">
            <div className="moment-author">
              {userName || '好友'}
            </div>
            <div className="moment-time">{formatTime(moment.createTime)}</div>
          </div>
        </div>

        {/* Body */}
        <div className="moment-body">
          {/* Text */}
          {text && (
            <div className="moment-text">{text}</div>
          )}

          {/* ── Images (direct URLs, no API roundtrip) ── */}
          {kind === 'multi_image' && images.length > 0 && (
            <div className={`moment-images ${gridClass}`}>
              {images.slice(0, 9).map((img, idx) => (
                <div key={idx} className="moment-image" onClick={() => openImageViewer(idx)}>
                  <img src={img.url} alt={`img-${idx}`} loading="lazy" />
                </div>
              ))}
            </div>
          )}

          {kind === 'image' && images.length > 0 && (
            <div className={`moment-images ${imgCount === 1 ? 'single' : ''}`}>
              {images.map((img, idx) => (
                <div key={idx} className="moment-image" onClick={() => openImageViewer(idx)}>
                  <img src={img.url} alt={`img-${idx}`} loading="lazy" />
                </div>
              ))}
            </div>
          )}

          {/* ── Video ── */}
          {kind === 'video' && video && (
            <div
              style={{
                marginTop: 8,
                borderRadius: 'var(--mi-radius-sm)',
                overflow: 'hidden',
                position: 'relative',
                background: '#000',
                cursor: 'pointer',
              }}
              onClick={() => {
                if (video.url) setPlayingVideo(video.url)
              }}
            >
              {(video.thumbnail_url || images[0]?.url) ? (
                <img
                  src={video.thumbnail_url || images[0]?.url}
                  alt="video-thumb"
                  style={{
                    width: '100%',
                    maxHeight: 300,
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                <div style={{
                  width: '100%', height: 180,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--mi-bg)', color: 'var(--mi-text-secondary)',
                  fontSize: 14,
                }}>
                  视频
                </div>
              )}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}>
                <Play size={24} color="white" fill="white" />
              </div>
              {video.duration ? (
                <div style={{
                  position: 'absolute', bottom: 8, right: 8,
                  background: 'rgba(0,0,0,0.6)', color: 'white',
                  padding: '2px 8px', borderRadius: 4, fontSize: 11,
                }}>
                  {Math.round(video.duration / 1000)}s
                </div>
              ) : null}
            </div>
          )}

          {/* ── App Share ── */}
          {kind === 'app_share' && app && (
            <div
              style={{
                marginTop: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--mi-bg)', borderRadius: 'var(--mi-radius-sm)',
              }}
            >
              {app.icon && (
                <img
                  src={app.icon}
                  alt="app-icon"
                  style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', background: 'white' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mi-text-primary)' }}>
                  {app.name || '应用'}
                </div>
                {app.desc && (
                  <div style={{
                    fontSize: 12, color: 'var(--mi-text-secondary)', marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {app.desc}
                  </div>
                )}
              </div>
              <Music size={18} style={{ color: 'var(--mi-text-tertiary)', flexShrink: 0 }} />
            </div>
          )}

          {/* ── Sticker ── */}
          {kind === 'sticker' && images.length > 0 && (
            <div style={{ marginTop: 8, maxWidth: 120 }}>
              <img src={images[0].url} alt="sticker" style={{ width: '100%', borderRadius: 8 }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="moment-footer">
          <button className="moment-action" onClick={isFullMode ? () => setShowCommentInput(!showCommentInput) : handleCommentClick}>
            <MessageCircle size={16} />
            <span>{commentCount !== null ? commentCount : '评论'}</span>
          </button>
          <button
            className="moment-action"
            onClick={handleLike}
            disabled={!isFullMode || liking || enableLike === 0}
            style={{ opacity: (!isFullMode || enableLike === 0) ? 0.5 : 1 }}
          >
            <Heart
              size={16}
              color={liked ? 'var(--mi-red)' : likeCount > 0 ? 'var(--mi-red)' : undefined}
              fill={liked ? 'var(--mi-red)' : 'none'}
            />
            <span>{likeCount > 0 ? likeCount : '赞'}</span>
          </button>
        </div>

        {/* Full mode: inline comment input */}
        {isFullMode && showCommentInput && (
          <div style={{
            padding: '8px var(--mi-space-lg) var(--mi-space-md)',
            display: 'flex', gap: 8, alignItems: 'center',
            borderTop: '1px solid var(--mi-border)',
            margin: '0 var(--mi-space-lg)',
          }}>
            <input
              autoFocus
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmitComment() }}
              placeholder="输入评论..."
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 'var(--mi-radius-full)',
                border: '1px solid var(--mi-border)', background: 'var(--mi-bg)',
                fontSize: 13, outline: 'none',
              }}
            />
            <button
              onClick={handleSubmitComment}
              disabled={!commentText.trim() || commenting}
              style={{
                padding: '8px 16px', borderRadius: 'var(--mi-radius-full)',
                border: 'none', background: 'var(--mi-orange)', color: 'white',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                opacity: !commentText.trim() || commenting ? 0.5 : 1,
              }}
            >
              {commenting ? '...' : '发送'}
            </button>
          </div>
        )}
      </div>

      {/* Image Viewer */}
      {viewerIndex !== null && images.filter(img => img.url).length > 0 && (
        <ImageViewer
          images={images.filter((img): img is ImageInfo & { url: string } => !!img.url)}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
      {/* Video Player */}
      {playingVideo && <VideoPlayer url={playingVideo} onClose={() => setPlayingVideo(null)} />}
      {/* Comments Sheet */}
      {showComments && (
        <CommentsSheet
          momentId={moment.momentId}
          deviceId={deviceId}
          onClose={() => setShowComments(false)}
        />
      )}
    </>
  )
}
