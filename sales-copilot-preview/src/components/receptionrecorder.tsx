import { useRef, useState } from 'react'
import { CircleStop, Loader2, Mic, Radio, TriangleAlert } from 'lucide-react'
import { AudioCaptureService } from '../services/audioCapture'
import { RealtimeAsrSession } from '../services/realtimeSession'
import { QwenServerVadTurnDetectionProvider } from '../services/turnDetection'
import { UtteranceAudioBuffer } from '../services/utteranceAudioBuffer'
import type { QwenRealtimeEvent } from '../services/qwenRealtime'
import type { DialogueMessage, DialogueMessageSource } from '../types/followup'

type RecorderStatus = 'idle' | 'connecting' | 'recording' | 'error'

interface Props {
  title?: string
  description?: string
  startLabel?: string
  stopLabel?: string
  segmentLabel?: string
  source?: DialogueMessageSource
  onMessagesChange: (messages: DialogueMessage[]) => void
  onFinish: (messages: DialogueMessage[]) => void
}

interface UtteranceSnapshot {
  chunks: string[]
  byteLength: number
  startedAt?: string
  endedAt?: string
}

export default function ReceptionRecorder({
  title = '接待录音',
  description = '录下客户接待过程，结束后自动整理客户需求、顾虑和下一步跟进重点。',
  startLabel = '开始录音',
  stopLabel = '结束录音',
  segmentLabel = '片段',
  source = 'realtime_asr',
  onMessagesChange,
  onFinish,
}: Props) {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [partialText, setPartialText] = useState('')
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<DialogueMessage[]>([])
  const realtimeSessionRef = useRef<RealtimeAsrSession | null>(null)
  const audioCaptureRef = useRef<AudioCaptureService | null>(null)
  const messagesRef = useRef<DialogueMessage[]>([])
  const turnDetectorRef = useRef(new QwenServerVadTurnDetectionProvider())
  const utteranceAudioRef = useRef(new UtteranceAudioBuffer())
  const lastUtteranceSnapshotRef = useRef<UtteranceSnapshot | null>(null)

  const isRecording = status === 'connecting' || status === 'recording'

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

    const nextMessages = partialText.trim()
      ? [...messagesRef.current, buildMessage(partialText.trim(), lastUtteranceSnapshotRef.current)]
      : [...messagesRef.current]

    messagesRef.current = nextMessages
    setMessages(nextMessages)
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
      appendMessage(transcript.trim(), lastUtteranceSnapshotRef.current)
    }
  }

  function appendMessage(text: string, snapshot: UtteranceSnapshot | null) {
    const nextMessages = [...messagesRef.current, buildMessage(text, snapshot)]
    messagesRef.current = nextMessages
    setMessages(nextMessages)
    setPartialText('')
    onMessagesChange(nextMessages)
    lastUtteranceSnapshotRef.current = null
  }

  function buildMessage(text: string, snapshot: UtteranceSnapshot | null): DialogueMessage {
    return {
      id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      speaker: 'unknown',
      text,
      confidence: snapshot?.byteLength ? 1 : 0,
      timestamp: new Date().toISOString(),
      source,
    }
  }

  return (
    <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">{description}</p>
        </div>
        <span className={`flex min-h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold ${statusPillClass(status)}`}>
          {status === 'recording' ? <Radio size={12} /> : status === 'connecting' ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
          {statusText(status)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={start}
          disabled={isRecording}
          className={`flex min-h-12 items-center justify-center gap-1.5 rounded-lg text-sm font-bold ${
            isRecording ? 'bg-gray-100 text-gray-400' : 'bg-primary-500 text-white'
          }`}
        >
          <Mic size={15} />
          {startLabel}
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={!isRecording}
          className={`flex min-h-12 items-center justify-center gap-1.5 rounded-lg text-sm font-bold ${
            isRecording ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'
          }`}
        >
          <CircleStop size={15} />
          {stopLabel}
        </button>
      </div>

      {messages.length || partialText ? (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">实时记录</span>
            <span className="text-[11px] text-gray-400">{messages.length} 段</span>
          </div>
          <div className="max-h-44 space-y-2 overflow-y-auto text-xs leading-relaxed text-gray-700">
            {messages.map((message, index) => (
              <div key={message.id} className="rounded-lg bg-white px-3 py-2 shadow-sm">
                <div className="mb-0.5 text-[10px] font-semibold text-gray-400">{segmentLabel} {index + 1}</div>
                <p>{message.text}</p>
              </div>
            ))}
            {partialText ? <p className="rounded-lg bg-blue-50 px-3 py-2 text-primary-600">{partialText}</p> : null}
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
