import type { ConversationEvent } from '../types/conversation'
import type { SalesContext } from '../types/salesContext'
import { createEmptyStrategyRecommendation, type StrategyGenerationResult, type StrategyRecommendation } from '../types/salesStrategy'
import type { SalesStrategyProvider } from './salesStrategyProvider'

const MIN_CONTEXT_CONFIDENCE = 0.5

const keywordGroups = {
  competitor: ['\u7ade\u54c1', '\u53e6\u4e00\u5bb6', '\u522b\u4eba\u5bb6', '\u522b\u5bb6', '\u5bf9\u6bd4', '\u6bd4\u4f60\u4eec', '\u5176\u4ed6\u516c\u53f8', '\u540c\u884c', '隔壁店', '市场里', '网上'],
  budget: ['\u9884\u7b97', '\u8d85\u9884\u7b97', '\u627f\u53d7\u4e0d\u4e86', '\u592a\u8d35', '\u4ef7\u683c\u9ad8', '\u8d35\u4e86', '\u4e70\u4e0d\u8d77', '一平', '每平', '总价', '套餐'],
  discount: ['\u4f18\u60e0', '\u4fbf\u5b9c\u70b9', '\u5c11\u4e00\u70b9', '\u964d\u4ef7', '\u6253\u6298', '\u6700\u4f4e\u591a\u5c11', '\u9001\u4ec0\u4e48', '抹零', '包安装'],
  value: ['\u4e0d\u503c', '\u4ef7\u503c', '\u6548\u679c', '\u5dee\u4e0d\u591a', '\u6ca1\u770b\u51fa', '\u4e00\u6837', '\u533a\u522b', '配置', '型材', '玻璃', '五金', '板材', '封边'],
  afterSales: ['\u552e\u540e', '\u7ef4\u62a4', '\u540e\u7eed', '\u51fa\u95ee\u9898', '\u670d\u52a1', '\u4fdd\u969c', '\u4fdd\u4fee', '质保', '保修', '维修', '安装'],
  trust: ['\u9760\u8c31', '\u4e0d\u653e\u5fc3', '\u4e0d\u76f8\u4fe1', '\u771f\u7684\u5047\u7684', '\u6848\u4f8b', '\u80fd\u4fdd\u8bc1', '\u98ce\u9669', '漏风', '甲醛', '环保', '味道', '变形', '开裂'],
  implementation: ['\u843d\u5730', '\u4e0d\u4f1a\u7528', '\u5b66\u4e0d\u4f1a', '\u9ebb\u70e6', '\u57f9\u8bad', '\u64cd\u4f5c', '\u6267\u884c', '量尺', '安装', '施工', '工期', '验收'],
  timing: ['\u4ee5\u540e\u518d\u8bf4', '\u8fc7\u6bb5\u65f6\u95f4', '\u4e0b\u4e2a\u6708', '\u73b0\u5728\u4e0d\u6025', '\u6682\u65f6', '\u665a\u70b9', '年前', '年后', '供暖前', '入住前'],
  authority: ['\u8001\u677f', '\u9886\u5bfc', '\u5408\u4f19\u4eba', '\u5bb6\u91cc\u4eba', '\u505a\u4e0d\u4e86\u4e3b', '\u5ba1\u6279', '\u518d\u5546\u91cf', '老公', '老婆', '父母', '家里商量'],
  leaving: ['\u518d\u770b\u770b', '\u8003\u8651\u4e00\u4e0b', '\u56de\u5934\u8bf4', '\u5148\u8fd9\u6837', '\u4e0d\u7528\u4e86'],
  buying: ['\u4ed8\u6b3e', '\u5408\u540c', '\u4e0b\u5355', '\u4eca\u5929\u5b9a', '\u53d1\u94fe\u63a5', '\u600e\u4e48\u4e70', '\u7b7e\u7ea6'],
}

export class RuleBasedSalesStrategyProvider implements SalesStrategyProvider {
  generateStrategy(context: SalesContext, events: ConversationEvent[]): StrategyGenerationResult {
    if (context.confidence < MIN_CONTEXT_CONFIDENCE) {
      return none('context_confidence_below_threshold', [`confidence:${context.confidence.toFixed(2)}`])
    }

    const recentCustomerText = getRecentCustomerText(events)

    if (context.customerIntent === 'buying_signal' || containsAny(recentCustomerText, keywordGroups.buying)) {
      return strategy({
        priority: 'high',
        action: '别再增加信息，马上把量尺、到店、定金或下一次确认时间定下来。',
        reason: '客户已经出现推进信号，此时继续介绍容易让决策变复杂。',
        suggestedPhrase: '那我先帮您把下一步定一下，咱是先上门量尺，还是您方便再到店看一眼配置？',
        confidence: Math.max(0.82, context.confidence),
        signals: ['intent:buying_signal', `stage:${context.stage}`],
        coachMessage: '推进下一步。',
      })
    }

    if (context.objectionType === 'price') {
      return priceStrategy(context, recentCustomerText)
    }

    if (context.objectionType === 'competitor') {
      return strategy({
        priority: 'high',
        action: '不要攻击别家，先问客户具体拿什么比：单价、配置、安装、售后还是总价。',
        reason: '客户在做门店对比，重点是把比较口径拉回同一张清单。',
        suggestedPhrase: '您现在主要是比单价，还是比配置、安装和售后？我可以帮您把这几项对齐看。',
        confidence: Math.max(0.78, context.confidence),
        signals: ['objection:competitor', `intent:${context.customerIntent}`],
        coachMessage: '拿回比较标准。',
      })
    }

    if (context.objectionType === 'trust' || context.customerState === 'skeptical') {
      return strategy({
        priority: 'high',
        action: '先别继续承诺，用本地案例、安装流程、质保年限和负责人降低风险感。',
        reason: '客户不是没兴趣，而是担心装完没人管、效果不稳定或材料不放心。',
        suggestedPhrase: '您最不放心的是安装效果、材料环保，还是后面出问题谁负责？我先把这个给您说清楚。',
        confidence: Math.max(0.76, context.confidence),
        signals: ['objection:trust', `state:${context.customerState}`],
        coachMessage: containsAny(recentCustomerText, keywordGroups.afterSales) ? '先讲质保和负责人。' : '先补本地案例。',
      })
    }

    if (context.objectionType === 'need' || containsAny(recentCustomerText, keywordGroups.implementation)) {
      return strategy({
        priority: 'medium',
        action: '停止堆产品名词，把问题拉回客户家里的真实场景、尺寸、使用习惯和安装条件。',
        reason: '客户还没明确为什么必须做，需要先让需求变具体。',
        suggestedPhrase: '如果按您家实际情况看，您最想先解决的是保温、收纳、颜值，还是后期省心？',
        confidence: Math.max(0.72, context.confidence),
        signals: ['objection:need_or_implementation'],
        coachMessage: '问真实使用场景。',
      })
    }

    if (context.objectionType === 'timing' || containsAny(recentCustomerText, keywordGroups.timing)) {
      return strategy({
        priority: 'medium',
        action: '不要只接受“以后再说”，先确认是工期、预算、家人没定，还是时间节点没到。',
        reason: '本地门店客户说以后再说，常常是在回避真实顾虑。',
        suggestedPhrase: '明白，那您是想等时间合适，还是现在主要还有价格、方案或家里人意见没定？',
        confidence: Math.max(0.72, context.confidence),
        signals: ['objection:timing'],
        coachMessage: '问延后真因。',
      })
    }

    if (context.objectionType === 'authority' || containsAny(recentCustomerText, keywordGroups.authority)) {
      return strategy({
        priority: 'medium',
        action: '别让客户自己回家转述，帮他整理一段能直接发给家里人的配置和预算说明。',
        reason: '客户卡在家庭决策，销售要帮他降低转述成本。',
        suggestedPhrase: '家里人最关心价格、质量还是售后？我给您整理一段能直接转发的说明。',
        confidence: Math.max(0.72, context.confidence),
        signals: ['objection:authority'],
        coachMessage: '帮客户转述。',
      })
    }

    if (context.customerState === 'hesitant' || containsAny(recentCustomerText, keywordGroups.leaving)) {
      return strategy({
        priority: context.riskLevel === 'high' ? 'high' : 'medium',
        action: '不要继续追着介绍，先用低压力问题问出客户到底卡在价格、信任、家人还是时间。',
        reason: '客户已经准备拉开距离，要先承接真实顾虑，再发案例或约量尺。',
        suggestedPhrase: '您再考虑没问题，我想先确认一下，您现在主要还卡在价格、质量，还是家里人还没一起看？',
        confidence: Math.max(0.74, context.confidence),
        signals: ['customer_state:hesitant', `risk:${context.riskLevel}`],
        coachMessage: '承接真顾虑。',
      })
    }

    return none('no_strategy_rule_matched', [
      `stage:${context.stage}`,
      `state:${context.customerState}`,
      `intent:${context.customerIntent}`,
      `objection:${context.objectionType}`,
    ])
  }
}

function priceStrategy(context: SalesContext, text: string): StrategyGenerationResult {
  if (containsAny(text, keywordGroups.competitor)) {
    return strategy({
      priority: 'high',
      action: '先别拼价，问清客户拿哪家比，比的是单价、配置、安装还是售后总成本。',
      reason: '客户用别家做价格锚点，需要先把比较口径拉到同一层面。',
      suggestedPhrase: '您方便说一下是和哪家在比吗？咱先把价格里包含的配置、安装和售后对齐。',
      confidence: Math.max(0.82, context.confidence),
      signals: ['objection:price', 'variant:competitor_anchor'],
      coachMessage: '先对齐比较口径。',
    })
  }

  if (containsAny(text, keywordGroups.discount)) {
    return strategy({
      priority: 'high',
      action: '不要马上给优惠，先确认客户今天能不能推进量尺、定金或确定配置。',
      reason: '客户在试探底价，直接让价会让价值感继续下降。',
      suggestedPhrase: '如果价格和配置都合适，您今天能先把量尺或配置方向确认下来吗？',
      confidence: Math.max(0.8, context.confidence),
      signals: ['objection:price', 'variant:discount_probe'],
      coachMessage: '先换成交条件。',
    })
  }

  if (containsAny(text, keywordGroups.budget)) {
    return strategy({
      priority: 'high',
      action: '不要先解释产品，先确认预算线和必须解决的问题，再给两档方案。',
      reason: '客户可能是真预算压力，也可能是没看见配置差异，需要先分清。',
      suggestedPhrase: '您这边大概预算区间是多少？我看哪些必须保留，哪些可以先做经济型。',
      confidence: Math.max(0.79, context.confidence),
      signals: ['objection:price', 'variant:budget_pressure'],
      coachMessage: '先确认预算线。',
    })
  }

  if (containsAny(text, keywordGroups.value)) {
    return strategy({
      priority: 'high',
      action: '先补配置差异，用材料、安装、质保和后期风险帮客户重新算账。',
      reason: '客户不是单纯嫌贵，而是没看见为什么值这个价。',
      suggestedPhrase: '我先不说单价，咱把材料、安装、质保和后面省不省心一起算一下。',
      confidence: Math.max(0.78, context.confidence),
      signals: ['objection:price', 'variant:value_gap'],
      coachMessage: '先补配置差异。',
    })
  }

  return strategy({
    priority: 'high',
    action: '先判断是预算问题还是配置没讲清，不要直接降价。',
    reason: '客户提到价格，但真实卡点还不明确，必须先做诊断。',
    suggestedPhrase: '您觉得贵，主要是预算压力，还是配置差异还没看明白？',
    confidence: Math.max(0.78, context.confidence),
    signals: ['objection:price', 'variant:generic_price'],
    coachMessage: '分清预算还是价值。',
  })
}

function strategy(
  input: Omit<StrategyRecommendation, 'type' | 'updatedAt' | 'metadata'> & {
    signals: string[]
    coachMessage: string
  },
): StrategyGenerationResult {
  const { signals, coachMessage, ...recommendation } = input
  return {
    recommendation: {
      type: 'strategy',
      updatedAt: new Date().toISOString(),
      metadata: {
        provider: 'rule_based',
        coachMessage,
      },
      ...recommendation,
    },
    reason: 'rule_matched',
    signals,
  }
}

function none(reason: string, signals: string[]): StrategyGenerationResult {
  return {
    recommendation: {
      ...createEmptyStrategyRecommendation(),
      reason,
      metadata: {
        provider: 'rule_based',
      },
    },
    reason,
    signals,
  }
}

function getRecentCustomerText(events: ConversationEvent[]) {
  return events
    .filter((event) => event.type === 'transcript_final' && (event.speaker === 'customer' || event.speaker === 'unknown'))
    .slice(-6)
    .map((event) => event.content)
    .join(' ')
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}
