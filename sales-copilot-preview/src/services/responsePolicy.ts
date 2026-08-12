import type { ConversationEvent, ResponsePolicy } from '../types/conversation'

export interface ResponsePolicyEvaluator {
  evaluate(event: ConversationEvent): ResponsePolicy
}

export class AsrOnlyResponsePolicyEvaluator implements ResponsePolicyEvaluator {
  evaluate(event: ConversationEvent): ResponsePolicy {
    return {
      canRespond: false,
      reason: 'ASR_ONLY_PHASE',
      priority: 'none',
      mode: 'silent',
      allowedEventTypes: [],
      metadata: {
        sourceEventId: event.id,
      },
    }
  }
}

export const ASR_ONLY_RESPONSE_POLICY: ResponsePolicy = {
  canRespond: false,
  reason: 'ASR_ONLY_PHASE',
  priority: 'none',
  mode: 'silent',
  allowedEventTypes: [],
}
