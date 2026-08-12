import type { StrategyPriority } from './salesStrategy'

export interface InterventionDecision {
  shouldIntervene: boolean
  priority: Exclude<StrategyPriority, 'none'>
  reason: string
  message: string
  confidence: number
  cooldownUntil?: string
  metadata?: Record<string, unknown>
}

export type CoachVoiceState = 'idle' | 'playing' | 'interrupted' | 'stopped'

export function createSilentInterventionDecision(reason: string, cooldownUntil?: string): InterventionDecision {
  return {
    shouldIntervene: false,
    priority: 'low',
    reason,
    message: '',
    confidence: 0,
    cooldownUntil,
  }
}
