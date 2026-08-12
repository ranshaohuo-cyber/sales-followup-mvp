import type { ConversationEvent, ConversationSpeaker } from '../types/conversation'
import type { ContextAnalyzer } from './contextAnalyzer'
import type {
  CustomerIntent,
  CustomerState,
  ObjectionType,
  RiskLevel,
  SalesContext,
  SalesContextAnalysisResult,
  SalesStage,
} from '../types/salesContext'

type ScoreMap<T extends string> = Record<T, number>

interface Rule<T extends string> {
  target: T
  keywords: string[]
  weight: number
  speaker?: ConversationSpeaker
  signal: string
}

const CONFIDENCE_THRESHOLD = 0.5
const WINDOW_SIZE = 12

const stageRules: Array<Rule<SalesStage>> = [
  { target: 'opening', keywords: ['\u4f60\u597d', '\u60a8\u597d', '\u5728\u5417', '\u65b9\u4fbf', '\u8ba4\u8bc6\u4e00\u4e0b', '\u7b2c\u4e00\u6b21'], weight: 0.45, signal: 'opening_phrase' },
  { target: 'discovery', keywords: ['\u9700\u6c42', '\u75db\u70b9', '\u76ee\u524d', '\u73b0\u5728', '\u4e3b\u8981\u662f', '\u60f3\u89e3\u51b3', '\u9884\u7b97\u8303\u56f4', '\u4f7f\u7528\u573a\u666f', '小区', '楼层', '朝向', '面积', '尺寸', '户型', '漏风', '隔音', '保温', '采光', '收纳'], weight: 0.55, signal: 'discovery_phrase' },
  { target: 'solution_presentation', keywords: ['\u65b9\u6848', '\u529f\u80fd', '\u670d\u52a1', '\u4ea4\u4ed8', '\u914d\u7f6e', '\u4f18\u52bf', '\u6211\u4eec\u53ef\u4ee5', '\u89e3\u51b3\u65b9\u6848', '断桥铝', '型材', '玻璃', '五金', '密封', '板材', '封边', '柜体', '设计图', '效果图', '施工'], weight: 0.55, signal: 'solution_phrase' },
  { target: 'objection_handling', keywords: ['\u62c5\u5fc3', '\u4e0d\u592a\u76f8\u4fe1', '\u9760\u8c31\u5417', '\u4e0d\u4f1a\u7528', '\u843d\u5730', '\u9ebb\u70e6', '\u98ce\u9669', '\u552e\u540e', '\u518d\u8003\u8651', '质保', '保修', '安装', '工期', '甲醛', '环保', '味道', '变形', '开裂'], weight: 0.65, signal: 'objection_phrase' },
  { target: 'pricing', keywords: ['\u4ef7\u683c', '\u591a\u5c11\u94b1', '\u62a5\u4ef7', '\u8d35', '\u9ad8\u4e0d\u5c11', '\u6bd4\u522b\u4eba\u9ad8', '\u4fbf\u5b9c', '\u9884\u7b97', '\u4f18\u60e0', '\u6298\u6263', '\u8d39\u7528', '一平', '每平', '总价', '套餐', '定金', '低价'], weight: 0.7, signal: 'pricing_phrase' },
  { target: 'closing', keywords: ['\u5408\u540c', '\u4ed8\u6b3e', '\u4e0b\u5355', '\u4eca\u5929\u5b9a', '\u4ec0\u4e48\u65f6\u5019\u5f00\u59cb', '\u53d1\u94fe\u63a5', '\u600e\u4e48\u8d2d\u4e70', '\u7b7e\u7ea6', '上门', '量尺', '交定金', '排工期', '定下来'], weight: 0.75, signal: 'closing_phrase' },
]

const customerStateRules: Array<Rule<CustomerState>> = [
  { target: 'interested', keywords: ['\u4e0d\u9519', '\u633a\u597d', '\u6709\u5174\u8da3', '\u53ef\u4ee5\u4e86\u89e3', '\u60f3\u770b\u770b', '\u600e\u4e48\u505a'], weight: 0.6, speaker: 'customer', signal: 'interest' },
  { target: 'hesitant', keywords: ['\u8003\u8651\u4e00\u4e0b', '\u518d\u770b\u770b', '\u56de\u5934\u8bf4', '\u7ea0\u7ed3', '\u4e0d\u786e\u5b9a', '\u5148\u8fd9\u6837'], weight: 0.75, speaker: 'customer', signal: 'hesitation' },
  { target: 'price_sensitive', keywords: ['\u8d35', '\u4ef7\u683c\u9ad8', '\u592a\u8d35', '\u9884\u7b97', '\u4fbf\u5b9c', '\u4f18\u60e0', '\u6298\u6263'], weight: 0.85, speaker: 'customer', signal: 'price_sensitive' },
  { target: 'skeptical', keywords: ['\u9760\u8c31\u5417', '\u771f\u7684\u5047\u7684', '\u80fd\u4fdd\u8bc1\u5417', '\u4e0d\u592a\u76f8\u4fe1', '\u4e0d\u653e\u5fc3', '\u552e\u540e', '\u4fdd\u969c', '\u6848\u4f8b', '\u6548\u679c\u600e\u4e48\u6837', '质保', '保修', '安装', '甲醛', '环保', '售后'], weight: 0.75, speaker: 'customer', signal: 'skeptical' },
  { target: 'ready_to_buy', keywords: ['\u4ed8\u6b3e', '\u5408\u540c', '\u4e0b\u5355', '\u4eca\u5929\u5b9a', '\u4ec0\u4e48\u65f6\u5019\u5f00\u59cb', '\u53d1\u94fe\u63a5'], weight: 0.85, speaker: 'customer', signal: 'ready_to_buy' },
  { target: 'neutral', keywords: ['\u4e86\u89e3', '\u770b\u770b', '\u53ef\u4ee5', '\u55ef', '\u597d\u7684'], weight: 0.35, speaker: 'customer', signal: 'neutral' },
]

const intentRules: Array<Rule<CustomerIntent>> = [
  { target: 'asking_information', keywords: ['\u662f\u4ec0\u4e48', '\u600e\u4e48', '\u591a\u5c11', '\u591a\u4e45', '\u6709\u54ea\u4e9b', '\u80fd\u4e0d\u80fd\u4ecb\u7ecd', '多少钱一平', '怎么量', '多久装完', '什么材质', '什么板材'], weight: 0.55, speaker: 'customer', signal: 'asking_information' },
  { target: 'comparing', keywords: ['\u53e6\u4e00\u5bb6', '\u7ade\u54c1', '\u522b\u4eba\u5bb6', '\u522b\u4eba', '\u5bf9\u6bd4', '\u6bd4\u4f60\u4eec', '\u6bd4\u522b\u4eba', '\u5dee\u4e0d\u591a', '\u5176\u4ed6\u516c\u53f8', '\u540c\u884c'], weight: 0.85, speaker: 'customer', signal: 'comparing' },
  { target: 'objecting', keywords: ['\u4f46\u662f', '\u53ef\u662f', '\u8d35', '\u62c5\u5fc3', '\u4e0d\u9700\u8981', '\u4e0d\u76f8\u4fe1', '\u4e0d\u4f1a\u7528', '\u9ebb\u70e6'], weight: 0.75, speaker: 'customer', signal: 'objecting' },
  { target: 'negotiating', keywords: ['\u4f18\u60e0', '\u6298\u6263', '\u4fbf\u5b9c\u70b9', '\u80fd\u4e0d\u80fd\u5c11', '\u9001\u4ec0\u4e48', '\u6700\u4f4e\u591a\u5c11'], weight: 0.85, speaker: 'customer', signal: 'negotiating' },
  { target: 'buying_signal', keywords: ['\u4ed8\u6b3e', '\u5408\u540c', '\u4e0b\u5355', '\u4eca\u5929\u5b9a', '\u4ec0\u4e48\u65f6\u5019\u5f00\u59cb', '\u53d1\u94fe\u63a5'], weight: 0.9, speaker: 'customer', signal: 'buying_signal' },
  { target: 'leaving', keywords: ['\u518d\u770b\u770b', '\u8003\u8651\u4e00\u4e0b', '\u4ee5\u540e\u518d\u8bf4', '\u56de\u5934\u8bf4', '\u5148\u8fd9\u6837', '\u4e0d\u7528\u4e86'], weight: 0.85, speaker: 'customer', signal: 'leaving' },
]

const objectionRules: Array<Rule<ObjectionType>> = [
  { target: 'price', keywords: ['\u4ef7\u683c', '\u8d35', '\u592a\u8d35', '\u9ad8\u4e0d\u5c11', '\u6bd4\u522b\u4eba\u9ad8', '\u9884\u7b97', '\u4fbf\u5b9c', '\u4f18\u60e0', '\u6298\u6263', '\u8d39\u7528', '一平', '每平', '总价', '套餐', '低价'], weight: 0.9, speaker: 'customer', signal: 'price_objection' },
  { target: 'trust', keywords: ['\u9760\u8c31\u5417', '\u771f\u7684\u5047\u7684', '\u6848\u4f8b', '\u80fd\u4fdd\u8bc1\u5417', '\u4e0d\u76f8\u4fe1', '\u4e0d\u653e\u5fc3', '\u552e\u540e', '\u540e\u7eed', '\u670d\u52a1', '\u4fdd\u969c', '\u6548\u679c\u600e\u4e48\u6837', '质保', '保修', '安装不好', '漏风', '甲醛', '环保', '味道', '变形', '开裂'], weight: 0.85, speaker: 'customer', signal: 'trust_objection' },
  { target: 'need', keywords: ['\u4e0d\u9700\u8981', '\u7528\u4e0d\u4e0a', '\u6ca1\u5fc5\u8981', '\u4e0d\u4f1a\u7528', '\u843d\u5730', '\u57f9\u8bad'], weight: 0.75, speaker: 'customer', signal: 'need_objection' },
  { target: 'timing', keywords: ['\u73b0\u5728\u4e0d\u6025', '\u4ee5\u540e\u518d\u8bf4', '\u8fc7\u6bb5\u65f6\u95f4', '\u4e0b\u4e2a\u6708', '\u6682\u65f6', '年前', '年后', '入住前', '供暖前', '等装修'], weight: 0.75, speaker: 'customer', signal: 'timing_objection' },
  { target: 'competitor', keywords: ['\u53e6\u4e00\u5bb6', '\u7ade\u54c1', '\u522b\u4eba\u5bb6', '\u522b\u4eba', '\u5bf9\u6bd4', '\u6bd4\u4f60\u4eec', '\u6bd4\u522b\u4eba', '\u5176\u4ed6\u516c\u53f8', '\u540c\u884c'], weight: 0.85, speaker: 'customer', signal: 'competitor_objection' },
  { target: 'authority', keywords: ['\u8001\u677f\u51b3\u5b9a', '\u9886\u5bfc', '\u5408\u4f19\u4eba', '\u5bb6\u91cc\u4eba', '\u6211\u505a\u4e0d\u4e86\u4e3b', '\u9700\u8981\u5ba1\u6279'], weight: 0.8, speaker: 'customer', signal: 'authority_objection' },
]

export class RuleBasedContextAnalyzer implements ContextAnalyzer {
  analyze(events: ConversationEvent[], currentContext: SalesContext): SalesContextAnalysisResult {
    const transcriptEvents = events
      .filter((event) => event.type === 'transcript_final')
      .slice(-WINDOW_SIZE)

    if (transcriptEvents.length === 0) {
      return {
        context: withUnknown(currentContext, 'no_final_transcript'),
        reason: 'no_final_transcript',
        signals: [],
      }
    }

    const signals: string[] = []
    const stageScores = createScores<SalesStage>(['opening', 'discovery', 'solution_presentation', 'objection_handling', 'pricing', 'closing', 'unknown'])
    const stateScores = createScores<CustomerState>(['interested', 'neutral', 'hesitant', 'price_sensitive', 'skeptical', 'ready_to_buy', 'unknown'])
    const intentScores = createScores<CustomerIntent>(['asking_information', 'comparing', 'objecting', 'negotiating', 'buying_signal', 'leaving', 'unknown'])
    const objectionScores = createScores<ObjectionType>(['price', 'trust', 'need', 'timing', 'competitor', 'authority', 'unknown'])

    transcriptEvents.forEach((event, index) => {
      const recency = 0.55 + ((index + 1) / transcriptEvents.length) * 0.45
      applyRules(stageScores, stageRules, event, recency, signals)
      applyRules(stateScores, customerStateRules, event, recency, signals)
      applyRules(intentScores, intentRules, event, recency, signals)
      applyRules(objectionScores, objectionRules, event, recency, signals)
    })

    applyContextHints(transcriptEvents, stageScores, stateScores, intentScores, objectionScores, signals)
    dampenWeakSingleTurnSignals(transcriptEvents, stageScores, stateScores, intentScores, objectionScores, signals)

    const stagePick = pick(stageScores, currentContext.stage)
    const statePick = pick(stateScores, currentContext.customerState)
    const intentPick = pick(intentScores, currentContext.customerIntent)
    const objectionPick = pick(objectionScores, currentContext.objectionType)
    const confidence = clamp01((stagePick.confidence * 0.35) + (statePick.confidence * 0.25) + (intentPick.confidence * 0.25) + (objectionPick.confidence * 0.15))

    if (confidence < CONFIDENCE_THRESHOLD) {
      return {
        context: {
          ...currentContext,
          stage: 'unknown',
          customerState: 'unknown',
          customerIntent: 'unknown',
          objectionType: 'unknown',
          riskLevel: 'unknown',
          confidence,
          updatedAt: new Date().toISOString(),
          metadata: {
            analyzer: 'rule_based',
            reason: 'confidence_below_threshold',
            scores: {
              stage: stageScores,
              customerState: stateScores,
              customerIntent: intentScores,
              objectionType: objectionScores,
            },
          },
        },
        reason: 'confidence_below_threshold',
        signals: unique(signals),
      }
    }

    const context: SalesContext = {
      sessionId: currentContext.sessionId,
      stage: stagePick.value,
      customerState: statePick.value,
      customerIntent: intentPick.value,
      objectionType: objectionPick.value,
      riskLevel: inferRiskLevel(statePick.value, intentPick.value, objectionPick.value),
      confidence,
      updatedAt: new Date().toISOString(),
      metadata: {
        analyzer: 'rule_based',
        reason: 'rule_scores_above_threshold',
        scores: {
          stage: stageScores,
          customerState: stateScores,
          customerIntent: intentScores,
          objectionType: objectionScores,
        },
      },
    }

    return {
      context,
      reason: 'rule_scores_above_threshold',
      signals: unique(signals),
    }
  }
}

function dampenWeakSingleTurnSignals(
  events: ConversationEvent[],
  stageScores: ScoreMap<SalesStage>,
  stateScores: ScoreMap<CustomerState>,
  intentScores: ScoreMap<CustomerIntent>,
  objectionScores: ScoreMap<ObjectionType>,
  signals: string[],
) {
  if (events.length > 1) {
    return
  }

  const onlyText = events[0]?.content || ''
  const isBarePriceQuestion = containsAny(onlyText, ['\u591a\u5c11\u94b1', '\u4ef7\u683c\u591a\u5c11', '\u4ec0\u4e48\u4ef7\u683c']) &&
    !containsAny(onlyText, ['\u8d35', '\u592a\u8d35', '\u9884\u7b97', '\u53e6\u4e00\u5bb6', '\u7ade\u54c1', '\u4f18\u60e0', '\u6298\u6263'])

  if (!isBarePriceQuestion) {
    return
  }

  stageScores.pricing *= 0.45
  stateScores.price_sensitive *= 0.3
  intentScores.asking_information += 0.25
  objectionScores.price *= 0.25
  signals.push('dampen:bare_price_question_without_context')
}

function applyRules<T extends string>(
  scores: ScoreMap<T>,
  rules: Array<Rule<T>>,
  event: ConversationEvent,
  recency: number,
  signals: string[],
) {
  const text = event.content.toLowerCase()
  rules.forEach((rule) => {
    if (!speakerMatches(rule.speaker, event.speaker)) {
      return
    }

    const matches = rule.keywords.filter((keyword) => text.includes(keyword.toLowerCase()))
    if (matches.length === 0) {
      return
    }

    const speakerWeight = event.speaker === 'customer' ? 1.15 : event.speaker === 'sales' ? 0.8 : 1
    const multiMatchBoost = Math.min(1.35, 1 + (matches.length - 1) * 0.12)
    scores[rule.target] += rule.weight * recency * speakerWeight * multiMatchBoost
    signals.push(`${rule.signal}:${matches.join(',')}`)
  })
}

function speakerMatches(ruleSpeaker: ConversationSpeaker | undefined, eventSpeaker: ConversationSpeaker) {
  if (!ruleSpeaker) {
    return true
  }
  if (ruleSpeaker === eventSpeaker) {
    return true
  }
  return ruleSpeaker === 'customer' && eventSpeaker === 'unknown'
}

function applyContextHints(
  events: ConversationEvent[],
  stageScores: ScoreMap<SalesStage>,
  stateScores: ScoreMap<CustomerState>,
  intentScores: ScoreMap<CustomerIntent>,
  objectionScores: ScoreMap<ObjectionType>,
  signals: string[],
) {
  const customerEvents = events.filter((event) => event.speaker === 'customer' || event.speaker === 'unknown')
  const salesEvents = events.filter((event) => event.speaker === 'sales')
  const combinedCustomerText = customerEvents.map((event) => event.content).join(' ')
  const combinedSalesText = salesEvents.map((event) => event.content).join(' ')

  if (containsAny(combinedCustomerText, ['\u4ef7\u683c', '\u8d35', '\u9884\u7b97', '\u9ad8\u4e0d\u5c11', '\u6bd4\u522b\u4eba\u9ad8']) && containsAny(combinedCustomerText, ['\u53e6\u4e00\u5bb6', '\u7ade\u54c1', '\u522b\u4eba\u5bb6', '\u522b\u4eba', '\u5bf9\u6bd4'])) {
    stageScores.pricing += 0.65
    stateScores.price_sensitive += 0.65
    intentScores.objecting += 0.45
    intentScores.comparing += 0.35
    objectionScores.price += 0.6
    objectionScores.competitor += 0.35
    signals.push('compound:price_competitor_objection')
  }

  if (containsAny(combinedSalesText, ['\u9700\u6c42', '\u75db\u70b9', '\u76ee\u524d']) && containsAny(combinedCustomerText, ['\u60f3', '\u9700\u8981', '\u95ee\u9898', '\u73b0\u5728'])) {
    stageScores.discovery += 0.45
    intentScores.asking_information += 0.25
    signals.push('compound:discovery_dialogue')
  }

  if (containsAny(combinedSalesText, ['\u65b9\u6848', '\u529f\u80fd', '\u670d\u52a1', '\u4ea4\u4ed8']) && containsAny(combinedCustomerText, ['\u600e\u4e48', '\u80fd\u4e0d\u80fd', '\u6709\u54ea\u4e9b'])) {
    stageScores.solution_presentation += 0.45
    stateScores.interested += 0.25
    intentScores.asking_information += 0.3
    signals.push('compound:solution_interest')
  }

  if (containsAny(combinedCustomerText, ['\u8003\u8651\u4e00\u4e0b', '\u518d\u770b\u770b', '\u56de\u5934\u8bf4', '\u5148\u8fd9\u6837'])) {
    stateScores.hesitant += 0.55
    intentScores.leaving += 0.55
    signals.push('compound:hesitation_risk')
  }

  if (containsAny(combinedCustomerText, ['\u5408\u540c', '\u4ed8\u6b3e', '\u4e0b\u5355', '\u53d1\u94fe\u63a5'])) {
    stageScores.closing += 0.6
    stateScores.ready_to_buy += 0.55
    intentScores.buying_signal += 0.55
    signals.push('compound:buying_signal')
  }

  if (containsAny(combinedCustomerText, ['漏风', '保温', '隔音', '冷', '结冰']) && containsAny(combinedCustomerText, ['多少钱', '一平', '价格', '贵'])) {
    stageScores.pricing += 0.45
    stageScores.discovery += 0.25
    stateScores.price_sensitive += 0.35
    objectionScores.price += 0.35
    objectionScores.trust += 0.25
    signals.push('compound:local_window_pain_price')
  }

  if (containsAny(combinedCustomerText, ['板材', '环保', '甲醛', '味道', '封边']) && containsAny(combinedCustomerText, ['孩子', '老人', '入住', '放心'])) {
    stageScores.objection_handling += 0.45
    stateScores.skeptical += 0.45
    objectionScores.trust += 0.45
    signals.push('compound:custom_furniture_material_trust')
  }

  if (containsAny(combinedCustomerText, ['量尺', '上门', '什么时候能来', '什么时候装']) || containsAny(combinedSalesText, ['免费量尺', '上门看', '先量一下'])) {
    stageScores.closing += 0.35
    intentScores.buying_signal += 0.3
    stateScores.interested += 0.25
    signals.push('compound:measure_visit_next_step')
  }
}

function createScores<T extends string>(keys: T[]): ScoreMap<T> {
  return keys.reduce((scores, key) => {
    scores[key] = 0
    return scores
  }, {} as ScoreMap<T>)
}

function pick<T extends string>(scores: ScoreMap<T>, previous: T) {
  const entries = Object.entries(scores) as Array<[T, number]>
  const [value, score] = entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best), entries[0])
  const total = entries.reduce((sum, entry) => sum + entry[1], 0)
  const confidence = total <= 0 ? 0 : clamp01(score / Math.max(total, 1.2))

  if (confidence < CONFIDENCE_THRESHOLD && previous !== 'unknown') {
    return {
      value: previous,
      confidence: Math.max(confidence, 0.45),
    }
  }

  return {
    value,
    confidence,
  }
}

function inferRiskLevel(state: CustomerState, intent: CustomerIntent, objection: ObjectionType): RiskLevel {
  if (intent === 'leaving' || state === 'hesitant') {
    return 'high'
  }
  if (state === 'price_sensitive' || state === 'skeptical' || objection !== 'unknown') {
    return 'medium'
  }
  if (state === 'ready_to_buy' || intent === 'buying_signal' || state === 'interested') {
    return 'low'
  }
  return 'unknown'
}

function withUnknown(currentContext: SalesContext, reason: string): SalesContext {
  return {
    ...currentContext,
    stage: 'unknown',
    customerState: 'unknown',
    customerIntent: 'unknown',
    objectionType: 'unknown',
    riskLevel: 'unknown',
    confidence: 0,
    updatedAt: new Date().toISOString(),
    metadata: {
      analyzer: 'rule_based',
      reason,
    },
  }
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function unique(values: string[]) {
  return Array.from(new Set(values))
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}
