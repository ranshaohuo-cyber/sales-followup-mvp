interface MicrophonePcmStreamerOptions {
  targetSampleRate: number
  chunkMs?: number
  onChunk: (base64Pcm: string, metadata: { timestamp: number; sampleCount: number }) => void
}

export class MicrophonePcmStreamer {
  private audioContext?: AudioContext
  private source?: MediaStreamAudioSourceNode
  private processor?: ScriptProcessorNode
  private stream?: MediaStream
  private pendingSamples: number[] = []

  async start(options: MicrophonePcmStreamerOptions) {
    if (this.audioContext) {
      return
    }

    const chunkSize = Math.floor(options.targetSampleRate * (options.chunkMs ?? 100) / 1000)
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      },
    })

    this.audioContext = new AudioContext()
    this.source = this.audioContext.createMediaStreamSource(this.stream)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

    this.processor.onaudioprocess = (event) => {
      if (!this.audioContext) {
        return
      }

      const input = event.inputBuffer.getChannelData(0)
      const samples = downsample(input, this.audioContext.sampleRate, options.targetSampleRate)
      this.pendingSamples.push(...samples)

      while (this.pendingSamples.length >= chunkSize) {
        const chunk = this.pendingSamples.splice(0, chunkSize)
        options.onChunk(floatSamplesToPcm16Base64(chunk), {
          timestamp: Date.now(),
          sampleCount: chunk.length,
        })
      }
    }

    this.source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
  }

  stop() {
    this.processor?.disconnect()
    this.source?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    void this.audioContext?.close()

    this.audioContext = undefined
    this.source = undefined
    this.processor = undefined
    this.stream = undefined
    this.pendingSamples = []
  }
}

export class PcmAudioPlayer {
  private audioContext?: AudioContext
  private nextPlayTime = 0
  private readonly sampleRate: number

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate
  }

  async warmup() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate })
      this.nextPlayTime = this.audioContext.currentTime
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
  }

  async play(base64Pcm: string) {
    if (!base64Pcm) {
      return
    }

    await this.warmup()

    const audioContext = this.audioContext
    if (!audioContext) {
      return
    }

    const samples = pcm16Base64ToFloatSamples(base64Pcm)
    const buffer = audioContext.createBuffer(1, samples.length, this.sampleRate)
    buffer.copyToChannel(samples, 0)

    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(audioContext.destination)

    const startAt = Math.max(audioContext.currentTime + 0.03, this.nextPlayTime)
    source.start(startAt)
    this.nextPlayTime = startAt + buffer.duration
  }

  clear() {
    this.nextPlayTime = this.audioContext?.currentTime ?? 0
  }

  close() {
    void this.audioContext?.close()
    this.audioContext = undefined
    this.nextPlayTime = 0
  }
}

function downsample(input: Float32Array, inputRate: number, outputRate: number) {
  if (inputRate === outputRate) {
    return Array.from(input)
  }

  const ratio = inputRate / outputRate
  const outputLength = Math.floor(input.length / ratio)
  const output = new Array<number>(outputLength)

  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio)
    const end = Math.floor((index + 1) * ratio)
    let sum = 0
    let count = 0

    for (let inputIndex = start; inputIndex < end && inputIndex < input.length; inputIndex += 1) {
      sum += input[inputIndex]
      count += 1
    }

    output[index] = count > 0 ? sum / count : 0
  }

  return output
}

function floatSamplesToPcm16Base64(samples: number[]) {
  const buffer = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buffer)

  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample))
    const pcm = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
    view.setInt16(index * 2, pcm, true)
  })

  let binary = ''
  const bytes = new Uint8Array(buffer)
  const batchSize = 0x8000

  for (let index = 0; index < bytes.length; index += batchSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + batchSize))
  }

  return btoa(binary)
}

function pcm16Base64ToFloatSamples(base64Pcm: string) {
  const binary = atob(base64Pcm)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  const view = new DataView(bytes.buffer)
  const samples = new Float32Array(bytes.byteLength / 2)

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 0x8000
  }

  return samples
}
