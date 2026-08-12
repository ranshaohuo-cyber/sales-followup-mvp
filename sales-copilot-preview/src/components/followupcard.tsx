import { useState } from 'react'
import {
  CheckCircle2,
  Clipboard,
  Copy,
  FileText,
  Hammer,
  Home,
  MessageSquareText,
  RotateCcw,
  Sparkles,
  Store,
  Wand2,
} from 'lucide-react'
import ReceptionRecorder from './receptionrecorder'
import { generateFollowupWithModel, type FollowupGenerationQuality } from '../services/followupApi'
import { generateFollowup } from '../services/followupGenerator'
import type { DialogueMessage, DialogueSpeaker, FollowupCustomerStatus, FollowupIndustry, FollowupResult } from '../types/followup'

const industries: Array<{ id: FollowupIndustry; label: string; icon: React.ReactNode }> = [
  { id: 'windows', label: '门窗', icon: <Home size={16} /> },
  { id: 'renovation', label: '装修', icon: <Hammer size={16} /> },
  { id: 'custom_furniture', label: '全屋定制', icon: <Store size={16} /> },
  { id: 'building_materials', label: '建材', icon: <FileText size={16} /> },
]

const statuses: Array<{ id: FollowupCustomerStatus; label: string }> = [
  { id: 'new_inquiry', label: '刚咨询' },
  { id: 'comparing', label: '比价中' },
  { id: 'hesitating', label: '犹豫中' },
  { id: 'ready_to_close', label: '准备成交' },
  { id: 'silent', label: '已沉默' },
]

const sampleTranscript = [
  '客户：我家龙沙区老房子，冬天窗户漏风，想换一下。',
  '客户：你们断桥铝多少钱一平？太贵的话我就再看看。',
  '销售：价格要看具体面积和配置，我们这边质量和售后都挺好的。',
  '客户：我还得回去跟家里人商量一下，也想再看看别人家的。',
].join('\n')

export default function FollowupCard() {
  const [industry, setIndustry] = useState<FollowupIndustry>('windows')
  const [customerStatus, setCustomerStatus] = useState<FollowupCustomerStatus>('new_inquiry')
  const [transcript, setTranscript] = useState('')
  const [messages, setMessages] = useState<DialogueMessage[]>([])
  const [draftSpeaker, setDraftSpeaker] = useState<Exclude<DialogueSpeaker, 'noise' | 'unknown'>>('customer')
  const [draftText, setDraftText] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [result, setResult] = useState<FollowupResult | null>(null)
  const [resultMeta, setResultMeta] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [generationQuality, setGenerationQuality] = useState<FollowupGenerationQuality>('standard')
  const [copied, setCopied] = useState(false)

  const canGenerate = transcript.trim().length >= 8

  function handleGenerate() {
    void generateFromTranscript(transcript)
  }

  async function generateFromTranscript(sourceTranscript: string) {
    if (sourceTranscript.trim().length < 8) return
    setCopied(false)
    setGenerationError('')
    setResultMeta('')
    setIsGenerating(true)

    try {
      const modelResult = await generateFollowupWithModel({
        industry,
        customerStatus,
        transcript: sourceTranscript,
        quality: generationQuality,
      })
      setResult(modelResult)
      setResultMeta(modelResult.model ? `模型生成：${modelResult.model}` : '模型生成')
    } catch (error) {
      const fallback = generateFollowup({ industry, customerStatus, transcript: sourceTranscript })
      setResult(fallback)
      setResultMeta('本地规则兜底')
      setGenerationError(error instanceof Error ? error.message : '模型生成失败，已使用本地规则兜底')
    } finally {
      setIsGenerating(false)
    }
  }

  function handleMessagesChange(nextMessages: DialogueMessage[]) {
    setMessages(nextMessages)
    const nextTranscript = messagesToTranscript(nextMessages)
    setTranscript(nextTranscript)
    if (!nextTranscript.trim()) setResult(null)
  }

  function handleRecorderFinish(nextMessages: DialogueMessage[]) {
    const nextTranscript = messagesToTranscript(nextMessages)
    setMessages(nextMessages)
    setTranscript(nextTranscript)
    void generateFromTranscript(nextTranscript)
  }

  function addDraftMessage() {
    const text = draftText.trim()
    if (!text) return
    const nextMessages = [
      ...messages,
      {
        id: `manual_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        speaker: draftSpeaker,
        text,
        timestamp: new Date().toISOString(),
        source: 'manual' as const,
      },
    ]
    setDraftText('')
    handleMessagesChange(nextMessages)
  }

  function importBulkText() {
    const parsed = parseBulkText(bulkText)
    if (parsed.length === 0) return
    setBulkText('')
    handleMessagesChange([...messages, ...parsed])
  }

  function removeMessage(id: string) {
    handleMessagesChange(messages.filter((message) => message.id !== id))
  }

  async function copyWechatScript() {
    if (!result) return
    await navigator.clipboard.writeText(result.wechatScript)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  function reset() {
    setTranscript('')
    setMessages([])
    setDraftText('')
    setBulkText('')
    setResult(null)
    setResultMeta('')
    setGenerationError('')
    setIsGenerating(false)
    setCopied(false)
  }

  return (
    <div className="min-h-full bg-surface px-4 pb-4 pt-3">
      <section className="mb-4 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">客户离店跟进卡</h1>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">把刚才客户说的话放进来，马上整理下一步怎么追。</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Wand2 size={20} />
          </div>
        </div>

        <div className="space-y-3">
          <ControlBlock label="行业">
            <div className="grid grid-cols-4 gap-2">
              {industries.map((item) => {
                const active = industry === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIndustry(item.id)}
                    className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-lg border px-1 text-xs font-semibold transition-colors ${
                      active ? 'border-primary-500 bg-blue-50 text-primary-600' : 'border-gray-100 bg-gray-50 text-gray-500'
                    }`}
                  >
                    {item.icon}
                    <span className="leading-none">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </ControlBlock>

          <ControlBlock label="客户状态">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
              {statuses.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => setCustomerStatus(status.id)}
                  className={`min-h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors ${
                    customerStatus === status.id ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-200 bg-white text-gray-500'
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </ControlBlock>

          <ControlBlock label="生成模型">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGenerationQuality('standard')}
                className={`min-h-10 rounded-lg border px-2 text-xs font-bold ${
                  generationQuality === 'standard' ? 'border-primary-500 bg-blue-50 text-primary-600' : 'border-gray-100 bg-gray-50 text-gray-500'
                }`}
              >
                日常跟进 · qwen-plus
              </button>
              <button
                type="button"
                onClick={() => setGenerationQuality('premium')}
                className={`min-h-10 rounded-lg border px-2 text-xs font-bold ${
                  generationQuality === 'premium' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-100 bg-gray-50 text-gray-500'
                }`}
              >
                高价值客户 · qwen-max
              </button>
            </div>
          </ControlBlock>

          <ReceptionRecorder
            onMessagesChange={handleMessagesChange}
            onFinish={handleRecorderFinish}
          />

          <ControlBlock label="接待记录">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-3 max-h-72 space-y-3 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="py-6 text-center">
                    <MessageSquareText size={26} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm font-semibold text-gray-500">还没有接待消息</p>
                    <p className="mt-1 text-xs text-gray-400">左边客户，右边销售，像微信一样看。</p>
                  </div>
                ) : null}
                {messages.map((message) => (
                  <ChatBubble key={message.id} message={message} onRemove={removeMessage} />
                ))}
              </div>

              <div className="rounded-lg bg-white p-2">
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftSpeaker('customer')}
                    className={`min-h-8 rounded-lg text-xs font-bold ${draftSpeaker === 'customer' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'}`}
                  >
                    客户说
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftSpeaker('sales')}
                    className={`min-h-8 rounded-lg text-xs font-bold ${draftSpeaker === 'sales' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}
                  >
                    销售说
                  </button>
                </div>
                <textarea
                  value={draftText}
                  onChange={(event) => setDraftText(event.target.value)}
                  placeholder="输入一句话，点添加..."
                  className="min-h-[62px] w-full resize-none rounded-lg bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-800 outline-none placeholder:text-gray-300"
                />
                <button
                  type="button"
                  onClick={addDraftMessage}
                  className="mt-2 min-h-9 w-full rounded-lg bg-gray-900 text-xs font-bold text-white"
                >
                  添加到聊天
                </button>
              </div>
            </div>

            <div className="mt-2 rounded-lg border border-gray-200 bg-white p-2">
              <textarea
                value={bulkText}
                onChange={(event) => setBulkText(event.target.value)}
                placeholder="也可以一次粘贴整段微信聊天，支持“客户：...” “销售：...”"
                className="min-h-[72px] w-full resize-none bg-transparent text-xs leading-relaxed text-gray-700 outline-none placeholder:text-gray-300"
              />
              <button
                type="button"
                onClick={importBulkText}
                className="mt-2 min-h-8 w-full rounded-lg bg-blue-50 text-xs font-bold text-primary-600"
              >
                导入粘贴内容
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleMessagesChange(parseBulkText(sampleTranscript))}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600"
              >
                <Clipboard size={14} />
                填入示例
              </button>
              <button
                type="button"
                onClick={reset}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600"
              >
                <RotateCcw size={14} />
                清空
              </button>
            </div>
          </ControlBlock>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors ${
              canGenerate && !isGenerating ? 'bg-primary-500 text-white active:bg-primary-600' : 'bg-gray-200 text-gray-400'
            }`}
          >
            <Sparkles size={17} />
            {isGenerating ? '模型生成中...' : '生成跟进卡'}
          </button>
          {generationError ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">模型暂不可用，已用本地规则生成。{resultMeta ? ` ${resultMeta}` : ''}</p>
          ) : resultMeta ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{resultMeta}</p>
          ) : null}
        </div>
      </section>

      {result ? (
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ResultCard label="意向等级" value={result.intentLevel} tone={intentTone(result.intentLevel)} />
            <ResultCard label="当前阶段" value={result.currentStage} />
          </div>

          <TextCard icon={<MessageSquareText size={16} />} title="客户最关心什么" text={result.primaryConcern} />
          <TextCard icon={<CheckCircle2 size={16} />} title="销售漏掉的关键点" text={result.missedPoint} />
          <TextCard icon={<Sparkles size={16} />} title="下一步动作" text={result.nextAction} highlight />

          <section className="rounded-lg border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-gray-900">可复制微信话术</h2>
              <button
                type="button"
                onClick={copyWechatScript}
                className="flex min-h-8 shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2 text-xs font-semibold text-emerald-600"
              >
                <Copy size={13} />
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{result.wechatScript}</p>
          </section>

          <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-gray-900">{result.planTitle}</h2>
            <div className="space-y-2">
              {result.planOptions.map((option) => (
                <div key={option.title} className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-sm font-semibold text-gray-800">{option.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{option.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-bold text-gray-900">识别信号</h2>
            <div className="flex flex-wrap gap-2">
              {result.signals.map((signal) => (
                <span key={`${signal.label}_${signal.evidence}`} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-primary-600">
                  {signal.label}：{signal.evidence}
                </span>
              ))}
            </div>
          </section>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-8 text-center">
          <MessageSquareText size={28} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-semibold text-gray-500">还没有生成跟进卡</p>
          <p className="mt-1 text-xs text-gray-400">先粘贴一段客户聊天或接待记录。</p>
        </section>
      )}
    </div>
  )
}

function ChatBubble({ message, onRemove }: { message: DialogueMessage; onRemove: (id: string) => void }) {
  const isSales = message.speaker === 'sales'
  return (
    <div className={`flex ${isSales ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[82%] ${isSales ? 'text-right' : 'text-left'}`}>
        <div className="mb-1 text-[10px] font-semibold text-gray-400">{dialogueSpeakerLabel(message.speaker)}</div>
        <button
          type="button"
          onDoubleClick={() => onRemove(message.id)}
          title="双击删除"
          className={`rounded-lg px-3 py-2 text-left text-sm leading-relaxed shadow-sm ${chatBubbleClass(message.speaker)}`}
        >
          {message.text}
        </button>
      </div>
    </div>
  )
}

function ControlBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold text-gray-700">{label}</label>
      {children}
    </div>
  )
}

function ResultCard({ label, value, tone = 'blue' }: { label: string; value: string; tone?: 'blue' | 'green' | 'amber' | 'gray' }) {
  const toneClass = {
    blue: 'bg-blue-50 text-primary-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    gray: 'bg-gray-50 text-gray-600',
  }[tone]

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-2 inline-flex min-h-7 items-center rounded-full px-2.5 text-sm font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function TextCard({ icon, title, text, highlight = false }: { icon: React.ReactNode; title: string; text: string; highlight?: boolean }) {
  return (
    <section className={`rounded-lg border p-4 shadow-sm ${highlight ? 'border-emerald-100 bg-emerald-50/40' : 'border-gray-100 bg-white'}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={highlight ? 'text-emerald-600' : 'text-primary-500'}>{icon}</span>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>
      <p className="text-sm leading-relaxed text-gray-700">{text}</p>
    </section>
  )
}

function intentTone(intentLevel: string) {
  if (intentLevel === '高意向') return 'green'
  if (intentLevel === '中意向') return 'amber'
  if (intentLevel === '低意向') return 'gray'
  return 'blue'
}

function messagesToTranscript(items: DialogueMessage[]) {
  return items
    .filter((item) => item.speaker !== 'noise' && item.text.trim())
    .map((item) => `${dialogueSpeakerLabel(item.speaker)}：${item.text.trim()}`)
    .join('\n')
}

function parseBulkText(text: string): DialogueMessage[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const speaker = inferDialogueSpeaker(line)
      return {
        id: `bulk_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        speaker,
        text: line.replace(/^(销售|店员|导购|我|客户|顾客|业主|用户)[:：]\s*/, ''),
        timestamp: new Date().toISOString(),
        source: 'manual' as const,
      }
    })
}

function inferDialogueSpeaker(line: string): DialogueSpeaker {
  if (/^(销售|店员|导购|我)[:：]/.test(line)) return 'sales'
  if (/^(客户|顾客|业主|用户)[:：]/.test(line)) return 'customer'
  if (containsAny(line, ['你们', '别人家', '太贵', '多少钱', '再看看', '考虑一下', '回去商量', '有优惠'])) return 'customer'
  if (containsAny(line, ['我帮您', '我们可以', '给您', '咱们', '建议您'])) return 'sales'
  return 'unknown'
}

function dialogueSpeakerLabel(speaker: DialogueSpeaker) {
  const map: Record<DialogueSpeaker, string> = {
    sales: '销售',
    customer: '客户',
    unknown: '未确定',
    noise: '噪音',
  }
  return map[speaker]
}

function chatBubbleClass(speaker: DialogueSpeaker) {
  if (speaker === 'sales') return 'bg-emerald-500 text-white'
  if (speaker === 'customer') return 'bg-white text-gray-800'
  if (speaker === 'noise') return 'bg-gray-200 text-gray-500'
  return 'bg-blue-50 text-primary-700'
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}
