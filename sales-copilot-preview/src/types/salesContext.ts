export type SalesStage =
  | 'opening'
  | 'discovery'
  | 'solution_presentation'
  | 'objection_handling'
  | 'pricing'
  | 'closing'
  | 'unknown'

export type CustomerState =
  | 'interested'
  | 'neutral'
  | 'hesitant'
  | 'price_sensitive'
  | 'skeptical'
  | 'ready_to_buy'
  | 'unknown'

export type CustomerIntent =
  | 'asking_information'
  | 'comparing'
  | 'objecting'
  | 'negotiating'
  | 'buying_signal'
  | 'leaving'
  | 'unknown'

export type ObjectionType =
  | 'price'
  | 'trust'
  | 'need'
  | 'timing'
  | 'competitor'
  | 'authority'
  | 'unknown'

export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown'

export interface SalesContext {
  sessionId: string
  stage: SalesStage
  customerState: CustomerState
  customerIntent: CustomerIntent
  objectionType: ObjectionType
  riskLevel: RiskLevel
  confidence: number
  updatedAt: string
  metadata?: Record<string, unknown>
}

export interface SalesContextAnalysisResult {
  context: SalesContext
  reason: string
  signals: string[]
}

export function createUnknownSalesContext(sessionId: string): SalesContext {
  return {
    sessionId,
    stage: 'unknown',
    customerState: 'unknown',
    customerIntent: 'unknown',
    objectionType: 'unknown',
    riskLevel: 'unknown',
    confidence: 0,
    updatedAt: new Date().toISOString(),
    metadata: {
      source: 'initial',
    },
  }
}
