import { useState, useCallback, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface ImageInfo {
  key: string
  url: string
}

interface Props {
  images: ImageInfo[]
  initialIndex: number
  onClose: () => void
}

export default function ImageViewer({ images, initialIndex, onClose }: Props) {
  const [idx, setIdx] = useState(initialIndex)

  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIdx((i) => Math.min(images.length - 1, i + 1)), [images.length])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, prev, next])

  return (
    <div className="mi-image-viewer" onClick={onClose}>
      <button className="close-btn" onClick={onClose}>
        <X />
      </button>

      {images.length > 1 && idx > 0 && (
        <button
          style={{
            position: 'fixed',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            zIndex: 2001,
          }}
          onClick={(e) => { e.stopPropagation(); prev() }}
        >
          <ChevronLeft size={24} />
        </button>
      )}

      <img
        src={images[idx].url}
        alt={`image-${idx}`}
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && idx < images.length - 1 && (
        <button
          style={{
            position: 'fixed',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            zIndex: 2001,
          }}
          onClick={(e) => { e.stopPropagation(); next() }}
        >
          <ChevronRight size={24} />
        </button>
      )}

      {images.length > 1 && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.5)',
            color: 'white',
            padding: '6px 16px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 500,
            backdropFilter: 'blur(10px)',
          }}
        >
          {idx + 1} / {images.length}
        </div>
      )}
    </div>
  )
}
