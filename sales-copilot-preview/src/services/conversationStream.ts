import type {
  ConversationBufferItem,
  ConversationEvent,
  ConversationSpeaker,
  ConversationSession,
  ConversationSessionStatus,
} from '../types/conversation'

type Listener = (events: ConversationEvent[]) => void

interface ConversationStreamOptions {
  maxEvents?: number
  sessionId?: string
  metadata?: ConversationSession['metadata']
}

export class ConversationStream {
  private events: ConversationEvent[] = []
  private archivedEvents: ConversationEvent[] = []
  private listeners = new Set<Listener>()
  private sequence = 0
  private readonly maxEvents: number
  private session: Omit<ConversationSession, 'events'>

  constructor(options: ConversationStreamOptions = {}) {
    this.maxEvents = options.maxEvents ?? 1000
    this.session = {
      sessionId: options.sessionId || createSessionId(),
      startTime: new Date().toISOString(),
      status: 'active',
      metadata: options.metadata,
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    listener(this.events)

    return () => {
      this.listeners.delete(listener)
    }
  }

  append(
    event: Omit<ConversationEvent, 'id' | 'sessionId' | 'sequence' | 'timestamp'> & {
      id?: string
      sessionId?: string
      sequence?: number
      timestamp?: string
    },
  ) {
    const nextEvent: ConversationEvent = {
      id: event.id || createEventId(event.type),
      sessionId: event.sessionId || this.session.sessionId,
      sequence: event.sequence || this.nextSequence(),
      timestamp: event.timestamp || new Date().toISOString(),
      speaker: event.speaker,
      type: event.type,
      content: event.content,
      confidence: event.confidence,
      metadata: event.metadata,
    }

    this.events = [...this.events, nextEvent]
    if (this.events.length > this.maxEvents) {
      const overflow = this.events.length - this.maxEvents
      this.archivedEvents = [...this.archivedEvents, ...this.events.slice(0, overflow)]
      this.events = this.events.slice(overflow)
    }
    this.emit()
    return nextEvent
  }

  clear() {
    this.events = []
    this.archivedEvents = []
    this.sequence = 0
    this.session = {
      ...this.session,
      sessionId: createSessionId(),
      startTime: new Date().toISOString(),
      endTime: undefined,
      status: 'active',
    }
    this.emit()
  }

  getEvents() {
    return this.events
  }

  getAllEvents() {
    return [...this.archivedEvents, ...this.events]
  }

  getSession() {
    return {
      ...this.session,
      events: this.getAllEvents(),
    }
  }

  updateStatus(status: ConversationSessionStatus) {
    this.session = {
      ...this.session,
      status,
      endTime: status === 'ended' ? new Date().toISOString() : this.session.endTime,
    }
    this.emit()
  }

  updateEventSpeaker(eventId: string, speaker: ConversationSpeaker): ConversationEvent | null {
    let updatedEvent: ConversationEvent | null = null
    const update = (event: ConversationEvent): ConversationEvent => {
      if (event.id !== eventId) {
        return event
      }
      updatedEvent = {
        ...event,
        speaker,
        metadata: {
          ...event.metadata,
          speakerCorrectedAt: new Date().toISOString(),
          speakerCorrectionSource: 'user',
        },
      }
      return updatedEvent
    }

    this.events = this.events.map(update)
    this.archivedEvents = this.archivedEvents.map(update)
    this.emit()
    return updatedEvent
  }

  get sessionId() {
    return this.session.sessionId
  }

  getConversationBuffer(): ConversationBufferItem[] {
    return this.events
      .filter((event) => event.type === 'transcript_final')
      .map((event) => ({
        eventId: event.id,
        speaker: event.speaker,
        text: event.content,
        timestamp: formatTime(event.timestamp),
        confidence: event.confidence,
      }))
  }

  private emit() {
    this.listeners.forEach((listener) => listener(this.events))
  }

  private nextSequence() {
    this.sequence += 1
    return this.sequence
  }
}

export function createEventId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function createSessionId() {
  return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
