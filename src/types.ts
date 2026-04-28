export interface MomentData {
  momentId: string
  createTime: number
  content?: string
  resource?: string
  type?: number
  parsed?: ParsedContent
  [key: string]: unknown
}

export interface ParsedContent {
  kind: 'text' | 'image' | 'multi_image' | 'video' | 'app_share' | 'sticker' | 'album' | 'unknown'
  text?: string | null
  images: { url: string; key: string }[]
  video?: {
    url?: string
    key?: string
    thumbnail_url?: string
    thumbnail_key?: string
    duration?: number
  } | null
  app?: {
    name?: string
    icon?: string | null
    desc?: string
    link?: string
  } | null
}

export interface CommentData {
  commentId: string
  momentId: string
  content: string
  createTime: number
  [key: string]: unknown
}

export interface DeviceInfo {
  serial: string
  state: string
}

export interface ImageInfo {
  key: string
  url: string | null
}

export interface MomentsResponse {
  moments: MomentData[]
  total: number
}

export interface CommentsResponse {
  moment_id: string
  comments: CommentData[]
  total: number
}

export interface ImagesResponse {
  moment_id: string
  images: ImageInfo[]
  total: number
}

export interface ApiError {
  error: string
}

export interface ConfigInfo {
  mode: 'lite' | 'full'
  full_configured: boolean
  has_aes_key: boolean
  has_watch_id: boolean
}

export interface FullConfigDetail {
  aes_key: string
  eebbk_key: string
  key_id: string
  watch_id: string
  device_id: string
  token: string
  mac: string
}

export interface CommentIn {
  momentId: string
  momentWatchId: string
  comment: string
  replyId?: string
}

export interface LikeIn {
  momentId: string
  momentWatchId: string
  emotionId?: number
}

export interface PostMomentIn {
  content: string
  type?: number
}

declare global {
  interface Window {
    electronAPI: {
      getBackendPort: () => Promise<number>
      backendRequest: (endpoint: string) => Promise<unknown>
      backendPost: (endpoint: string, body?: unknown) => Promise<unknown>
      platform: string
    }
  }
}
