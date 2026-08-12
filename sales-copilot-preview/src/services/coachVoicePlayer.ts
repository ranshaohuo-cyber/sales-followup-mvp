import type { CoachVoiceState } from '../types/intervention'

export interface CoachVoicePlayer {
  playSuggestion(message: string, options?: { priority?: string }): Promise<void>
  stop(): void
  interrupt(): void
  getState(): CoachVoiceState
}

export class BrowserSpeechCoachVoicePlayer implements CoachVoicePlayer {
  private state: CoachVoiceState = 'idle'
  private currentUtterance: SpeechSynthesisUtterance | null = null

  async playSuggestion(message: string, _options?: { priority?: string }) {
    if (!message || !window.speechSynthesis) {
      return
    }

    this.stop()
    this.state = 'playing'

    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(message)
      utterance.lang = 'zh-CN'
      utterance.rate = 1.35
      utterance.pitch = 1
      utterance.volume = 0.8
      utterance.onend = () => {
        this.currentUtterance = null
        this.state = 'idle'
        resolve()
      }
      utterance.onerror = () => {
        this.currentUtterance = null
        this.state = 'idle'
        resolve()
      }

      this.currentUtterance = utterance
      window.speechSynthesis.speak(utterance)
    })
  }

  stop() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    this.currentUtterance = null
    this.state = 'stopped'
  }

  interrupt() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    this.currentUtterance = null
    this.state = 'interrupted'
  }

  getState() {
    return this.state
  }
}
