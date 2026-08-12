import type { ConversationEvent } from '../types/conversation'
import type { SalesContextAnalysisResult, SalesContext } from '../types/salesContext'

export interface ContextAnalyzer {
  analyze(events: ConversationEvent[], currentContext: SalesContext): SalesContextAnalysisResult
}
