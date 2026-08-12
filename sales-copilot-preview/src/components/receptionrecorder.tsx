import { useRef, useState } from 'react'
import { CircleStop, Loader2, Mic, Radio, TriangleAlert, UserCheck } from 'lucide-react'
import { AudioCaptureService } from '../services/audioCapture'
import { RealtimeAsrSession } from '../services/realtimeSession'
import { SalesVoiceprintSpeakerIdentificationProvider } from '../services/speakerIdentification'
import { QwenServerVadTurnDetectionProvider } from '../services/turnDetection'
import { UtteranceAudioBuffer } from '../services/utteranceAudioBuffer'
import type { QwenRealtimeEvent } from '../services/qwenRealtime'
import type { DialogueMessage, DialogueSpeaker } from '../types/followup'

type RecorderStatus = 'idle' | 'connecting' | 'recording' | 'error'
type VoiceprintStatus = 'missing' | 'registering' | 'ready' | 'error'

interface Props {
  onMessagesChange: (messages: DialogueMessage[]) => void
  onFinish: (messages: DialogueMessage[]) => void
}

interface UtteranceSnapshot {
  chunks: string[]
  byteLength: number
  startedAt?: string
  endedAt?: string
}

export default function ReceptionRecorder({ onMessagesChange, onFinish }: Props) {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [voiceprintStatus, setVoiceprintStatus] = useState<VoiceprintStatus>('missing')
  const [partialText, setPartialText] = useState('')
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<DialogueMessage[]>([])
  const [speakerNote, setSpeakerNote] = useState('未注册销售声纹')
  const realtimeSessionRef = useRef<RealtimeAsrSession | null>(null)
  const audioCaptureRef = useRef<AudioCaptureService | null>(null)
  const registrationCaptureRef = useRef<AudioCaptureService | null>(null)
  const messagesRef = useRef<DialogueMessage[]>([])
  const voiceprintRef = useRef(new SalesVoiceprintSpeakerIdentificationProvider())
  const turnDetectorRef = useRef(new QwenServerVadTurnDetectionProvider())
  const utteranceAudioRef = useRef(new UtteranceAudioBuffer())
  const lastUtteranceSnapshotRef = useRef<UtteranceSnapshot | null>(null)

  const isRecording = status === 'connecting' || status === 'recording'
  const isRegistering = voiceprintStatus === 'registering'

  async function registerVoiceprint() {
    if (isRecording || isRegistering) return

    const chunks: string[] = []
    const capture = new AudioCaptureService()
    registrationCaptureRef.current = capture
    setVoiceprintStatus('registering')
    setError('')
    setSpeakerNote('请销售本人靠近麦克风说 3 秒')

    try {
      await capture.start({
        targetSampleRate: 16000,
        chunkMs: 100,
        onChunk: ({ audio }) => chunks.push(audio),
      })
      await wait(3200)
      capture.stop()
      registrationCaptureRef.current = null

      const ok = voiceprintRef.current.registerSalesVoiceprint(chunks, 16000)
      setVoiceprintStatus(ok ? 'ready' : 'error')
      setSpeakerNote(ok ? '销售声纹已记录，后续会自动区分销售/客户' : '声纹记录失败，请靠近一点重试')
    } catch (voiceprintError) {
      capture.stop()
      registrationCaptureRef.current = null
      setVoiceprintStatus('error')
      setSpeakerNote('声纹记录异常')
      setError(voiceprintError instanceof Error ? voiceprintError.message : '声纹记录异常')
    }
  }

  async function start() {
    if (isRecording) return

    setStatus('connecting')
    setError('')
    setPartialText('')
    setMessages([])
    messagesRef.current = []
    utteranceAudioRef.current.reset()
    lastUtteranceSnapshotRef.current = null
    onMessagesChange([])

    try {
      const realtimeSession = new RealtimeAsrSession()
      realtimeSessionRef.current = realtimeSession
      await realtimeSession.connect({
        onEvent: handleRealtimeEvent,
        onNetworkStatus: () => undefined,
        onError: setError,
      })

      const audioCapture = new AudioCaptureService()
      audioCaptureRef.current = audioCapture
      await audioCapture.start({
        targetSampleRate: realtimeSession.sampleRate,
        chunkMs: 100,
        onChunk: ({ audio, byteLength, timestamp }) => {
          utteranceAudioRef.current.addChunk({ audio, byteLength, timestamp })
          const sendResult = realtimeSession.sendAudio(audio)
          if (!sendResult.ok) setError(sendResult.reason || '音频发送失败')
        },
      })

      setStatus('recording')
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : '录音启动失败'
      setError(message)
      setStatus('error')
      stopDevices()
    }
  }

  function stop() {
    if (!isRecording) return

    const nextMessages = [...messagesRef.current]
    stopDevices()
    setStatus('idle')
    setPartialText('')

    if (nextMessages.length > 0) {
      onMessagesChange(nextMessages)
      onFinish(nextMessages)
    }
  }

  function stopDevices() {
    audioCaptureRef.current?.stop()
    audioCaptureRef.current = null
    realtimeSessionRef.current?.close()
    realtimeSessionRef.current = null
    registrationCaptureRef.current?.stop()
    registrationCaptureRef.current = null
    utteranceAudioRef.current.reset()
    lastUtteranceSnapshotRef.current = null
  }

  function handleRealtimeEvent(event: QwenRealtimeEvent) {
    if (event.type === 'error' || event.type === 'backend.error') {
      const message = typeof event.error === 'string' ? event.error : event.error?.message || '实时转写异常'
      setError(message)
      setStatus('error')
      stopDevices()
      return
    }

    const turnEvent = turnDetectorRef.current.getTurnEvent(event)
    if (turnEvent === 'speech_started') {
      utteranceAudioRef.current.start()
      lastUtteranceSnapshotRef.current = null
    }
    if (turnEvent === 'speech_stopped') {
      lastUtteranceSnapshotRef.current = utteranceAudioRef.current.stop()
    }

    if (event.type.startsWith('response.')) return

    if (event.type === 'conversation.item.input_audio_transcription.delta' || event.type === 'response.audio_transcript.delta') {
      const delta = event.delta || event.text || ''
      if (!delta) return
      setPartialText((current) => `${current}${delta}`)
      return
    }

    if (event.type === 'conversation.item.input_audio_transcription.completed' || event.type === 'response.audio_transcript.done') {
      const transcript = event.transcript || event.text || extractTranscriptFromResponse(event)
      if (!transcript.trim()) return
      void appendMessage(transcript.trim(), lastUtteranceSnapshotRef.current)
    }
  }

  async function appendMessage(text: string, snapshot: UtteranceSnapshot | null) {
    const speakerResult = await voiceprintRef.current.identify({
      sessionId: 'reception_recording',
      audioChunks: snapshot?.chunks,
      transcript: text,
      startedAt: snapshot?.startedAt,
      endedAt: snapshot?.endedAt,
      sampleRate: realtimeSessionRef.current?.sampleRate ?? 16000,
      timestamp: new Date().toISOString(),
      metadata: { source: 'realtime_asr' },
    })
    const speaker = normalizeSpeaker(text, speakerResult.speaker, speakerResult.confidence, snapshot?.byteLength || 0, messagesRef.current[messagesRef.current.length - 1]?.speaker)
    const nextMessages = [
      ...messagesRef.current,
      {
        id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        speaker,
        text,
        confidence: speakerResult.confidence,
        timestamp: new Date().toISOString(),
        source: 'realtime_asr' as const,
      },
    ]
    messagesRef.current = nextMessages
    setMessages(nextMessages)
    setPartialText('')
    setSpeakerNote(formatSpeakerNote(speaker, speakerResult.confidence))
    onMessagesChange(nextMessages)
    lastUtteranceSnapshotRef.current = null
  }

  return (
    <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900">接待录音</h2>
          <p className="mt-1 text-xs text-gray-500">先记录销售声纹，再录接待，会自动分左右气泡。</p>
        </div>
        <span className={`flex min-h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold ${statusPillClass(status)}`}>
          {status === 'recording' ? <Radio size={12} /> : status === 'connecting' ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
          {statusText(status)}
        </span>
      </div>

      <div className="mb-2">
        <button
          type="button"
          onClick={registerVoiceprint}
          disabled={isRecording || isRegistering}
          className={`flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-bold ${
            voiceprintStatus === 'ready'
              ? 'bg-emerald-50 text-emerald-600'
              : isRecording || isRegistering
                ? 'bg-gray-100 text-gray-400'
                : 'bg-blue-50 text-primary-600'
          }`}
        >
          {isRegistering ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
          {voiceprintButtonText(voiceprintStatus)}
        </button>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-400">{speakerNote}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={start}
          disabled={isRecording}
          className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-bold ${
            isRecording ? 'bg-gray-100 text-gray-400' : 'bg-primary-500 text-white'
          }`}
        >
          <Mic size={14} />
          开始录音
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={!isRecording}
          className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-bold ${
            isRecording ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'
          }`}
        >
          <CircleStop size={14} />
          结束并生成
        </button>
      </div>

      {messages.length || partialText ? (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">实时转写</span>
            <span className="text-[11px] text-gray-400">{messages.length} 句</span>
          </div>
          <div className="max-h-40 space-y-2 overflow-y-auto text-xs leading-relaxed text-gray-700">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.speaker === 'sales' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] rounded-lg px-3 py-2 ${bubbleClass(message.speaker)}`}>
                  <div className="mb-0.5 text-[10px] font-semibold opacity-70">{speakerLabel(message.speaker)}</div>
                  <p>{message.text}</p>
                </div>
              </div>
            ))}
            {partialText ? <p className="text-primary-600">{partialText}</p> : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </section>
  )
}

function extractTranscriptFromResponse(event: QwenRealtimeEvent) {
  return event.response?.output?.flatMap((output) => output.content || []).map((content) => content.transcript || content.text || '').join('').trim() || ''
}

function statusText(status: RecorderStatus) {
  const map: Record<RecorderStatus, string> = {
    idle: '未录音',
    connecting: '连接中',
    recording: '录音中',
    error: '异常',
  }
  return map[status]
}

function statusPillClass(status: RecorderStatus) {
  if (status === 'recording') return 'bg-emerald-50 text-emerald-600'
  if (status === 'connecting') return 'bg-blue-50 text-primary-600'
  if (status === 'error') return 'bg-red-50 text-red-600'
  return 'bg-gray-50 text-gray-500'
}

function voiceprintButtonText(status: VoiceprintStatus) {
  const map: Record<VoiceprintStatus, string> = {
    missing: '记录销售声纹 3 秒',
    registering: '正在记录声纹',
    ready: '销售声纹已记录',
    error: '重新记录销售声纹',
  }
  return map[status]
}

function normalizeSpeaker(
  text: string,
  speaker: 'sales' | 'customer' | 'unknown',
  confidence: number,
  byteLength: number,
  previousSpeaker?: DialogueSpeaker,
): DialogueSpeaker {
  const cleanText = text.trim()
  if (cleanText.length <= 1 || byteLength < 800) return 'noise'

  const salesLike = containsAny(cleanText, ['我帮您', '我们可以', '给您', '咱们', '建议您', '先给您', '您这边', '咱家', '我给您'])
  const customerLike = containsAny(cleanText, ['你们', '别人家', '多少钱', '太贵', '再看看', '考虑一下', '回家商量', '老公', '老婆'])

  if (salesLike && !customerLike) return 'sales'
  if (customerLike && !salesLike && speaker !== 'sales') return 'customer'
  if (speaker === 'sales' && confidence >= 0.66) return 'sales'
  if (previousSpeaker === 'sales' && confidence >= 0.58 && !customerLike) return 'sales'
  return 'unknown'
}

function bubbleClass(speaker: DialogueSpeaker) {
  if (speaker === 'sales') return 'bg-emerald-500 text-white'
  if (speaker === 'customer') return 'bg-white text-gray-800'
  if (speaker === 'noise') return 'bg-gray-200 text-gray-500'
  return 'bg-blue-50 text-primary-700'
}

function speakerLabel(speaker: DialogueSpeaker) {
  const map: Record<DialogueSpeaker, string> = {
    sales: '销售',
    customer: '客户',
    unknown: '未确定',
    noise: '噪音',
  }
  return map[speaker]
}

function formatSpeakerNote(speaker: DialogueSpeaker, confidence: number) {
  if (speaker === 'unknown') return `未确定 · 声纹相似度 ${Math.round(confidence * 100)}%`
  return `${speakerLabel(speaker)} · 置信度 ${Math.round(confidence * 100)}%`
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
