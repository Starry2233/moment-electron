import type { MomentsResponse, CommentsResponse, ImagesResponse, DeviceInfo } from './types'

const BASE = 'http://127.0.0.1'

async function getPort(): Promise<number> {
  if (window.electronAPI) {
    const port = await window.electronAPI.getBackendPort()
    if (port) return port
  }
  // Fallback for direct browser dev
  return 8000
}

async function apiGet<T>(endpoint: string): Promise<T> {
  const port = await getPort()
  const url = `${BASE}:${port}${endpoint}`

  if (window.electronAPI) {
    return (await window.electronAPI.backendRequest(endpoint)) as T
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

async function apiPost<T>(endpoint: string, body?: unknown): Promise<T> {
  const port = await getPort()

  if (window.electronAPI) {
    return (await window.electronAPI.backendPost(endpoint, body)) as T
  }

  const res = await fetch(`${BASE}:${port}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const api = {
  getDevices: () => apiGet<DeviceInfo[]>('/api/devices'),

  getMoments: (params?: { from?: number; to?: number; limit?: number; device_id?: string }) => {
    const q = new URLSearchParams()
    if (params?.from) q.set('from', String(params.from))
    if (params?.to) q.set('to', String(params.to))
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.device_id) q.set('device_id', params.device_id)
    const qs = q.toString()
    return apiGet<MomentsResponse>(`/api/moments${qs ? '?' + qs : ''}`)
  },

  refreshMoments: (device_id?: string) =>
    apiPost<{ status: string; message: string }>(
      `/api/moments/refresh${device_id ? '?device_id=' + device_id : ''}`
    ),

  getImages: (momentId: string, device_id?: string) =>
    apiGet<ImagesResponse>(
      `/api/moments/${momentId}/images${device_id ? '?device_id=' + device_id : ''}`
    ),

  getComments: (momentId: string, device_id?: string) =>
    apiGet<CommentsResponse>(
      `/api/moments/${momentId}/comments${device_id ? '?device_id=' + device_id : ''}`
    ),

  // ── Config ──
  getConfig: () => apiGet<ConfigInfo>('/api/config'),

  setMode: (mode: string) =>
    apiPost<{ status: string; mode: string }>('/api/config/mode', { mode }),

  getFullConfig: () => apiGet<FullConfigDetail>('/api/config/full'),

  updateFullConfig: (body: Record<string, string>) =>
    apiPost<{ status: string }>('/api/config/full', body),

  // ── Getkey ──
  getkey: () => apiPost<{ status: string; keyId: string; aesKey: string }>('/api/getkey'),

  // ── Full Mode Actions ──
  fullComment: (body: CommentIn) =>
    apiPost<Record<string, unknown>>('/api/full/comment', body),

  fullLike: (body: LikeIn) =>
    apiPost<Record<string, unknown>>('/api/full/like', body),

  fullPost: (body: PostMomentIn) =>
    apiPost<Record<string, unknown>>('/api/full/post', body),

  health: () => apiGet<{ status: string }>('/api/health'),
}
