import type { ConversationEvent } from '../types/conversation'
import { createUnknownSalesContext, type SalesContext, type SalesContextAnalysisResult } from '../types/salesContext'
import type { ContextAnalyzer } from './contextAnalyzer'
import { RuleBasedContextAnalyzer } from './ruleBasedContextAnalyzer'

export class SalesContextEngine {
  private context: SalesContext
  private readonly analyzer: ContextAnalyzer
  private lastAnalyzedSequence = 0

  constructor(sessionId: string, analyzer: ContextAnalyzer = new RuleBasedContextAnalyzer()) {
    this.context = createUnknownSalesContext(sessionId)
    this.analyzer = analyzer
  }

  update(events: ConversationEvent[]): SalesContextAnalysisResult {
    const finalTranscriptEvents = events.filter((event) => event.type === 'transcript_final')
    const latestFinal = finalTranscriptEvents[finalTranscriptEvents.length - 1]

    if (!latestFinal || latestFinal.sequence <= this.lastAnalyzedSequence) {
      return {
        context: this.context,
        reason: 'no_new_transcript_final',
        signals: [],
      }
    }

    const result = this.analyzer.analyze(events, this.context)
    this.context = result.context
    this.lastAnalyzedSequence = latestFinal.sequence
    return result
  }

  getContext() {
    return this.context
  }

  reset(sessionId: string) {
    this.context = createUnknownSalesContext(sessionId)
    this.lastAnalyzedSequence = 0
    return this.context
  }
}
