import { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  Camera,
  CheckCircle2,
  Clipboard,
  Copy,
  FileText,
  MapPin,
  MessageSquareText,
  Mic,
  Plus,
  RotateCcw,
  Sparkles,
  User,
  Wallet,
  Wand2,
  X,
} from 'lucide-react'
import ReceptionRecorder from './receptionrecorder'
import { analyzeFollowupAttachment, generateFollowupWithModel, type FollowupGenerationQuality } from '../services/followupApi'
import { generateFollowup } from '../services/followupGenerator'
import type {
  DialogueMessage,
  DialogueMessageSource,
  FollowupCustomerStatus,
  FollowupIndustry,
  FollowupResult,
} from '../types/followup'

type AttachmentKind = 'photo' | 'floorplan' | 'quote'

interface AttachmentItem {
  id: string
  kind: AttachmentKind
  name: string
  size: number
  type: string
  note: string
  summary?: string
  analysisStatus?: 'pending' | 'done' | 'error'
  addedAt: string
}

interface KeyFields {
  customerName: string
  location: string
  need: string
  budget: string
  concern: string
  nextTime: string
}

const fixedIndustry: FollowupIndustry = 'windows'

const emptyKeyFields: KeyFields = {
  customerName: '',
  location: '',
  need: '',
  budget: '',
  concern: '',
  nextTime: '',
}

const statusOptions: Array<{ id: FollowupCustomerStatus; label: string }> = [
  { id: 'new_inquiry', label: '刚接待' },
  { id: 'comparing', label: '比价中' },
  { id: 'hesitating', label: '犹豫中' },
  { id: 'ready_to_close', label: '快成交' },
  { id: 'silent', label: '待唤醒' },
]

const keyFieldConfigs: Array<{ key: keyof KeyFields; label: string; placeholder: string; icon: React.ReactNode }> = [
  { key: 'customerName', label: '客户称呼', placeholder: '王姐 / 张哥', icon: <User size={14} /> },
  { key: 'location', label: '小区位置', placeholder: '龙沙区某小区', icon: <MapPin size={14} /> },
  { key: 'need', label: '主要需求', placeholder: '旧窗漏风 / 全屋柜子', icon: <FileText size={14} /> },
  { key: 'budget', label: '预算范围', placeholder: '1.5万左右 / 先比价', icon: <Wallet size={14} /> },
  { key: 'concern', label: '最大顾虑', placeholder: '价格高 / 怕售后 / 怕工期', icon: <MessageSquareText size={14} /> },
  { key: 'nextTime', label: '下次动作', placeholder: '明天下午回访 / 约量尺', icon: <Calendar size={14} /> },
]

const attachmentKinds: Array<{ id: AttachmentKind; label: string; helper: string; accept: string; capture?: 'environment' }> = [
  { id: 'photo', label: '现场照片', helper: '客户现场、样品、聊天截图', accept: 'image/*', capture: 'environment' },
  { id: 'floorplan', label: '户型图', helper: '户型图、尺寸草图', accept: 'image/*', capture: 'environment' },
  { id: 'quote', label: '报价单', helper: '报价、配置、竞品单', accept: 'image/*,.pdf', capture: 'environment' },
]

const sampleTranscript = [
  '客户说家里是龙沙区老房子，冬天窗户漏风，想换一批窗。',
  '客户问断桥铝多少钱一平，觉得太贵就想再看看。',
  '销售解释了价格要看面积和配置，但没有把玻璃、五金、安装和售后拆开对比。',
  '客户说要回去跟家里人商量，也想再看看别人家的。',
].join('\n')

export default function FollowupCard() {
  const [customerStatus, setCustomerStatus] = useStoredState<FollowupCustomerStatus>('followup.customerStatus', 'new_inquiry')
  const [generationQuality, setGenerationQuality] = useStoredState<FollowupGenerationQuality>('followup.quality', 'standard')
  const [keyFields, setKeyFields] = useStoredState<KeyFields>('followup.keyFields', emptyKeyFields)
  const [receptionMessages, setReceptionMessages] = useStoredState<DialogueMessage[]>('followup.receptionMessages', [])
  const [recapMessages, setRecapMessages] = useStoredState<DialogueMessage[]>('followup.recapMessages', [])
  const [importedMessages, setImportedMessages] = useStoredState<DialogueMessage[]>('followup.importedMessages', [])
  const [manualMessages, setManualMessages] = useStoredState<DialogueMessage[]>('followup.manualMessages', [])
  const [attachments, setAttachments] = useStoredState<AttachmentItem[]>('followup.attachments', [])
  const [result, setResult] = useStoredState<FollowupResult | null>('followup.result', null)
  const [draftText, setDraftText] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [resultMeta, setResultMeta] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [copied, setCopied] = useState(false)

  const sourceTranscript = useMemo(
    () => buildCustomerContext({ keyFields, receptionMessages, recapMessages, importedMessages, manualMessages, attachments }),
    [keyFields, receptionMessages, recapMessages, importedMessages, manualMessages, attachments],
  )
  const canGenerate = sourceTranscript.trim().length >= 8
  const collectedSourceCount = [
    receptionMessages.length > 0,
    recapMessages.length > 0,
    importedMessages.length > 0,
    manualMessages.length > 0,
    attachments.length > 0,
    hasAnyKeyField(keyFields),
  ].filter(Boolean).length

  function handleGenerate() {
    void generateFromTranscript(sourceTranscript)
  }

  async function generateFromTranscript(transcript: string) {
    if (transcript.trim().length < 8) return
    setCopied(false)
    setGenerationError('')
    setResultMeta('')
    setIsGenerating(true)

    try {
      const modelResult = await generateFollowupWithModel({
        industry: fixedIndustry,
        customerStatus,
        transcript,
        quality: generationQuality,
      })
      setResult(modelResult)
      setResultMeta(generationQuality === 'premium' ? '深度分析已完成' : '普通分析已完成')
    } catch (error) {
      const fallback = generateFollowup({ industry: fixedIndustry, customerStatus, transcript })
      setResult(fallback)
      setResultMeta('已生成备用建议')
      setGenerationError(error instanceof Error ? error.message : '生成失败，已使用本地规则兜底')
    } finally {
      setIsGenerating(false)
    }
  }

  function updateKeyField(key: keyof KeyFields, value: string) {
    setKeyFields((current) => ({ ...current, [key]: value }))
  }

  function addManualMessage() {
    const text = draftText.trim()
    if (!text) return
    setManualMessages((current) => [...current, createMessage(text, 'manual')])
    setDraftText('')
  }

  function importBulkText() {
    const parsed = parseBulkText(bulkText)
    if (parsed.length === 0) return
    setImportedMessages((current) => [...current, ...parsed])
    setBulkText('')
  }

  function removeMessage(source: 'reception' | 'recap' | 'imported' | 'manual', id: string) {
    const updater = (items: DialogueMessage[]) => items.filter((message) => message.id !== id)
    if (source === 'reception') setReceptionMessages(updater)
    if (source === 'recap') setRecapMessages(updater)
    if (source === 'imported') setImportedMessages(updater)
    if (source === 'manual') setManualMessages(updater)
  }

  function addAttachmentFiles(kind: AttachmentKind, fileList: FileList | null) {
    const files = Array.from(fileList || [])
    if (files.length === 0) return

    files.forEach((file) => {
      const id = `file_${Date.now()}_${Math.random().toString(16).slice(2)}`
      const item: AttachmentItem = {
        id,
        kind,
        name: file.name,
        size: file.size,
        type: file.type || 'file',
        note: '',
        summary: file.type.startsWith('image/') ? '' : '已保存资料名称。PDF 或非图片文件请补一句关键内容。',
        analysisStatus: file.type.startsWith('image/') ? 'pending' : 'error',
        addedAt: new Date().toISOString(),
      }
      setAttachments((current) => [...current, item])

      if (file.type.startsWith('image/')) {
        void analyzeAttachmentFile(id, kind, file)
      }
    })
  }

  async function analyzeAttachmentFile(id: string, kind: AttachmentKind, file: File) {
    try {
      const dataUrl = await readImageAsDataUrl(file)
      const compactDataUrl = await resizeImageDataUrl(dataUrl, 1600, 0.82)
      const result = await analyzeFollowupAttachment({
        kind,
        name: file.name,
        mimeType: compactDataUrl.match(/^data:([^;]+);base64,/)?.[1] || file.type,
        dataUrl: compactDataUrl,
      })
      updateAttachment(id, { summary: result.summary, analysisStatus: 'done' })
    } catch {
      updateAttachment(id, { summary: '图片识别暂时失败，请手动补一句这张图的重点。', analysisStatus: 'error' })
    }
  }

  function updateAttachment(id: string, patch: Partial<AttachmentItem>) {
    setAttachments((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function updateAttachmentNote(id: string, note: string) {
    setAttachments((current) => current.map((item) => (item.id === id ? { ...item, note } : item)))
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((item) => item.id !== id))
  }

  async function copyWechatScript() {
    if (!result) return
    await navigator.clipboard.writeText(result.wechatScript)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  function fillExample() {
    setKeyFields({
      customerName: '王姐',
      location: '龙沙区老房子',
      need: '旧窗更换，重点想解决冬天漏风',
      budget: '觉得报价偏高，正在比价',
      concern: '担心换完还是不暖和，也担心售后',
      nextTime: '明天下午微信回访，争取约量尺',
    })
    setImportedMessages(parseBulkText(sampleTranscript))
    setCustomerStatus('comparing')
  }

  function reset() {
    setCustomerStatus('new_inquiry')
    setGenerationQuality('standard')
    setKeyFields(emptyKeyFields)
    setReceptionMessages([])
    setRecapMessages([])
    setImportedMessages([])
    setManualMessages([])
    setAttachments([])
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
      <header className="mb-3 rounded-lg bg-gray-900 p-4 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-emerald-200">门店接待</p>
            <h1 className="mt-1 text-xl font-bold leading-tight">开始接客</h1>
            <p className="mt-2 text-xs leading-relaxed text-gray-200">录音、销售补充、微信聊天、照片资料和关键字段，都会汇总成这一次客户上下文。</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-200">
            <Wand2 size={20} />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-xs text-gray-100">
          <span>已收集 {collectedSourceCount} 类信息</span>
          <span>{generationQuality === 'premium' ? '深度分析' : '普通分析'}</span>
        </div>
      </header>

      <div className="space-y-3">
        <ReceptionRecorder
          title="原始录音"
          description="接待开始后点这里，结束接待时保存转写。"
          startLabel="开始接客"
          stopLabel="结束接客"
          segmentLabel="接待片段"
          source="realtime_asr"
          onMessagesChange={setReceptionMessages}
          onFinish={setReceptionMessages}
        />

        <ReceptionRecorder
          title="销售60秒补充"
          description="接待完自己补一句：客户真实顾虑、预算、家里谁决策、下次怎么约。"
          startLabel="开始补充"
          stopLabel="保存补充"
          segmentLabel="补充片段"
          source="sales_recap"
          onMessagesChange={setRecapMessages}
          onFinish={setRecapMessages}
        />

        <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-gray-900">关键字段</h2>
              <p className="mt-1 text-xs text-gray-500">知道多少填多少，空着也能生成。</p>
            </div>
            <FileText size={18} className="shrink-0 text-primary-500" />
          </div>

          <div className="mb-3 flex gap-2 overflow-x-auto hide-scrollbar">
            {statusOptions.map((status) => (
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

          <div className="grid grid-cols-2 gap-2">
            {keyFieldConfigs.map((field) => (
              <label key={field.key} className="rounded-lg bg-gray-50 px-3 py-2">
                <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
                  {field.icon}
                  {field.label}
                </span>
                <input
                  value={keyFields[field.key]}
                  onChange={(event) => updateKeyField(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  className="h-8 w-full bg-transparent text-xs font-semibold text-gray-800 outline-none placeholder:font-normal placeholder:text-gray-300"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-gray-900">微信聊天导入</h2>
              <p className="mt-1 text-xs text-gray-500">粘贴微信记录、语音转文字或销售回忆。</p>
            </div>
            <Clipboard size={18} className="shrink-0 text-primary-500" />
          </div>
          <textarea
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder="粘贴聊天内容，比如客户问价、顾虑、约定时间..."
            className="min-h-[92px] w-full resize-none rounded-lg bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-800 outline-none placeholder:text-gray-300"
          />
          <button
            type="button"
            onClick={importBulkText}
            className="mt-2 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-50 text-xs font-bold text-primary-600"
          >
            <Plus size={14} />
            导入微信聊天
          </button>
        </section>

        <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-gray-900">拍照资料</h2>
              <p className="mt-1 text-xs text-gray-500">户型图、报价单、现场照片都可以留在这次客户里。</p>
            </div>
            <Camera size={18} className="shrink-0 text-primary-500" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {attachmentKinds.map((kind) => (
              <label key={kind.id} htmlFor={`attachment-${kind.id}`} className="flex min-h-[74px] cursor-pointer flex-col justify-center rounded-lg border border-gray-200 bg-gray-50 px-2 text-center active:bg-blue-50">
                <span className="text-xs font-bold text-gray-800">{kind.label}</span>
                <span className="mt-1 text-[10px] leading-snug text-gray-400">{kind.helper}</span>
                <input
                  id={`attachment-${kind.id}`}
                  type="file"
                  className="hidden"
                  accept={kind.accept}
                  capture={kind.capture}
                  multiple
                  onChange={(event) => {
                    addAttachmentFiles(kind.id, event.target.files)
                    event.currentTarget.value = ''
                  }}
                />
              </label>
            ))}
          </div>

          {attachments.length > 0 ? (
            <div className="mt-3 space-y-2">
              {attachments.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-gray-800">{attachmentKindLabel(item.kind)} · {item.name}</p>
                      <p className="mt-0.5 text-[10px] text-gray-400">{formatSize(item.size)} · {attachmentStatusText(item)}</p>
                    </div>
                    <button type="button" onClick={() => removeAttachment(item.id)} className="rounded p-1 text-gray-300 active:bg-gray-100">
                      <X size={14} />
                    </button>
                  </div>
                  {item.summary ? (
                    <p className={`mb-2 rounded-lg px-2 py-1.5 text-xs leading-relaxed ${item.analysisStatus === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {item.summary}
                    </p>
                  ) : null}
                  <textarea
                    value={item.note}
                    onChange={(event) => updateAttachmentNote(item.id, event.target.value)}
                    placeholder="给这份资料补一句重点，比如报价总价、配置差异、户型限制..."
                    className="min-h-[48px] w-full resize-none rounded-lg bg-white px-2 py-1.5 text-xs leading-relaxed text-gray-700 outline-none placeholder:text-gray-300"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-gray-900">补充一句</h2>
              <p className="mt-1 text-xs text-gray-500">临时想到的重点可以直接记下来。</p>
            </div>
            <MessageSquareText size={18} className="shrink-0 text-primary-500" />
          </div>
          <textarea
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            placeholder="比如：客户老公拍板，别一直和客户本人谈价格..."
            className="min-h-[72px] w-full resize-none rounded-lg bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-800 outline-none placeholder:text-gray-300"
          />
          <button
            type="button"
            onClick={addManualMessage}
            className="mt-2 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-gray-900 text-xs font-bold text-white"
          >
            <Plus size={14} />
            加入本次客户
          </button>
        </section>

        <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-gray-900">本次客户内容</h2>
              <p className="mt-1 text-xs text-gray-500">生成前可以删掉无关片段。</p>
            </div>
            <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-500">{allMessages(receptionMessages, recapMessages, importedMessages, manualMessages).length} 条</span>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg bg-gray-50 p-2">
            {allMessages(receptionMessages, recapMessages, importedMessages, manualMessages).length === 0 ? (
              <div className="py-7 text-center">
                <MessageSquareText size={26} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-semibold text-gray-500">还没有接待内容</p>
                <p className="mt-1 text-xs text-gray-400">可以录音、粘贴微信、拍资料或手动补充。</p>
              </div>
            ) : null}
            {receptionMessages.map((message) => <ContextRow key={message.id} message={message} onRemove={() => removeMessage('reception', message.id)} />)}
            {recapMessages.map((message) => <ContextRow key={message.id} message={message} onRemove={() => removeMessage('recap', message.id)} />)}
            {importedMessages.map((message) => <ContextRow key={message.id} message={message} onRemove={() => removeMessage('imported', message.id)} />)}
            {manualMessages.map((message) => <ContextRow key={message.id} message={message} onRemove={() => removeMessage('manual', message.id)} />)}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={fillExample}
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
        </section>

        <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <ControlBlock label="分析方式">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGenerationQuality('standard')}
                className={`min-h-14 rounded-lg border px-2 text-left transition-colors ${
                  generationQuality === 'standard' ? 'border-primary-500 bg-blue-50 text-primary-700' : 'border-gray-100 bg-gray-50 text-gray-500'
                }`}
              >
                <span className="block text-xs font-bold">普通分析</span>
                <span className="mt-1 block text-[10px] leading-snug">日常回访，速度更快</span>
              </button>
              <button
                type="button"
                onClick={() => setGenerationQuality('premium')}
                className={`min-h-14 rounded-lg border px-2 text-left transition-colors ${
                  generationQuality === 'premium' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 bg-gray-50 text-gray-500'
                }`}
              >
                <span className="block text-xs font-bold">深度分析</span>
                <span className="mt-1 block text-[10px] leading-snug">高意向客户，更细</span>
              </button>
            </div>
          </ControlBlock>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className={`mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors ${
              canGenerate && !isGenerating ? 'bg-primary-500 text-white active:bg-primary-600' : 'bg-gray-200 text-gray-400'
            }`}
          >
            <Sparkles size={17} />
            {isGenerating ? '正在整理下一步...' : '生成下一步怎么跟'}
          </button>
          {generationError ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">当前网络或模型不稳定，已先生成一版备用建议。</p>
          ) : resultMeta ? (
            <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{resultMeta}</p>
          ) : null}
        </section>

        {result ? (
          <section className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <ResultCard label="意向判断" value={result.intentLevel} tone={intentTone(result.intentLevel)} />
              <ResultCard label="当前阶段" value={result.currentStage} />
            </div>

            <TextCard icon={<MessageSquareText size={16} />} title="为什么要跟" text={result.primaryConcern} />
            <TextCard icon={<Sparkles size={16} />} title="这次怎么跟" text={result.nextAction} highlight />
            <TextCard icon={<CheckCircle2 size={16} />} title="需要补问或避开的点" text={result.missedPoint} />

            <section className="rounded-lg border border-emerald-100 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-gray-900">微信建议</h2>
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
              <h2 className="mb-2 text-sm font-bold text-gray-900">判断依据</h2>
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
            <p className="text-sm font-semibold text-gray-500">还没有下一步建议</p>
            <p className="mt-1 text-xs text-gray-400">收集一段客户内容后生成。</p>
          </section>
        )}
      </div>
    </div>
  )
}

function ContextRow({ message, onRemove }: { message: DialogueMessage; onRemove: () => void }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-sm leading-relaxed text-gray-800 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-gray-400">{sourceLabel(message.source)}</span>
        <button type="button" onClick={onRemove} className="text-[10px] font-semibold text-gray-300">删除</button>
      </div>
      <p>{message.text}</p>
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

function useStoredState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    const stored = window.localStorage.getItem(key)
    if (!stored) return initialValue
    try {
      return JSON.parse(stored) as T
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Ignore storage quota errors; in-memory state still works.
    }
  }, [key, value])

  return [value, setValue] as const
}

function buildCustomerContext(input: {
  keyFields: KeyFields
  receptionMessages: DialogueMessage[]
  recapMessages: DialogueMessage[]
  importedMessages: DialogueMessage[]
  manualMessages: DialogueMessage[]
  attachments: AttachmentItem[]
}) {
  const sections: string[] = []
  const fieldLines = keyFieldConfigs
    .map((field) => {
      const value = input.keyFields[field.key].trim()
      return value ? `${field.label}：${value}` : ''
    })
    .filter(Boolean)

  if (fieldLines.length > 0) sections.push(`关键字段：\n${fieldLines.join('\n')}`)
  pushMessageSection(sections, '原始接待录音转写', input.receptionMessages)
  pushMessageSection(sections, '销售60秒补充', input.recapMessages)
  pushMessageSection(sections, '微信聊天或粘贴导入', input.importedMessages)
  pushMessageSection(sections, '手动补充', input.manualMessages)

  if (input.attachments.length > 0) {
    sections.push(`拍照资料：\n${input.attachments.map(attachmentLine).join('\n')}`)
  }

  return sections.join('\n\n')
}

function pushMessageSection(sections: string[], title: string, messages: DialogueMessage[]) {
  const text = messagesToTranscript(messages)
  if (text) sections.push(`${title}：\n${text}`)
}

function messagesToTranscript(items: DialogueMessage[]) {
  return items
    .filter((item) => item.speaker !== 'noise' && item.text.trim())
    .map((item) => item.text.trim())
    .join('\n')
}

function createMessage(text: string, source: DialogueMessageSource): DialogueMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    speaker: 'unknown',
    text,
    timestamp: new Date().toISOString(),
    source,
  }
}

function parseBulkText(text: string): DialogueMessage[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => createMessage(line.replace(/^(销售|店员|导购|我|客户|顾客|业主|用户)[:：]\s*/, ''), 'wechat'))
}

function allMessages(...groups: DialogueMessage[][]) {
  return groups.flat()
}

function hasAnyKeyField(fields: KeyFields) {
  return Object.values(fields).some((value) => value.trim())
}

function attachmentKindLabel(kind: AttachmentKind) {
  const labels: Record<AttachmentKind, string> = {
    photo: '现场照片',
    floorplan: '户型图',
    quote: '报价单',
  }
  return labels[kind]
}

function attachmentLine(item: AttachmentItem) {
  const summary = item.summary?.trim()
  const note = item.note.trim()
  const details = [summary ? `识别摘要：${summary}` : '', note ? `销售备注：${note}` : ''].filter(Boolean).join('；')
  return `${attachmentKindLabel(item.kind)}：${item.name}${details ? `；${details}` : ''}`
}

function attachmentStatusText(item: AttachmentItem) {
  if (item.analysisStatus === 'pending') return '识别中'
  if (item.analysisStatus === 'done') return '已识别'
  if (item.analysisStatus === 'error') return '需补充'
  return '已保存'
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

function resizeImageDataUrl(dataUrl: string, maxSide: number, quality: number) {
  return new Promise<string>((resolve) => {
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
      if (scale >= 1) {
        resolve(dataUrl)
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        resolve(dataUrl)
        return
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    image.onerror = () => resolve(dataUrl)
    image.src = dataUrl
  })
}
function sourceLabel(source?: DialogueMessageSource) {
  const labels: Record<DialogueMessageSource, string> = {
    manual: '手动补充',
    realtime_asr: '原始录音',
    sales_recap: '销售补充',
    wechat: '微信导入',
    attachment: '拍照资料',
    field: '关键字段',
  }
  return source ? labels[source] : '接待内容'
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function intentTone(intentLevel: string) {
  if (intentLevel === '高意向') return 'green'
  if (intentLevel === '中意向') return 'amber'
  if (intentLevel === '低意向') return 'gray'
  return 'blue'
}
