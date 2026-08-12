export interface AudioChunkRecord {
  audio: string
  byteLength: number
  timestamp: number
}

interface UtteranceSnapshot {
  chunks: string[]
  byteLength: number
  startedAt?: string
  endedAt?: string
}

export class UtteranceAudioBuffer {
  private active = false
  private chunks: AudioChunkRecord[] = []
  private recentChunks: AudioChunkRecord[] = []
  private startedAt?: string
  private readonly maxActiveChunks: number
  private readonly maxRecentChunks: number

  constructor(options: { maxActiveChunks?: number; maxRecentChunks?: number } = {}) {
    this.maxActiveChunks = options.maxActiveChunks ?? 400
    this.maxRecentChunks = options.maxRecentChunks ?? 30
  }

  addChunk(chunk: AudioChunkRecord) {
    this.recentChunks = [...this.recentChunks, chunk].slice(-this.maxRecentChunks)

    if (!this.active) {
      return
    }

    this.chunks = [...this.chunks, chunk].slice(-this.maxActiveChunks)
  }

  start(timestamp = new Date().toISOString()) {
    this.active = true
    this.startedAt = timestamp
    this.chunks = [...this.recentChunks]
  }

  stop(timestamp = new Date().toISOString()): UtteranceSnapshot {
    const snapshot = this.snapshot(timestamp)
    this.active = false
    this.chunks = []
    this.startedAt = undefined
    return snapshot
  }

  snapshot(endedAt = new Date().toISOString()): UtteranceSnapshot {
    return {
      chunks: this.chunks.map((chunk) => chunk.audio),
      byteLength: this.chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
      startedAt: this.startedAt,
      endedAt,
    }
  }

  reset() {
    this.active = false
    this.chunks = []
    this.recentChunks = []
    this.startedAt = undefined
  }

  get isActive() {
    return this.active
  }
}
