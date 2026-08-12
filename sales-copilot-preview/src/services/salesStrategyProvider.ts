import type { ConversationEvent } from '../types/conversation'
import type { SalesContext } from '../types/salesContext'
import type { StrategyGenerationResult } from '../types/salesStrategy'

export interface SalesStrategyProvider {
  generateStrategy(context: SalesContext, events: ConversationEvent[]): StrategyGenerationResult
}
