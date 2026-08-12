import type { ConversationSession } from '../types/conversation'

const STORAGE_KEY = 'sales_copilot_latest_conversation_session'

export class ConversationSessionStore {
  save(session: ConversationSession) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }

  loadLatest(): ConversationSession | null {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    try {
      return JSON.parse(raw) as ConversationSession
    } catch {
      return null
    }
  }

  clear() {
    localStorage.removeItem(STORAGE_KEY)
  }
}
