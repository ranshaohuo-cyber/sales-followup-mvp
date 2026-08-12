export type ConversationSpeaker = 'customer' | 'sales' | 'unknown' | 'ai_coach'

export type ConversationEventType =
  | 'audio'
  | 'transcript_partial'
  | 'transcript_final'
  | 'state_change'
  | 'sales_signal'
  | 'coach_suggestion'
  | 'suggestion'
  | 'intervention'
  | 'context_update'
  | 'strategy_recommendation'
  | 'latency_metric'
  | 'session_marker'

export type ConversationSessionStatus = 'active' | 'paused' | 'ended'

export type ResponsePriority = 'none' | 'low' | 'medium' | 'high' | 'urgent'

export type ResponseMode = 'silent' | 'text_only' | 'whisper' | 'interrupt'

export interface ConversationEvent {
  id: string
  sessionId: string
  sequence: number
  timestamp: string
  speaker: ConversationSpeaker
  type: ConversationEventType
  content: string
  confidence?: number
  metadata?: Record<string, unknown>
}

export interface ConversationBufferItem {
  eventId: string
  speaker: ConversationSpeaker
  text: string
  timestamp: string
  confidence?: number
}

export interface ConversationSession {
  sessionId: string
  startTime: string
  endTime?: string
  status: ConversationSessionStatus
  events: ConversationEvent[]
  metadata?: {
    source?: 'qwen' | 'openai' | 'manual'
    device?: string
    sampleRate?: number
    [key: string]: unknown
  }
}

export interface ResponsePolicy {
  canRespond: boolean
  reason: string
  priority: ResponsePriority
  mode: ResponseMode
  allowedEventTypes: Array<'coach_suggestion' | 'intervention'>
  metadata?: Record<string, unknown>
}

export interface SpeakerIdentificationInput {
  eventId?: string
  sessionId: string
  audioChunks?: string[]
  audioChunk?: string
  transcript?: string
  startedAt?: string
  endedAt?: string
  channel?: number
  sampleRate?: number
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface SpeakerIdentificationResult {
  speaker: Exclude<ConversationSpeaker, 'ai_coach'>
  confidence: number
  metadata?: {
    provider?: 'mock' | 'sales_voiceprint' | 'diarization' | 'dual_channel'
    matchedSalesVoiceprint?: boolean
    score?: number
    threshold?: number
    reason?: string
    [key: string]: unknown
  }
}

export interface RealtimeDebugState {
  audioStatus: string
  asrStatus: string
  networkStatus: string
  latencyMs: number | null
  audioCaptureLatencyMs: number | null
  asrLatencyMs: number | null
  eventProcessingLatencyMs: number | null
  chunksSent: number
  droppedChunks: number
  bytesSent: number
  partialText: string
  speakerStatus: string
  lastSpeaker: ConversationSpeaker
  speakerConfidence: number | null
  lastError: string
}
