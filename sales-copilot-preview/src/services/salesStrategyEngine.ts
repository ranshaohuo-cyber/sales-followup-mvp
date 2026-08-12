import type { ConversationEvent } from '../types/conversation'
import type { SalesContext } from '../types/salesContext'
import { createEmptyStrategyRecommendation, type StrategyGenerationResult, type StrategyRecommendation } from '../types/salesStrategy'
import { RuleBasedSalesStrategyProvider } from './ruleBasedSalesStrategyProvider'
import type { SalesStrategyProvider } from './salesStrategyProvider'

export class SalesStrategyEngine {
  private recommendation: StrategyRecommendation = createEmptyStrategyRecommendation()
  private readonly provider: SalesStrategyProvider
  private lastContextUpdateSequence = 0

  constructor(provider: SalesStrategyProvider = new RuleBasedSalesStrategyProvider()) {
    this.provider = provider
  }

  update(context: SalesContext, events: ConversationEvent[]): StrategyGenerationResult {
    const contextEvents = events.filter((event) => event.type === 'context_update')
    const latestContextEvent = contextEvents[contextEvents.length - 1]

    if (!latestContextEvent || latestContextEvent.sequence <= this.lastContextUpdateSequence) {
      return {
        recommendation: this.recommendation,
        reason: 'no_new_context_update',
        signals: [],
      }
    }

    const result = this.provider.generateStrategy(context, events)
    this.recommendation = result.recommendation
    this.lastContextUpdateSequence = latestContextEvent.sequence
    return result
  }

  getRecommendation() {
    return this.recommendation
  }

  reset() {
    this.recommendation = createEmptyStrategyRecommendation()
    this.lastContextUpdateSequence = 0
    return this.recommendation
  }
}
