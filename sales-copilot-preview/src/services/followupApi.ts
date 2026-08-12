import type { FollowupCustomerStatus, FollowupIndustry, FollowupResult } from '../types/followup'
import { accessCodeHeaders } from './accessCode'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export type FollowupGenerationQuality = 'standard' | 'premium'

export interface GenerateFollowupRequest {
  industry: FollowupIndustry
  customerStatus: FollowupCustomerStatus
  transcript: string
  quality?: FollowupGenerationQuality
}

export interface ModelFollowupResult extends FollowupResult {
  model?: string
  quality?: FollowupGenerationQuality
}

export async function generateFollowupWithModel(input: GenerateFollowupRequest): Promise<ModelFollowupResult> {
  const response = await fetch(`${API_BASE}/api/followup/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...accessCodeHeaders() },
    body: JSON.stringify({
      ...input,
      quality: input.quality || 'standard',
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `模型生成失败：${response.status}`)
  }

  return response.json() as Promise<ModelFollowupResult>
}
