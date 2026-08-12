import { createQwenRealtimeSession, createQwenWebSocket, qwenEvent, type QwenRealtimeEvent } from './qwenRealtime'

interface RealtimeAsrSessionOptions {
  onEvent: (event: QwenRealtimeEvent) => void
  onNetworkStatus: (status: string) => void
  onError: (error: string) => void
}

export class RealtimeAsrSession {
  private websocket?: WebSocket
  private inputSampleRate = 16000

  async connect(options: RealtimeAsrSessionOptions) {
    options.onNetworkStatus('connecting')
    const descriptor = await createQwenRealtimeSession()
    this.inputSampleRate = descriptor.inputAudio.sampleRate

    const websocket = createQwenWebSocket(descriptor.websocketUrl)
    this.websocket = websocket

    await new Promise<void>((resolve, reject) => {
      websocket.onopen = () => {
        options.onNetworkStatus('connected')
        resolve()
      }
      websocket.onerror = () => {
        options.onNetworkStatus('error')
        reject(new Error('实时语音连接失败'))
      }
      websocket.onmessage = (message) => {
        try {
          options.onEvent(JSON.parse(message.data) as QwenRealtimeEvent)
        } catch {
          options.onError('解析实时事件失败')
        }
      }
      websocket.onclose = () => {
        options.onNetworkStatus('closed')
      }
    })
  }

  sendAudio(audio: string) {
    if (this.websocket?.readyState !== WebSocket.OPEN) {
      return {
        ok: false,
        reason: this.websocket ? `ws_state_${this.websocket.readyState}` : 'ws_missing',
      }
    }

    this.websocket.send(qwenEvent({ type: 'input_audio_buffer.append', audio }))
    return { ok: true }
  }

  cancelResponse() {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(qwenEvent({ type: 'response.cancel' }))
    }
  }

  close() {
    this.websocket?.close()
    this.websocket = undefined
  }

  get sampleRate() {
    return this.inputSampleRate
  }

  get connected() {
    return this.websocket?.readyState === WebSocket.OPEN
  }
}
