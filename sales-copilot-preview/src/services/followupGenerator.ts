import type { ConversationEvent } from '../types/conversation'
import type {
  FollowupCustomerStatus,
  FollowupIndustry,
  FollowupInput,
  FollowupIntentLevel,
  FollowupPlanOption,
  FollowupResult,
  FollowupSignal,
} from '../types/followup'
import type { ObjectionType, SalesContext } from '../types/salesContext'
import { RuleBasedContextAnalyzer } from './ruleBasedContextAnalyzer'
import { RuleBasedSalesStrategyProvider } from './ruleBasedSalesStrategyProvider'

const industryLabels: Record<FollowupIndustry, string> = {
  windows: '门窗',
  renovation: '装修',
  custom_furniture: '全屋定制',
  building_materials: '建材',
}

const statusLabels: Record<FollowupCustomerStatus, string> = {
  new_inquiry: '刚咨询',
  comparing: '比价中',
  hesitating: '犹豫中',
  ready_to_close: '准备成交',
  silent: '已沉默',
}

const concernText: Record<ObjectionType, string> = {
  price: '客户主要卡在价格和预算，需要把单价比较转成配置、安装、售后和总成本比较。',
  trust: '客户主要担心质量、售后或效果，需要先补案例、流程和保障机制。',
  need: '客户还没有确认必须解决的问题，需要追问使用场景和真实痛点。',
  timing: '客户暂时不急，需要确认具体时间点和拖延背后的顾虑。',
  competitor: '客户正在对比别家，需要先问清比较标准，不要直接降价或攻击同行。',
  authority: '客户可能不是最终决策人，需要帮他整理给家里人或决策人的材料。',
  unknown: '客户关切还不够明确，需要先用低压力问题把真实卡点问出来。',
}

export function generateFollowup(input: FollowupInput): FollowupResult {
  const transcript = input.transcript.trim()
  const events = createEvents(transcript)
  const analyzer = new RuleBasedContextAnalyzer()
  const contextResult = analyzer.analyze(events, {
    sessionId: 'followup_preview',
    stage: 'unknown',
    customerState: 'unknown',
    customerIntent: 'unknown',
    objectionType: 'unknown',
    riskLevel: 'unknown',
    confidence: 0,
    updatedAt: new Date().toISOString(),
  })
  const strategy = new RuleBasedSalesStrategyProvider().generateStrategy(contextResult.context, events).recommendation
  const signals = collectSignals(transcript, contextResult.context, input)
  const primaryConcern = inferPrimaryConcern(transcript, contextResult.context)
  const nextAction = inferNextAction(input, contextResult.context, strategy.action)
  const wechatScript = createWechatScript(input, contextResult.context, primaryConcern)
  const planOptions = createPlanOptions(input.industry, contextResult.context.objectionType)

  return {
    intentLevel: inferIntentLevel(input.customerStatus, contextResult.context),
    primaryConcern,
    currentStage: `${statusLabels[input.customerStatus]} · ${translateStage(contextResult.context.stage)}`,
    missedPoint: inferMissedPoint(input, contextResult.context, transcript),
    nextAction,
    wechatScript,
    planTitle: `${industryLabels[input.industry]}初版方案方向`,
    planOptions,
    signals,
    context: {
      stage: contextResult.context.stage,
      customerState: contextResult.context.customerState,
      customerIntent: contextResult.context.customerIntent,
      objectionType: contextResult.context.objectionType,
      riskLevel: contextResult.context.riskLevel,
      confidence: contextResult.context.confidence,
    },
  }
}

function createEvents(transcript: string): ConversationEvent[] {
  const lines = transcript
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const sourceLines = lines.length > 0 ? lines : [transcript]

  return sourceLines.map((line, index) => {
    const speaker = inferSpeaker(line)
    return {
      id: `followup_${index + 1}`,
      sessionId: 'followup_preview',
      sequence: index + 1,
      timestamp: new Date(Date.now() + index * 1000).toISOString(),
      speaker,
      type: 'transcript_final',
      content: cleanupSpeakerPrefix(line),
      confidence: 0.78,
      metadata: { source: 'followup_text' },
    }
  })
}

function inferSpeaker(line: string): ConversationEvent['speaker'] {
  if (/^(销售|店员|导购|我)[:：]/.test(line)) return 'sales'
  if (/^(客户|顾客|业主|用户)[:：]/.test(line)) return 'customer'
  if (containsAny(line, ['你们', '别人家', '太贵', '多少钱', '再看看', '考虑一下', '回去商量', '有优惠'])) return 'customer'
  if (containsAny(line, ['我们可以', '我帮您', '给您', '建议您', '咱们可以'])) return 'sales'
  return 'unknown'
}

function cleanupSpeakerPrefix(line: string) {
  return line.replace(/^(销售|店员|导购|我|客户|顾客|业主|用户)[:：]\s*/, '')
}

function inferIntentLevel(status: FollowupCustomerStatus, context: SalesContext): FollowupIntentLevel {
  if (status === 'ready_to_close' || context.customerState === 'ready_to_buy' || context.customerIntent === 'buying_signal') return '高意向'
  if (status === 'new_inquiry' && context.objectionType === 'unknown') return '待判断'
  if (status === 'silent' || context.customerIntent === 'leaving') return context.riskLevel === 'high' ? '低意向' : '中意向'
  if (context.customerState === 'price_sensitive' || context.customerState === 'hesitant' || status === 'comparing' || status === 'hesitating') return '中意向'
  if (context.customerState === 'interested') return '中意向'
  return '待判断'
}

function inferPrimaryConcern(transcript: string, context: SalesContext) {
  if (context.objectionType !== 'unknown') return concernText[context.objectionType]
  if (containsAny(transcript, ['漏风', '保温', '隔音', '冷', '结冰'])) return '客户真实痛点可能是保温、隔音或旧窗漏风，不要只围绕单价沟通。'
  if (containsAny(transcript, ['环保', '甲醛', '板材', '味道'])) return '客户担心材料环保和入住风险，需要讲清板材、检测和安装后的处理。'
  if (containsAny(transcript, ['工期', '多久', '什么时候', '安装'])) return '客户关注工期和安装确定性，需要给出清晰流程和时间节点。'
  return concernText.unknown
}

function inferNextAction(input: FollowupInput, context: SalesContext, strategyAction: string) {
  if (input.customerStatus === 'silent') return '先发一条低压力跟进，不催成交，用案例或避坑提醒重新打开对话。'
  if (input.customerStatus === 'ready_to_close') return '不要继续堆信息，马上确认量尺、到店、定金或下一步决策时间。'
  if (strategyAction) return strategyAction
  if (context.objectionType === 'price') return '今天先发同类案例和配置差异，明天再邀约免费量尺或到店确认预算。'
  return '先补问一个关键问题，再发对应案例，不要一次性发太多资料。'
}

function inferMissedPoint(input: FollowupInput, context: SalesContext, transcript: string) {
  if (!containsAny(transcript, ['预算', '多少钱', '价格', '贵'])) return '还没有确认客户预算区间，后续报价容易失焦。'
  if (input.industry === 'windows' && !containsAny(transcript, ['小区', '楼层', '朝向', '漏风', '量尺', '面积'])) {
    return '门窗客户至少要补问小区、楼层、旧窗问题和是否方便量尺。'
  }
  if (input.industry === 'custom_furniture' && !containsAny(transcript, ['户型', '板材', '尺寸', '风格', '收纳'])) {
    return '全屋定制客户要补问户型、收纳需求、板材关注点和安装时间。'
  }
  if (context.objectionType === 'authority') return '客户背后还有决策人，应该整理一段方便转发给家里人的说明。'
  if (context.objectionType === 'competitor') return '客户在比别家，但还没问清他比的是单价、配置、安装还是售后。'
  return '需要把客户的真实卡点收窄到一个问题，下一次沟通才好推进。'
}

function createWechatScript(input: FollowupInput, context: SalesContext, concern: string) {
  const prefix = input.industry === 'windows' ? '姐' : '您好'

  if (context.objectionType === 'price') {
    return `${prefix}，刚才您提到价格，我理解，${industryLabels[input.industry]}不能只看一个单价。不同配置、安装细节和售后保障差别挺大。我先给您按经济型和更省心的标准型整理两套方向，您不用急着定，先看哪套更适合。`
  }

  if (context.objectionType === 'competitor') {
    return `${prefix}，您多对比几家是对的。我建议咱们先把比较口径对齐：配置、安装、售后、总价分别看，这样不容易只被单价带着走。我给您整理一份对比清单，您照着看会更清楚。`
  }

  if (context.objectionType === 'trust') {
    return `${prefix}，您担心质量和后续服务很正常。我先把我们类似客户的案例、安装流程和售后响应方式发您，您先看放心不放心，再决定要不要进一步量尺或看方案。`
  }

  if (input.customerStatus === 'silent') {
    return `${prefix}，我不是催您定，就是想起您这个情况容易在${concern.includes('价格') ? '配置和价格' : '方案细节'}上纠结。我给您整理一个简单对照，您有空看一眼，有不合适的地方我再帮您改。`
  }

  return `${prefix}，刚才聊完我帮您简单整理了一下，您现在最关键的不是马上定，而是先把需求和预算范围对齐。我先给您发一个初版方向，您看完告诉我哪里不符合，我再帮您调整。`
}

function createPlanOptions(industry: FollowupIndustry, objection: ObjectionType): FollowupPlanOption[] {
  if (industry === 'windows') {
    return [
      { title: '经济型', description: '先满足旧窗更换、基础保温和预算控制，适合价格敏感客户。' },
      { title: '保温隔音型', description: '重点放在型材、玻璃、密封和安装，适合临街、北向或漏风客户。' },
      { title: '分区更换', description: '先换卧室、北向或问题最重的窗，降低一次性预算压力。' },
    ]
  }

  if (industry === 'custom_furniture') {
    return [
      { title: '基础收纳型', description: '先解决柜体、尺寸和收纳，控制预算。' },
      { title: '环保耐用型', description: '突出板材、五金、封边和售后，适合有老人孩子的家庭。' },
      { title: '分阶段定制', description: '先做刚需空间，再逐步补充非核心区域。' },
    ]
  }

  if (industry === 'renovation') {
    return [
      { title: '局部改造', description: '先解决最痛的厨房、卫生间、墙面或采光问题。' },
      { title: '标准整装', description: '按预算拆主材、人工、工期和质保，方便客户比较。' },
      { title: '分阶段施工', description: '适合预算谨慎或还没完全确定风格的客户。' },
    ]
  }

  return [
    { title: '基础实用型', description: '先满足刚需功能和预算控制。' },
    { title: '耐用省心型', description: '突出材料、安装、质保和后续维护。' },
    { title: '对比清单', description: objection === 'competitor' ? '把竞品差异拆到配置、服务和总成本。' : '帮助客户把选择标准列清楚。' },
  ]
}

function collectSignals(transcript: string, context: SalesContext, input: FollowupInput): FollowupSignal[] {
  const signals: FollowupSignal[] = [
    { label: '行业', evidence: industryLabels[input.industry] },
    { label: '客户状态', evidence: statusLabels[input.customerStatus] },
  ]

  if (context.objectionType !== 'unknown') signals.push({ label: '主要异议', evidence: translateObjection(context.objectionType) })
  if (containsAny(transcript, ['再看看', '考虑一下', '回去商量'])) signals.push({ label: '流失风险', evidence: '客户出现延后决策表达' })
  if (containsAny(transcript, ['量尺', '什么时候', '上门', '定金', '合同'])) signals.push({ label: '推进信号', evidence: '客户提到下一步动作' })

  return signals
}

function translateStage(stage: SalesContext['stage']) {
  const map: Record<SalesContext['stage'], string> = {
    opening: '初次接触',
    discovery: '需求挖掘',
    solution_presentation: '方案介绍',
    objection_handling: '异议处理',
    pricing: '价格沟通',
    closing: '成交推进',
    unknown: '待判断',
  }
  return map[stage]
}

function translateObjection(objection: ObjectionType) {
  const map: Record<ObjectionType, string> = {
    price: '价格/预算',
    trust: '信任/售后',
    need: '需求不清',
    timing: '时间未定',
    competitor: '对比别家',
    authority: '家里人/决策人',
    unknown: '待判断',
  }
  return map[objection]
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}
