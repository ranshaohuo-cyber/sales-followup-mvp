export type StrategyRecommendationType = 'strategy' | 'none'

export type StrategyPriority = 'none' | 'low' | 'medium' | 'high'

export interface StrategyRecommendation {
  type: StrategyRecommendationType
  priority: StrategyPriority
  action: string
  reason: string
  confidence: number
  suggestedPhrase: string
  updatedAt: string
  metadata?: Record<string, unknown>
}

export interface StrategyGenerationResult {
  recommendation: StrategyRecommendation
  reason: string
  signals: string[]
}

export function createEmptyStrategyRecommendation(): StrategyRecommendation {
  return {
    type: 'none',
    priority: 'none',
    action: '',
    reason: '暂无高置信度销售策略。',
    confidence: 0,
    suggestedPhrase: '',
    updatedAt: new Date().toISOString(),
    metadata: {
      source: 'initial',
    },
  }
}
