import type { FollowupCustomerStatus, FollowupIndustry, FollowupResult } from '../types/followup'
import { accessCodeHeaders } from './accessCode'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export type FollowupGenerationQuality = 'standard' | 'premium'
export type AttachmentKind = 'photo' | 'floorplan' | 'quote'

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

export interface AnalyzeAttachmentRequest {
  kind: AttachmentKind
  name: string
  mimeType: string
  dataUrl: string
  note?: string
}

export interface AnalyzeAttachmentResponse {
  summary: string
  model: string
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

export async function analyzeFollowupAttachment(input: AnalyzeAttachmentRequest): Promise<AnalyzeAttachmentResponse> {
  const response = await fetch(`${API_BASE}/api/followup/attachment/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...accessCodeHeaders() },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `图片识别失败：${response.status}`)
  }

  return response.json() as Promise<AnalyzeAttachmentResponse>
}
