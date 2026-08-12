import { accessCodeHeaders, appendAccessCode } from './accessCode'

export interface QwenSessionDescriptor {
  provider: 'qwen'
  model: string
  websocketUrl: string
  inputAudio: {
    format: string
    sampleRate: number
    channels: number
  }
  outputAudio: {
    format: string
    sampleRate: number
    channels: number
  }
}

export interface QwenRealtimeEvent {
  type: string
  text?: string
  delta?: string
  transcript?: string
  error?: {
    message?: string
    code?: string
  } | string
  response?: {
    status?: string
    output?: Array<{
      content?: Array<{
        text?: string
        transcript?: string
      }>
    }>
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export async function createQwenRealtimeSession() {
  const response = await fetch(`${API_BASE}/api/qwen/realtime/session`, {
    method: 'POST',
    headers: accessCodeHeaders(),
  })

  if (!response.ok) {
    throw new Error(`创建千问实时会话失败：${response.status}`)
  }

  return response.json() as Promise<QwenSessionDescriptor>
}

export function createQwenWebSocket(path: string) {
  const base = new URL(API_BASE)
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
  return new WebSocket(appendAccessCode(new URL(path, base).toString()))
}

export function qwenEvent(event: Record<string, unknown>) {
  return JSON.stringify({
    event_id: `event_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    ...event,
  })
}
