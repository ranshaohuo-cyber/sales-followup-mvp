import type { ConversationEvent } from '../types/conversation'
import { createSilentInterventionDecision, type InterventionDecision } from '../types/intervention'
import type { SalesContext } from '../types/salesContext'
import type { StrategyPriority, StrategyRecommendation } from '../types/salesStrategy'

const MIN_CONTEXT_CONFIDENCE = 0.5
const MIN_STRATEGY_CONFIDENCE = 0.7

export class InterventionController {
  private cooldownUntilMs = 0

  evaluate(
    events: ConversationEvent[],
    context: SalesContext,
    strategy: StrategyRecommendation,
  ): InterventionDecision {
    const now = Date.now()
    if (now < this.cooldownUntilMs) {
      return createSilentInterventionDecision('cooldown_active', new Date(this.cooldownUntilMs).toISOString())
    }

    if (strategy.type === 'none') {
      return createSilentInterventionDecision('no_strategy')
    }

    if (context.confidence < MIN_CONTEXT_CONFIDENCE) {
      return createSilentInterventionDecision('context_confidence_low')
    }

    if (strategy.confidence < MIN_STRATEGY_CONFIDENCE) {
      return createSilentInterventionDecision('strategy_confidence_low')
    }

    const latestTranscript = latestTranscriptEvent(events)
    if (!latestTranscript) {
      return createSilentInterventionDecision('no_final_transcript')
    }

    const salesWrongDirection = latestTranscript.speaker === 'sales' && isLikelyWrongSalesAnswer(latestTranscript.content, context)
    if (latestTranscript.speaker === 'sales' && !salesWrongDirection) {
      return createSilentInterventionDecision('sales_is_speaking')
    }

    const isCritical =
      strategy.priority === 'high' ||
      context.riskLevel === 'high' ||
      context.customerIntent === 'buying_signal' ||
      context.objectionType !== 'unknown' ||
      context.customerState === 'hesitant' ||
      salesWrongDirection

    if (!isCritical) {
      return createSilentInterventionDecision('not_critical_enough')
    }

    const priority = normalizePriority(strategy.priority)
    const confidence = clamp01((strategy.confidence * 0.65) + (context.confidence * 0.35))

    return {
      shouldIntervene: true,
      priority,
      reason: strategy.reason,
      message: salesWrongDirection ? toWrongDirectionWhisper(context) : toWhisperMessage(context, strategy, events),
      confidence,
      metadata: {
        source: 'rule_based_intervention',
        latestTranscriptId: latestTranscript.id,
        salesWrongDirection,
      },
    }
  }

  markIntervened(priority: Exclude<StrategyPriority, 'none'>) {
    const cooldownMs = priority === 'high' ? 4500 : priority === 'medium' ? 8000 : 12000
    this.cooldownUntilMs = Date.now() + cooldownMs
    return new Date(this.cooldownUntilMs).toISOString()
  }

  cancel() {
    return createSilentInterventionDecision('intervention_cancelled')
  }

  reset() {
    this.cooldownUntilMs = 0
  }
}

function latestTranscriptEvent(events: ConversationEvent[]) {
  const transcripts = events.filter((event) => event.type === 'transcript_final')
  return transcripts[transcripts.length - 1]
}

function normalizePriority(priority: StrategyPriority): Exclude<StrategyPriority, 'none'> {
  return priority === 'none' ? 'low' : priority
}

function toWhisperMessage(context: SalesContext, strategy: StrategyRecommendation, events: ConversationEvent[]) {
  const metadataMessage = typeof strategy.metadata?.coachMessage === 'string'
    ? strategy.metadata.coachMessage
    : ''
  if (metadataMessage) {
    return metadataMessage
  }

  const recentCustomerText = events
    .filter((event) => event.type === 'transcript_final' && (event.speaker === 'customer' || event.speaker === 'unknown'))
    .slice(-4)
    .map((event) => event.content)
    .join(' ')

  if (context.objectionType === 'price') {
    if (containsAny(recentCustomerText, ['\u7ade\u54c1', '\u53e6\u4e00\u5bb6', '\u522b\u4eba\u5bb6', '\u5bf9\u6bd4'])) {
      return '\u5148\u5bf9\u9f50\u6bd4\u8f83\u53e3\u5f84\u3002'
    }
    if (containsAny(recentCustomerText, ['\u4f18\u60e0', '\u6253\u6298', '\u964d\u4ef7', '\u4fbf\u5b9c\u70b9'])) {
      return '\u5148\u6362\u6210\u4ea4\u6761\u4ef6\u3002'
    }
    if (containsAny(recentCustomerText, ['\u9884\u7b97', '\u8d85\u9884\u7b97', '\u627f\u53d7\u4e0d\u4e86'])) {
      return '\u5148\u786e\u8ba4\u9884\u7b97\u7ebf\u3002'
    }
    if (containsAny(recentCustomerText, ['\u4e0d\u503c', '\u5dee\u4e0d\u591a', '\u6ca1\u770b\u51fa', '\u533a\u522b'])) {
      return '\u5148\u8865\u4ef7\u503c\u5dee\u5f02\u3002'
    }
    return '\u5206\u6e05\u9884\u7b97\u8fd8\u662f\u4ef7\u503c\u3002'
  }
  if (context.objectionType === 'competitor') {
    return '\u62ff\u56de\u6bd4\u8f83\u6807\u51c6\u3002'
  }
  if (context.objectionType === 'trust') {
    return containsAny(recentCustomerText, ['\u552e\u540e', '\u670d\u52a1', '\u4fdd\u969c'])
      ? '\u5148\u8bb2\u552e\u540e\u4fdd\u969c\u3002'
      : '\u5148\u8865\u53ef\u4fe1\u6848\u4f8b\u3002'
  }
  if (context.objectionType === 'need') {
    return '\u95ee\u843d\u5730\u5361\u70b9\u3002'
  }
  if (context.objectionType === 'timing') {
    return '\u95ee\u5ef6\u540e\u771f\u56e0\u3002'
  }
  if (context.objectionType === 'authority') {
    return '\u95ee\u51b3\u7b56\u4eba\u5173\u5207\u3002'
  }
  if (context.customerState === 'hesitant') {
    return '\u627f\u63a5\u771f\u987e\u8651\u3002'
  }
  if (context.customerIntent === 'buying_signal') {
    return '\u63a8\u8fdb\u4e0b\u4e00\u6b65\u3002'
  }

  const compactAction = strategy.action.replace(/[\uff0c\u3002,.]/g, ' ').trim().split(/\s+/)[0]
  return compactAction.slice(0, 20) || '\u5148\u95ee\u5173\u952e\u987e\u8651\u3002'
}

function toWrongDirectionWhisper(context: SalesContext) {
  if (context.objectionType === 'price') {
    return '\u5148\u522b\u6025\u7740\u8ba9\u4ef7\u3002'
  }
  if (context.objectionType === 'competitor') {
    return '\u522b\u653b\u51fb\u7ade\u54c1\u3002'
  }
  return '\u5148\u522b\u6025\u7740\u89e3\u91ca\u3002'
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function isLikelyWrongSalesAnswer(text: string, context: SalesContext) {
  if (context.objectionType === 'price') {
    return containsAny(text, ['\u7ed9\u4f60\u4fbf\u5b9c', '\u964d\u4ef7', '\u6700\u4f4e\u4ef7', '\u6253\u6298', '\u4f18\u60e0\u4e00\u70b9'])
  }

  if (context.objectionType === 'competitor') {
    return containsAny(text, ['\u4ed6\u4eec\u4e0d\u884c', '\u7ade\u54c1\u4e0d\u597d', '\u522b\u4eba\u5bb6\u4e0d\u9760\u8c31', '\u4ed6\u4eec\u5f88\u5dee'])
  }

  return false
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}
