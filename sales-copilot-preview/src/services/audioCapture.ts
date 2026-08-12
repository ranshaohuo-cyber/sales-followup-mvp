import { MicrophonePcmStreamer } from '../utils/realtimeAudio'

interface AudioCaptureOptions {
  targetSampleRate: number
  chunkMs: number
  onChunk: (chunk: { audio: string; byteLength: number; timestamp: number; captureLatencyMs: number }) => void
}

export class AudioCaptureService {
  private streamer?: MicrophonePcmStreamer
  private isRunning = false

  async start(options: AudioCaptureOptions) {
    if (this.isRunning) {
      return
    }

    this.streamer = new MicrophonePcmStreamer()
    await this.streamer.start({
      targetSampleRate: options.targetSampleRate,
      chunkMs: options.chunkMs,
      onChunk: (audio, metadata) => {
        options.onChunk({
          audio,
          byteLength: base64ByteLength(audio),
          timestamp: metadata.timestamp,
          captureLatencyMs: Date.now() - metadata.timestamp,
        })
      },
    })
    this.isRunning = true
  }

  stop() {
    this.streamer?.stop()
    this.streamer = undefined
    this.isRunning = false
  }

  get running() {
    return this.isRunning
  }
}

function base64ByteLength(value: string) {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  return Math.floor((value.length * 3) / 4) - padding
}
