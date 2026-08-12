import type { QwenRealtimeEvent } from './qwenRealtime'

export interface TurnDetectionProvider {
  getTurnEvent(event: QwenRealtimeEvent): 'speech_started' | 'speech_stopped' | null
}

export class QwenServerVadTurnDetectionProvider implements TurnDetectionProvider {
  getTurnEvent(event: QwenRealtimeEvent) {
    if (event.type === 'input_audio_buffer.speech_started') {
      return 'speech_started'
    }
    if (event.type === 'input_audio_buffer.speech_stopped') {
      return 'speech_stopped'
    }
    return null
  }
}
