import type { CustomerIntent, CustomerState, ObjectionType, RiskLevel, SalesStage } from './salesContext'

export type FollowupIndustry = 'windows' | 'renovation' | 'custom_furniture' | 'building_materials'

export type FollowupCustomerStatus =
  | 'new_inquiry'
  | 'comparing'
  | 'hesitating'
  | 'ready_to_close'
  | 'silent'

export type FollowupIntentLevel = '高意向' | '中意向' | '低意向' | '待判断'

export interface FollowupInput {
  industry: FollowupIndustry
  customerStatus: FollowupCustomerStatus
  transcript: string
}

export interface FollowupSignal {
  label: string
  evidence: string
}

export interface FollowupPlanOption {
  title: string
  description: string
}

export type DialogueSpeaker = 'sales' | 'customer' | 'unknown' | 'noise'

export interface DialogueMessage {
  id: string
  speaker: DialogueSpeaker
  text: string
  confidence?: number
  timestamp?: string
  source?: 'manual' | 'realtime_asr'
}

export interface FollowupResult {
  intentLevel: FollowupIntentLevel
  primaryConcern: string
  currentStage: string
  missedPoint: string
  nextAction: string
  wechatScript: string
  planTitle: string
  planOptions: FollowupPlanOption[]
  signals: FollowupSignal[]
  context: {
    stage: SalesStage
    customerState: CustomerState
    customerIntent: CustomerIntent
    objectionType: ObjectionType
    riskLevel: RiskLevel
    confidence: number
  }
}
