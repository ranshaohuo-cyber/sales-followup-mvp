import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bug,
  CheckCircle2,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  UserCheck,
  Volume2,
  Wifi,
} from 'lucide-react'
import { AudioCaptureService } from '../services/audioCapture'
import { BrowserSpeechCoachVoicePlayer } from '../services/coachVoicePlayer'
import { ConversationStream, formatTime } from '../services/conversationStream'
import { ConversationSessionStore } from '../services/conversationSessionStore'
import { InterventionController } from '../services/interventionController'
import { RealtimeAsrSession } from '../services/realtimeSession'
import { AsrOnlyResponsePolicyEvaluator } from '../services/responsePolicy'
import { SalesContextEngine } from '../services/salesContextEngine'
import { SalesStrategyEngine } from '../services/salesStrategyEngine'
import { SalesVoiceprintSpeakerIdentificationProvider } from '../services/speakerIdentification'
import { QwenServerVadTurnDetectionProvider } from '../services/turnDetection'
import { UtteranceAudioBuffer } from '../services/utteranceAudioBuffer'
import type { QwenRealtimeEvent } from '../services/qwenRealtime'
import type {
  ConversationBufferItem,
  ConversationEvent,
  ConversationSession,
  RealtimeDebugState,
  SpeakerIdentificationResult,
} from '../types/conversation'
import { createSilentInterventionDecision, type CoachVoiceState, type InterventionDecision } from '../types/intervention'
import { createUnknownSalesContext, type SalesContext } from '../types/salesContext'
import { createEmptyStrategyRecommendation, type StrategyRecommendation } from '../types/salesStrategy'

type ConnectionStatus = 'idle' | 'connecting' | 'listening' | 'paused' | 'error'
type ViewMode = 'demo' | 'dev'

interface UtteranceSnapshot {
  chunks: string[]
  byteLength: number
  startedAt?: string
  endedAt?: string
}

const S = {
  demoMode: '\u6f14\u793a\u6a21\u5f0f',
  devMode: '\u5f00\u53d1\u6a21\u5f0f',
  notStarted: '\u672a\u5f00\u59cb\u966a\u542c',
  preparing: '\u6b63\u5728\u51c6\u5907\u966a\u542c',
  listening: '\u6b63\u5728\u966a\u542c',
  paused: '\u5df2\u6682\u505c\u966a\u542c',
  error: '\u966a\u542c\u5f02\u5e38',
  start: '\u5f00\u59cb',
  startListening: '\u5f00\u59cb\u966a\u542c',
  pause: '\u6682\u505c',
  resume: '\u7ee7\u7eed',
  stop: '\u7ed3\u675f',
  clear: '\u6e05\u7a7a',
  currentStatus: '\u5f53\u524d\u966a\u542c\u72b6\u6001',
  demoPrice: '\u6a21\u62df\u4ef7\u683c\u5f02\u8bae',
  customerState: '\u5ba2\u6237\u5f53\u524d\u72b6\u6001',
  aiJudgement: 'AI \u5f53\u524d\u5224\u65ad',
  currentSuggestion: '\u5f53\u524d\u5efa\u8bae',
  whisper: '\u8033\u8fb9\u63d0\u9192',
  liveConversation: '\u73b0\u573a\u5bf9\u8bdd',
  realtimeCopilot: '\u5b9e\u65f6\u9500\u552e\u526f\u9a7e',
  voice: '\u8bed\u97f3',
  text: '\u6587\u672c',
  micStreaming: '\u9ea6\u514b\u98ce\u6301\u7eed\u91c7\u96c6',
  send: '\u53d1\u9001',
  inputPlaceholder: '\u8f93\u5165\u5ba2\u6237\u6216\u9500\u552e\u521a\u8bf4\u7684\u8bdd',
  onlyTranscript: '\u4ec5\u8f6c\u5199',
  registerSales: '\u6ce8\u518c\u9500\u552e',
  registering: '\u5f55 3 \u79d2',
  salesRegistered: '\u9500\u552e\u5df2\u6ce8\u518c',
  markSales: '\u6807\u4e3a\u9500\u552e',
  markCustomer: '\u6807\u4e3a\u5ba2\u6237',
  speakerDiagnosis: '\u58f0\u7eb9\u8bca\u65ad',
  noDialogue: '\u5b8c\u6574\u8f6c\u5199\u4f1a\u6309\u9500\u552e/\u5ba2\u6237\u8eab\u4efd\u4fdd\u5b58\u5728\u8fd9\u91cc\u3002',
  demoEmpty: '\u70b9\u51fb\u201c\u6a21\u62df\u4ef7\u683c\u5f02\u8bae\u201d\uff0c\u5373\u53ef\u770b\u5230\u5ba2\u6237\u8868\u8fbe\u3001AI\u5224\u65ad\u3001\u7b56\u7565\u5efa\u8bae\u548c\u8033\u8fb9\u63d0\u9192\u3002',
  waitingSpeech: '\u7b49\u5f85\u8bed\u97f3\u8f93\u5165...',
}

const initialDebugState: RealtimeDebugState = {
  audioStatus: 'idle',
  asrStatus: 'idle',
  networkStatus: 'idle',
  latencyMs: null,
  audioCaptureLatencyMs: null,
  asrLatencyMs: null,
  eventProcessingLatencyMs: null,
  chunksSent: 0,
  droppedChunks: 0,
  bytesSent: 0,
  partialText: '',
  speakerStatus: 'voiceprint_missing',
  lastSpeaker: 'unknown',
  speakerConfidence: null,
  lastError: '',
}

export default function RealtimeCopilot() {
  const [stream] = useState(() => new ConversationStream({
    maxEvents: 1000,
    metadata: { source: 'qwen', sampleRate: 16000 },
  }))
  const [viewMode, setViewMode] = useState<ViewMode>('demo')
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice')
  const [inputText, setInputText] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle')
  const [statusText, setStatusText] = useState(S.notStarted)
  const [debugState, setDebugState] = useState<RealtimeDebugState>(initialDebugState)
  const [events, setEvents] = useState<ConversationEvent[]>([])
  const [conversationBuffer, setConversationBuffer] = useState<ConversationBufferItem[]>([])
  const [session, setSession] = useState<ConversationSession>(() => stream.getSession())
  const [salesContext, setSalesContext] = useState<SalesContext>(() => createUnknownSalesContext(stream.sessionId))
  const [strategyRecommendation, setStrategyRecommendation] = useState<StrategyRecommendation>(() => createEmptyStrategyRecommendation())
  const [interventionDecision, setInterventionDecision] = useState<InterventionDecision>(() => createSilentInterventionDecision('not_evaluated'))
  const [voiceState, setVoiceState] = useState<CoachVoiceState>('idle')
  const [voiceprintReady, setVoiceprintReady] = useState(false)
  const [isRegisteringVoiceprint, setIsRegisteringVoiceprint] = useState(false)
  const [speakerDiagnostics, setSpeakerDiagnostics] = useState('\u672a\u8bc6\u522b')

  const realtimeSessionRef = useRef<RealtimeAsrSession | null>(null)
  const audioCaptureRef = useRef<AudioCaptureService | null>(null)
  const registrationCaptureRef = useRef<AudioCaptureService | null>(null)
  const turnProviderRef = useRef(new QwenServerVadTurnDetectionProvider())
  const responsePolicyRef = useRef(new AsrOnlyResponsePolicyEvaluator())
  const salesContextEngineRef = useRef(new SalesContextEngine(stream.sessionId))
  const salesStrategyEngineRef = useRef(new SalesStrategyEngine())
  const interventionControllerRef = useRef(new InterventionController())
  const coachVoicePlayerRef = useRef(new BrowserSpeechCoachVoicePlayer())
  const speakerProviderRef = useRef(new SalesVoiceprintSpeakerIdentificationProvider())
  const storeRef = useRef(new ConversationSessionStore())
  const utteranceAudioRef = useRef(new UtteranceAudioBuffer())
  const lastUtteranceSnapshotRef = useRef<UtteranceSnapshot | null>(null)
  const speechStartedAtRef = useRef<number | null>(null)
  const pendingInterventionTimeoutRef = useRef<number | null>(null)

  const isSessionRunning = connectionStatus === 'connecting' || connectionStatus === 'listening'
  const recentEvents = useMemo(() => events.slice(-12).reverse(), [events])
  const demoTimeline = useMemo(
    () => events.filter((event) => event.type === 'transcript_final' || event.type === 'coach_suggestion').slice(-10),
    [events],
  )

  useEffect(() => {
    return stream.subscribe((nextEvents) => {
      setEvents(nextEvents)
      setConversationBuffer(stream.getConversationBuffer())
      const nextSession = stream.getSession()
      setSession(nextSession)
      storeRef.current.save(nextSession)
    })
  }, [stream])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isSessionRunning) {
        pauseVoiceSession()
        appendStateChange('page_hidden_auto_paused')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  function updateDebug(patch: Partial<RealtimeDebugState>) {
    setDebugState((current) => ({ ...current, ...patch }))
  }

  function appendStateChange(content: string, speaker: ConversationEvent['speaker'] = 'unknown') {
    stream.append({ speaker, type: 'state_change', content })
  }

  function appendSalesContextUpdate(sourceEvent: ConversationEvent) {
    const result = salesContextEngineRef.current.update(stream.getAllEvents())
    setSalesContext(result.context)
    if (result.reason === 'no_new_transcript_final') return

    const contextEvent = stream.append({
      speaker: 'ai_coach',
      type: 'context_update',
      content: 'sales_context_updated',
      confidence: result.context.confidence,
      metadata: {
        sourceEventId: sourceEvent.id,
        reason: result.reason,
        signals: result.signals,
        salesContext: result.context,
      },
    })
    appendStrategyRecommendation(result.context, contextEvent)
  }

  function appendStrategyRecommendation(context: SalesContext, sourceEvent: ConversationEvent) {
    const result = salesStrategyEngineRef.current.update(context, stream.getAllEvents())
    setStrategyRecommendation(result.recommendation)
    if (result.reason === 'no_new_context_update' || result.recommendation.type === 'none') {
      cancelPendingIntervention(result.reason)
      setInterventionDecision(interventionControllerRef.current.evaluate(stream.getAllEvents(), context, result.recommendation))
      return
    }

    const strategyEvent = stream.append({
      speaker: 'ai_coach',
      type: 'strategy_recommendation',
      content: 'sales_strategy_recommended',
      confidence: result.recommendation.confidence,
      metadata: {
        sourceEventId: sourceEvent.id,
        reason: result.reason,
        signals: result.signals,
        strategyRecommendation: result.recommendation,
      },
    })
    scheduleCoachIntervention(context, result.recommendation, strategyEvent)
  }

  function scheduleCoachIntervention(
    context: SalesContext,
    recommendation: StrategyRecommendation,
    sourceEvent: ConversationEvent,
  ) {
    cancelPendingIntervention('rescheduled')
    const decision = interventionControllerRef.current.evaluate(stream.getAllEvents(), context, recommendation)
    setInterventionDecision(decision)
    if (!decision.shouldIntervene) return

    const delayMs = 800 + Math.floor(Math.random() * 700)
    pendingInterventionTimeoutRef.current = window.setTimeout(() => {
      pendingInterventionTimeoutRef.current = null
      const latestEvents = stream.getAllEvents()
      const latestTranscript = getLatestTranscriptEvent(latestEvents)
      if (latestTranscript && latestTranscript.sequence > sourceEvent.sequence) {
        setInterventionDecision({ ...interventionControllerRef.current.cancel(), reason: 'stale_intervention' })
        appendStateChange('coach_cancelled_stale_intervention', 'ai_coach')
        return
      }

      const latestContext = salesContextEngineRef.current.getContext()
      const latestRecommendation = salesStrategyEngineRef.current.getRecommendation()
      const latestDecision = interventionControllerRef.current.evaluate(latestEvents, latestContext, latestRecommendation)
      setInterventionDecision(latestDecision)
      if (!latestDecision.shouldIntervene) {
        appendStateChange('coach_cancelled_policy_changed', 'ai_coach')
        return
      }

      if (
        latestTranscript?.speaker === 'sales' &&
        !isLikelyWrongSalesAnswer(latestTranscript.content, latestContext)
      ) {
        setInterventionDecision({ ...interventionControllerRef.current.cancel(), reason: 'cancelled_sales_started' })
        appendStateChange('coach_cancelled_sales_started', 'ai_coach')
        return
      }

      const cooldownUntil = interventionControllerRef.current.markIntervened(latestDecision.priority)
      const suggestionEvent = stream.append({
        speaker: 'ai_coach',
        type: 'coach_suggestion',
        content: latestDecision.message,
        confidence: latestDecision.confidence,
        metadata: {
          sourceEventId: sourceEvent.id,
          interventionDecision: { ...latestDecision, cooldownUntil },
        },
      })
      setInterventionDecision({ ...latestDecision, cooldownUntil })
      void playCoachSuggestion(latestDecision.message, suggestionEvent)
    }, delayMs)
  }

  function cancelPendingIntervention(reason: string) {
    if (pendingInterventionTimeoutRef.current === null) return
    window.clearTimeout(pendingInterventionTimeoutRef.current)
    pendingInterventionTimeoutRef.current = null
    setInterventionDecision({ ...interventionControllerRef.current.cancel(), reason })
    appendStateChange(`coach_pending_cancelled:${reason}`, 'ai_coach')
  }

  async function playCoachSuggestion(message: string, sourceEvent: ConversationEvent) {
    setVoiceState('playing')
    try {
      await coachVoicePlayerRef.current.playSuggestion(message, { priority: interventionDecision.priority })
      setVoiceState(coachVoicePlayerRef.current.getState())
    } finally {
      stream.append({
        speaker: 'ai_coach',
        type: 'state_change',
        content: 'coach_playback_finished',
        metadata: { sourceEventId: sourceEvent.id, voiceState: coachVoicePlayerRef.current.getState() },
      })
    }
  }

  function interruptCoachPlayback(reason: string) {
    cancelPendingIntervention(reason)
    if (coachVoicePlayerRef.current.getState() !== 'playing') return
    coachVoicePlayerRef.current.interrupt()
    setVoiceState(coachVoicePlayerRef.current.getState())
    appendStateChange(`coach_interrupted:${reason}`, 'ai_coach')
  }

  async function registerSalesVoiceprint() {
    if (isRegisteringVoiceprint || isSessionRunning) return

    const chunks: string[] = []
    const sampleRate = 16000
    const capture = new AudioCaptureService()
    registrationCaptureRef.current = capture
    setIsRegisteringVoiceprint(true)
    setStatusText('\u6b63\u5728\u6ce8\u518c\u9500\u552e\u58f0\u7eb9')
    updateDebug({ speakerStatus: 'registering_sales_voiceprint', lastError: '' })
    appendStateChange('sales_voiceprint_registration_started', 'sales')

    try {
      await capture.start({
        targetSampleRate: sampleRate,
        chunkMs: 100,
        onChunk: ({ audio }) => chunks.push(audio),
      })
      await wait(3200)
      capture.stop()
      registrationCaptureRef.current = null

      const ok = speakerProviderRef.current.registerSalesVoiceprint(chunks, sampleRate)
      setVoiceprintReady(ok)
      setStatusText(ok ? '\u9500\u552e\u58f0\u7eb9\u5df2\u5c31\u7eea' : '\u9500\u552e\u58f0\u7eb9\u6ce8\u518c\u5931\u8d25')
      updateDebug({
        speakerStatus: ok ? 'voiceprint_ready' : 'voiceprint_failed',
        lastSpeaker: 'sales',
        speakerConfidence: ok ? 1 : 0,
      })
      setSpeakerDiagnostics(ok ? '\u9500\u552e\u58f0\u7eb9\u5df2\u6ce8\u518c\uff0c\u8bf7\u5f00\u59cb\u771f\u5b9e\u5bf9\u8bdd' : '\u6ce8\u518c\u5931\u8d25\uff0c\u8bf7\u9760\u8fd1\u9ea6\u514b\u98ce\u91cd\u8bd5')
      appendStateChange(ok ? 'sales_voiceprint_registered' : 'sales_voiceprint_registration_failed', 'sales')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'voiceprint_registration_failed'
      capture.stop()
      registrationCaptureRef.current = null
      setVoiceprintReady(false)
      setStatusText('\u9500\u552e\u58f0\u7eb9\u6ce8\u518c\u5931\u8d25')
      updateDebug({ speakerStatus: 'voiceprint_failed', lastError: message })
      setSpeakerDiagnostics('\u9500\u552e\u58f0\u7eb9\u6ce8\u518c\u5f02\u5e38')
      appendStateChange(message, 'sales')
    } finally {
      setIsRegisteringVoiceprint(false)
    }
  }

  async function startVoiceSession() {
    try {
      setInputMode('voice')
      setConnectionStatus('connecting')
      setStatusText('\u6b63\u5728\u8fde\u63a5\u5b9e\u65f6\u8f6c\u5199')
      stream.updateStatus('active')
      utteranceAudioRef.current.reset()
      lastUtteranceSnapshotRef.current = null
      updateDebug({
        audioStatus: 'requesting_microphone',
        asrStatus: 'starting',
        networkStatus: 'connecting',
        speakerStatus: voiceprintReady ? 'voiceprint_ready' : 'voiceprint_missing',
        lastError: '',
      })
      appendStateChange('realtime_asr_started')

      const realtimeSession = new RealtimeAsrSession()
      realtimeSessionRef.current = realtimeSession
      await realtimeSession.connect({
        onEvent: handleRealtimeEvent,
        onNetworkStatus: (networkStatus) => updateDebug({ networkStatus }),
        onError: (lastError) => updateDebug({ lastError }),
      })

      const audioCapture = new AudioCaptureService()
      audioCaptureRef.current = audioCapture
      await audioCapture.start({
        targetSampleRate: realtimeSession.sampleRate,
        chunkMs: 100,
        onChunk: ({ audio, byteLength, timestamp, captureLatencyMs }) => {
          utteranceAudioRef.current.addChunk({ audio, byteLength, timestamp })
          const sendResult = realtimeSession.sendAudio(audio)
          if (sendResult.ok) {
            setDebugState((current) => ({
              ...current,
              audioStatus: 'streaming',
              audioCaptureLatencyMs: captureLatencyMs,
              chunksSent: current.chunksSent + 1,
              bytesSent: current.bytesSent + byteLength,
            }))
            return
          }
          setDebugState((current) => ({
            ...current,
            droppedChunks: current.droppedChunks + 1,
            lastError: sendResult.reason || 'audio_chunk_send_failed',
          }))
        },
      })

      setConnectionStatus('listening')
      setStatusText(S.listening)
      updateDebug({ audioStatus: 'recording', asrStatus: 'listening', networkStatus: 'connected' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'realtime_asr_start_failed'
      setConnectionStatus('error')
      setStatusText('\u966a\u542c\u542f\u52a8\u5931\u8d25')
      updateDebug({ audioStatus: 'error', asrStatus: 'error', networkStatus: 'error', lastError: message })
      appendStateChange(message)
      stopVoiceSession()
    }
  }

  function pauseVoiceSession() {
    cancelPendingIntervention('pause_session')
    coachVoicePlayerRef.current.stop()
    setVoiceState(coachVoicePlayerRef.current.getState())
    audioCaptureRef.current?.stop()
    audioCaptureRef.current = null
    realtimeSessionRef.current?.close()
    realtimeSessionRef.current = null
    speechStartedAtRef.current = null
    utteranceAudioRef.current.reset()
    lastUtteranceSnapshotRef.current = null
    stream.updateStatus('paused')
    setConnectionStatus('paused')
    setStatusText(S.paused)
    updateDebug({ audioStatus: 'paused', asrStatus: 'paused', networkStatus: 'closed', partialText: '' })
    appendStateChange('realtime_asr_paused')
  }

  function resumeVoiceSession() {
    void startVoiceSession()
  }

  function stopVoiceSession() {
    cancelPendingIntervention('stop_session')
    coachVoicePlayerRef.current.stop()
    setVoiceState(coachVoicePlayerRef.current.getState())
    audioCaptureRef.current?.stop()
    audioCaptureRef.current = null
    realtimeSessionRef.current?.close()
    realtimeSessionRef.current = null
    registrationCaptureRef.current?.stop()
    registrationCaptureRef.current = null
    speechStartedAtRef.current = null
    utteranceAudioRef.current.reset()
    lastUtteranceSnapshotRef.current = null
    stream.updateStatus('ended')
    setConnectionStatus('idle')
    setIsRegisteringVoiceprint(false)
    setStatusText(S.notStarted)
    updateDebug({ audioStatus: 'idle', asrStatus: 'idle', networkStatus: 'closed', partialText: '' })
    appendStateChange('realtime_asr_ended')
  }

  async function handleManualText() {
    const text = inputText.trim()
    if (!text) return

    const rawSpeaker = await speakerProviderRef.current.identify({
      sessionId: stream.sessionId,
      transcript: text,
      timestamp: new Date().toISOString(),
      metadata: { source: 'manual_text' },
    })
    const speaker = normalizeSpeakerForTranscript(rawSpeaker, text, stream.getAllEvents())
    appendTranscriptEvent(text, speaker, { source: 'manual_text' })
    setInputText('')
  }

  function handleRealtimeEvent(event: QwenRealtimeEvent) {
    if (event.type === 'error' || event.type === 'backend.error') {
      const error = typeof event.error === 'string' ? event.error : event.error?.message || 'realtime_asr_error'
      setConnectionStatus('error')
      setStatusText('\u5b9e\u65f6\u8f6c\u5199\u5f02\u5e38')
      updateDebug({ lastError: error, networkStatus: 'error' })
      appendStateChange(error)
      return
    }

    const turnEvent = turnProviderRef.current.getTurnEvent(event)
    if (turnEvent === 'speech_started') {
      interruptCoachPlayback('speech_started')
      speechStartedAtRef.current = Date.now()
      utteranceAudioRef.current.start()
      lastUtteranceSnapshotRef.current = null
      updateDebug({ audioStatus: 'speech_detected', asrStatus: 'partial', partialText: '' })
      stream.append({ speaker: 'unknown', type: 'state_change', content: 'speech_started', metadata: { provider: 'qwen_server_vad' } })
    }

    if (turnEvent === 'speech_stopped') {
      lastUtteranceSnapshotRef.current = utteranceAudioRef.current.stop()
      updateDebug({ audioStatus: 'processing', asrStatus: 'finalizing' })
      stream.append({
        speaker: 'unknown',
        type: 'state_change',
        content: 'speech_stopped',
        metadata: {
          provider: 'qwen_server_vad',
          utteranceAudioBytes: lastUtteranceSnapshotRef.current.byteLength,
          utteranceAudioChunks: lastUtteranceSnapshotRef.current.chunks.length,
        },
      })
    }

    if (event.type === 'conversation.item.input_audio_transcription.delta' || event.type === 'response.audio_transcript.delta') {
      const delta = event.delta || event.text || ''
      if (!delta) return
      setDebugState((current) => ({ ...current, asrStatus: 'partial', partialText: `${current.partialText}${delta}` }))
      stream.append({ speaker: 'unknown', type: 'transcript_partial', content: delta, metadata: { provider: 'qwen' } })
    }

    if (event.type === 'conversation.item.input_audio_transcription.completed' || event.type === 'response.audio_transcript.done') {
      const transcript = event.transcript || event.text || extractTranscriptFromResponse(event)
      if (transcript) void appendFinalTranscript(transcript)
    }

    if (event.type === 'response.created') {
      realtimeSessionRef.current?.cancelResponse?.()
      stream.append({
        speaker: 'ai_coach',
        type: 'state_change',
        content: 'response_blocked',
        metadata: { responsePolicy: responsePolicyRef.current.evaluate(createPolicyEvent(stream.sessionId)) },
      })
    }
  }

  async function appendFinalTranscript(transcript: string) {
    const startedAt = speechStartedAtRef.current
    const now = Date.now()
    const snapshot = lastUtteranceSnapshotRef.current
    const startProcessing = performance.now()
    const rawSpeaker = await speakerProviderRef.current.identify({
      sessionId: stream.sessionId,
      audioChunks: snapshot?.chunks,
      transcript,
      startedAt: snapshot?.startedAt,
      endedAt: snapshot?.endedAt,
      sampleRate: realtimeSessionRef.current?.sampleRate,
      timestamp: new Date().toISOString(),
      metadata: { source: 'realtime_asr' },
    })
    const speaker = normalizeSpeakerForTranscript(rawSpeaker, transcript, stream.getAllEvents())
    const eventProcessingLatencyMs = Math.round(performance.now() - startProcessing)
    appendTranscriptEvent(transcript, speaker, {
      provider: 'qwen',
      audioBytes: snapshot?.byteLength,
      audioChunks: snapshot?.chunks.length,
    })
    updateDebug({
      asrStatus: 'final',
      partialText: '',
      lastSpeaker: speaker.speaker,
      speakerConfidence: speaker.confidence,
      speakerStatus: speaker.metadata?.reason || 'speaker_identified',
      asrLatencyMs: startedAt ? now - startedAt : null,
      latencyMs: startedAt ? now - startedAt : null,
      eventProcessingLatencyMs,
    })
    setSpeakerDiagnostics(formatSpeakerDiagnostics(speaker))
    speechStartedAtRef.current = null
    lastUtteranceSnapshotRef.current = null
  }

  function appendTranscriptEvent(text: string, speaker: SpeakerIdentificationResult, metadata: Record<string, unknown>) {
    const transcriptEvent = stream.append({
      speaker: speaker.speaker,
      type: 'transcript_final',
      content: text,
      confidence: speaker.confidence || 0.9,
      metadata: { ...metadata, speakerIdentification: speaker },
    })
    updateDebug({
      speakerStatus: speaker.metadata?.reason || 'speaker_identified',
      lastSpeaker: speaker.speaker,
      speakerConfidence: speaker.confidence,
    })
    setSpeakerDiagnostics(formatSpeakerDiagnostics(speaker))
    appendSalesContextUpdate(transcriptEvent)
    stream.append({
      speaker: 'ai_coach',
      type: 'state_change',
      content: 'response_blocked',
      metadata: { responsePolicy: responsePolicyRef.current.evaluate(transcriptEvent) },
    })
  }

  function runDemoCoachScenario() {
    setViewMode('demo')
    const transcriptEvent = stream.append({
      speaker: 'customer',
      type: 'transcript_final',
      content: '\u4f60\u4eec\u4ef7\u683c\u6bd4\u522b\u4eba\u9ad8\u3002',
      confidence: 0.95,
      metadata: { source: 'demo_button' },
    })
    updateDebug({
      audioStatus: 'demo_injected',
      asrStatus: 'final',
      networkStatus: 'demo',
      lastSpeaker: 'customer',
      speakerConfidence: 0.95,
      partialText: '',
      latencyMs: 0,
      asrLatencyMs: 0,
      eventProcessingLatencyMs: 0,
    })
    appendSalesContextUpdate(transcriptEvent)
    stream.append({ speaker: 'ai_coach', type: 'state_change', content: 'response_blocked', metadata: { responsePolicy: responsePolicyRef.current.evaluate(transcriptEvent) } })
  }

  function clearAll() {
    cancelPendingIntervention('clear_all')
    coachVoicePlayerRef.current.stop()
    setVoiceState(coachVoicePlayerRef.current.getState())
    stream.clear()
    salesContextEngineRef.current.reset(stream.sessionId)
    salesStrategyEngineRef.current.reset()
    interventionControllerRef.current.reset()
    setSalesContext(createUnknownSalesContext(stream.sessionId))
    setStrategyRecommendation(createEmptyStrategyRecommendation())
    setInterventionDecision(createSilentInterventionDecision('not_evaluated'))
    setDebugState(initialDebugState)
    setSpeakerDiagnostics('\u672a\u8bc6\u522b')
    setInputText('')
  }

  function setTranscriptSpeaker(eventId: string, speaker: ConversationEvent['speaker']) {
    const updatedEvent = stream.updateEventSpeaker(eventId, speaker)
    if (!updatedEvent || updatedEvent.type !== 'transcript_final') return

    salesContextEngineRef.current.reset(stream.sessionId)
    salesStrategyEngineRef.current.reset()
    interventionControllerRef.current.reset()
    setSalesContext(createUnknownSalesContext(stream.sessionId))
    setStrategyRecommendation(createEmptyStrategyRecommendation())
    setInterventionDecision(createSilentInterventionDecision('speaker_corrected'))
    appendSalesContextUpdate(updatedEvent)
  }

  return (
    <div className="space-y-4 px-3 py-3">
      <section className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1 shadow-sm">
        <ModeButton active={viewMode === 'demo'} icon={<Sparkles size={16} />} label={S.demoMode} onClick={() => setViewMode('demo')} />
        <ModeButton active={viewMode === 'dev'} icon={<Bug size={16} />} label={S.devMode} onClick={() => setViewMode('dev')} dark />
      </section>

      {viewMode === 'demo' ? (
        <DemoView
          connectionStatus={connectionStatus}
          statusText={statusText}
          salesContext={salesContext}
          strategyRecommendation={strategyRecommendation}
          interventionDecision={interventionDecision}
          voiceState={voiceState}
          demoTimeline={demoTimeline}
          isSessionRunning={isSessionRunning}
          onStart={() => void startVoiceSession()}
          onPause={pauseVoiceSession}
          onResume={resumeVoiceSession}
          onStop={stopVoiceSession}
          onDemo={runDemoCoachScenario}
          onClear={clearAll}
        />
      ) : (
        <DevView
          inputMode={inputMode}
          inputText={inputText}
          setInputMode={setInputMode}
          setInputText={setInputText}
          connectionStatus={connectionStatus}
          statusText={statusText}
          isSessionRunning={isSessionRunning}
          isRegisteringVoiceprint={isRegisteringVoiceprint}
          voiceprintReady={voiceprintReady}
          debugState={debugState}
          speakerDiagnostics={speakerDiagnostics}
          session={session}
          conversationBuffer={conversationBuffer}
          salesContext={salesContext}
          strategyRecommendation={strategyRecommendation}
          interventionDecision={interventionDecision}
          voiceState={voiceState}
          recentEvents={recentEvents}
          onStart={() => void startVoiceSession()}
          onPause={pauseVoiceSession}
          onResume={resumeVoiceSession}
          onStop={stopVoiceSession}
          onRegister={() => void registerSalesVoiceprint()}
          onSendText={() => void handleManualText()}
          onDemo={runDemoCoachScenario}
          onClear={clearAll}
          onSetSpeaker={setTranscriptSpeaker}
        />
      )}
    </div>
  )
}

function ModeButton({ active, dark, icon, label, onClick }: { active: boolean; dark?: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  const activeClass = dark ? 'bg-gray-900 text-white' : 'bg-primary-500 text-white'
  return (
    <button type="button" onClick={onClick} className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold ${active ? activeClass : 'text-gray-500'}`}>
      {icon}
      {label}
    </button>
  )
}

interface DemoViewProps {
  connectionStatus: ConnectionStatus
  statusText: string
  salesContext: SalesContext
  strategyRecommendation: StrategyRecommendation
  interventionDecision: InterventionDecision
  voiceState: CoachVoiceState
  demoTimeline: ConversationEvent[]
  isSessionRunning: boolean
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onDemo: () => void
  onClear: () => void
}

function DemoView(props: DemoViewProps) {
  return (
    <>
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(props.connectionStatus)}`} />
              <span className="text-sm font-semibold text-gray-500">{S.currentStatus}</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{demoListeningStatus(props.connectionStatus, props.statusText)}</div>
          </div>
          <button type="button" onClick={props.onDemo} className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white">
            {S.demoPrice}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <SessionButton status={props.connectionStatus} running={props.isSessionRunning} onStart={props.onStart} onPause={props.onPause} onResume={props.onResume} />
          <SmallButton onClick={props.onStop} icon={<CheckCircle2 size={15} />} label={S.stop} />
          <SmallButton onClick={props.onClear} icon={<RefreshCw size={15} />} label={S.clear} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <SignalCard label={S.customerState} value={demoCustomerState(props.salesContext)} tone="green" />
        <SignalCard label={S.whisper} value={props.interventionDecision.message || '\u4fdd\u6301\u5b89\u9759'} tone="blue" />
      </section>

      <InfoCard title={S.aiJudgement} body={demoJudgement(props.salesContext)} />
      <InfoCard title={S.currentSuggestion} body={props.strategyRecommendation.action || '\u7ee7\u7eed\u542c\uff0c\u5148\u4e0d\u8981\u6253\u6270\u9500\u552e\u3002'} sub={props.strategyRecommendation.suggestedPhrase} />

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">{S.liveConversation}</span>
          <span className="flex items-center gap-1 text-xs text-gray-400"><Volume2 size={14} />{tVoiceState(props.voiceState)}</span>
        </div>
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {props.demoTimeline.length === 0 ? <div className="rounded-xl bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">{S.demoEmpty}</div> : null}
          {props.demoTimeline.map((event) => <DialogueBubble key={event.id} speaker={event.speaker} text={event.content} timestamp={formatTime(event.timestamp)} />)}
        </div>
      </section>
    </>
  )
}

function DevView(props: {
  inputMode: 'voice' | 'text'
  inputText: string
  setInputMode: (value: 'voice' | 'text') => void
  setInputText: (value: string) => void
  connectionStatus: ConnectionStatus
  statusText: string
  isSessionRunning: boolean
  isRegisteringVoiceprint: boolean
  voiceprintReady: boolean
  debugState: RealtimeDebugState
  speakerDiagnostics: string
  session: ConversationSession
  conversationBuffer: ConversationBufferItem[]
  salesContext: SalesContext
  strategyRecommendation: StrategyRecommendation
  interventionDecision: InterventionDecision
  voiceState: CoachVoiceState
  recentEvents: ConversationEvent[]
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onRegister: () => void
  onSendText: () => void
  onDemo: () => void
  onClear: () => void
  onSetSpeaker: (eventId: string, speaker: ConversationEvent['speaker']) => void
}) {
  return (
    <>
      <section className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{S.realtimeCopilot}</h1>
        <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white">
          <button type="button" onClick={() => props.setInputMode('voice')} className={`px-3 py-1.5 text-xs font-semibold ${props.inputMode === 'voice' ? 'bg-primary-500 text-white' : 'text-gray-500'}`}>{S.voice}</button>
          <button type="button" onClick={() => props.setInputMode('text')} className={`px-3 py-1.5 text-xs font-semibold ${props.inputMode === 'text' ? 'bg-primary-500 text-white' : 'text-gray-500'}`}>{S.text}</button>
        </div>
      </section>

      {props.inputMode === 'voice' ? (
        <section className="grid grid-cols-[1fr_auto] gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2">
            <Mic size={17} className="text-accent-dark" />
            <span className="text-sm text-gray-500">{S.micStreaming}</span>
          </div>
          <SessionButton status={props.connectionStatus} running={props.isSessionRunning} onStart={props.onStart} onPause={props.onPause} onResume={props.onResume} primary />
        </section>
      ) : (
        <section className="grid grid-cols-[1fr_auto] gap-2">
          <textarea value={props.inputText} onChange={(event) => props.setInputText(event.target.value)} placeholder={S.inputPlaceholder} rows={2} className="min-h-16 resize-none rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary-300" />
          <button type="button" onClick={props.onSendText} className="rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white">{S.send}</button>
        </section>
      )}

      <section className="grid grid-cols-[1fr_auto] gap-2">
        <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(props.connectionStatus)}`} />
            <span className="text-sm font-medium text-gray-700">{props.statusText}</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-gray-400"><Wifi size={14} />{S.onlyTranscript}</span>
        </div>
        <button type="button" onClick={props.onRegister} disabled={props.isRegisteringVoiceprint || props.isSessionRunning} className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold ${props.voiceprintReady ? 'bg-emerald-50 text-emerald-700' : 'border border-gray-100 bg-white text-gray-600'} disabled:opacity-50`}>
          <UserCheck size={15} />
          {props.isRegisteringVoiceprint ? S.registering : props.voiceprintReady ? S.salesRegistered : S.registerSales}
        </button>
      </section>

      <section className="grid grid-cols-[1fr_auto] gap-2">
        <div className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-2.5 text-xs font-semibold text-primary-700">{'\u6f14\u793a\u6ce8\u5165\u7528\u4e8e\u9a8c\u8bc1\u5b8c\u6574\u94fe\u8def'}</div>
        <button type="button" onClick={props.onDemo} className="rounded-xl bg-gray-900 px-3 py-2.5 text-xs font-semibold text-white">{S.demoPrice}</button>
      </section>

      <ContextGrid context={props.salesContext} />
      <StrategyPanel recommendation={props.strategyRecommendation} />
      <CoachPanel decision={props.interventionDecision} voiceState={props.voiceState} />
      <DebugGrid debugState={props.debugState} session={props.session} speakerDiagnostics={props.speakerDiagnostics} />
      <TranscriptPanel debugState={props.debugState} />
      <ConversationPanel items={props.conversationBuffer} session={props.session} onSetSpeaker={props.onSetSpeaker} />
      <EventPanel events={props.recentEvents} total={props.session.events.length} />

      <section className="flex gap-3 pt-2">
        <button type="button" onClick={props.onClear} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-600"><RefreshCw size={16} />{S.clear}</button>
        <button type="button" onClick={props.onStop} className="flex flex-[2] items-center justify-center gap-1.5 rounded-xl bg-primary-500 py-3 text-sm font-medium text-white"><CheckCircle2 size={16} />{'\u7ed3\u675f\u4f1a\u8bdd'}</button>
      </section>
    </>
  )
}

function SessionButton(props: { status: ConnectionStatus; running: boolean; primary?: boolean; onStart: () => void; onPause: () => void; onResume: () => void }) {
  if (props.status === 'listening') return <button type="button" onClick={props.onPause} className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white"><Pause size={16} />{S.pause}</button>
  if (props.status === 'paused') return <button type="button" onClick={props.onResume} className="flex items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white"><Play size={16} />{S.resume}</button>
  const classes = props.primary ? 'bg-primary-500 px-4 py-2 text-sm text-white' : 'bg-primary-50 py-2 text-xs text-primary-700'
  return <button type="button" onClick={props.onStart} disabled={props.running} className={`flex items-center justify-center gap-1.5 rounded-xl font-semibold disabled:opacity-50 ${classes}`}><Mic size={16} />{props.primary ? S.start : S.startListening}</button>
}

function SmallButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-100 py-2 text-xs font-semibold text-gray-600">{icon}{label}</button>
}

function SignalCard({ label, value, tone }: { label: string; value: string; tone: 'green' | 'blue' }) {
  const toneClass = tone === 'green' ? 'bg-emerald-50 text-emerald-900' : 'bg-primary-50 text-primary-900'
  return <div className={`rounded-2xl p-4 shadow-sm ${toneClass}`}><div className="text-xs font-semibold opacity-70">{label}</div><div className="mt-2 text-xl font-bold leading-tight">{value}</div></div>
}

function InfoCard({ title, body, sub }: { title: string; body: string; sub?: string }) {
  return <section className="rounded-2xl bg-white p-4 shadow-sm"><div className="mb-2 text-sm font-semibold text-gray-500">{title}</div><p className="text-lg font-bold leading-snug text-gray-900">{body}</p>{sub ? <p className="mt-2 rounded-xl bg-primary-50 px-3 py-2 text-sm leading-relaxed text-primary-800">{sub}</p> : null}</section>
}

function DialogueBubble({ speaker, text, timestamp }: { speaker: ConversationEvent['speaker']; text: string; timestamp: string }) {
  return (
    <div className={`flex ${speaker === 'ai_coach' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${speaker === 'ai_coach' ? 'bg-primary-500 text-white' : speaker === 'sales' ? 'bg-emerald-50 text-emerald-900' : 'bg-gray-100 text-gray-900'}`}>
        <div className={`mb-1 text-[11px] ${speaker === 'ai_coach' ? 'text-primary-100' : 'text-gray-400'}`}>{speaker === 'ai_coach' ? S.whisper : tSpeaker(speaker)} · {timestamp}</div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  )
}

function ContextGrid({ context }: { context: SalesContext }) {
  const items = [
    ['\u9500\u552e\u9636\u6bb5', tSalesContextValue(context.stage)],
    ['\u5ba2\u6237\u72b6\u6001', tSalesContextValue(context.customerState)],
    ['\u5ba2\u6237\u610f\u56fe', tSalesContextValue(context.customerIntent)],
    ['\u5f53\u524d\u5f02\u8bae', tSalesContextValue(context.objectionType)],
    ['\u98ce\u9669\u7b49\u7ea7', tSalesContextValue(context.riskLevel)],
    ['\u7f6e\u4fe1\u5ea6', `${Math.round(context.confidence * 100)}%`],
  ]
  return <section className="grid grid-cols-2 gap-2">{items.map(([label, value]) => <MiniCard key={label} label={label} value={value} />)}</section>
}

function StrategyPanel({ recommendation }: { recommendation: StrategyRecommendation }) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white p-3">
      <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold text-gray-800">{'\u5f53\u524d\u7b56\u7565'}</span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClass(recommendation.priority)}`}>{tPriority(recommendation.priority)}</span></div>
      <p className="text-sm leading-relaxed text-gray-800">{recommendation.action || '\u6682\u65e0\u7b56\u7565\u5efa\u8bae\u3002'}</p>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{recommendation.suggestedPhrase || '-'}</p>
    </section>
  )
}

function CoachPanel({ decision, voiceState }: { decision: InterventionDecision; voiceState: CoachVoiceState }) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white p-3">
      <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold text-gray-800">{'\u5b9e\u65f6\u8033\u8fb9\u6559\u7ec3'}</span><span className="rounded-full bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-500">{tVoiceState(voiceState)}</span></div>
      <p className="text-sm leading-relaxed text-gray-800">{decision.message || '\u9ed8\u8ba4\u4fdd\u6301\u6c89\u9ed8\u3002'}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <MetricPill label="\u51b3\u7b56" value={decision.shouldIntervene ? '\u63d0\u9192' : '\u6c89\u9ed8'} />
        <MetricPill label="\u539f\u56e0" value={tReason(decision.reason)} />
      </div>
    </section>
  )
}

function DebugGrid({ debugState, session, speakerDiagnostics }: { debugState: RealtimeDebugState; session: ConversationSession; speakerDiagnostics: string }) {
  const items = [
    ['\u97f3\u9891\u72b6\u6001', tReason(debugState.audioStatus)],
    ['\u8f6c\u5199\u72b6\u6001', tReason(debugState.asrStatus)],
    ['\u7f51\u7edc\u72b6\u6001', tReason(debugState.networkStatus)],
    ['\u8bf4\u8bdd\u4eba', tSpeaker(debugState.lastSpeaker)],
    ['\u8bf4\u8bdd\u4eba\u7f6e\u4fe1\u5ea6', debugState.speakerConfidence === null ? '-' : debugState.speakerConfidence.toFixed(2)],
    [S.speakerDiagnosis, speakerDiagnostics],
    ['\u8f6c\u5199\u5ef6\u8fdf', debugState.asrLatencyMs === null ? '-' : `${debugState.asrLatencyMs}ms`],
    ['\u97f3\u9891\u5206\u7247', `${debugState.chunksSent}`],
    ['\u4f1a\u8bdd', session.sessionId.slice(-8)],
  ]
  return <section className="grid grid-cols-2 gap-2">{items.map(([label, value]) => <MiniCard key={label} label={label} value={value} />)}</section>
}

function TranscriptPanel({ debugState }: { debugState: RealtimeDebugState }) {
  return <section className="rounded-xl border border-gray-100 bg-white p-3"><div className="mb-1 flex items-center justify-between"><span className="text-sm font-semibold text-gray-800">{'\u5b9e\u65f6\u8f6c\u5199'}</span><span className="text-xs text-gray-400">{'\u5df2\u53d1\u9001'} {Math.round(debugState.bytesSent / 1024)} KB</span></div><p className="min-h-10 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{debugState.partialText || S.waitingSpeech}</p>{debugState.lastError ? <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600">{tReason(debugState.lastError)}</p> : null}</section>
}

function ConversationPanel({ items, session, onSetSpeaker }: { items: ConversationBufferItem[]; session: ConversationSession; onSetSpeaker: (eventId: string, speaker: ConversationEvent['speaker']) => void }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between"><span className="text-sm font-semibold text-gray-800">{S.liveConversation}</span><span className="text-xs text-gray-400">{items.length} {'\u6761'} · {tSessionStatus(session.status)}</span></div>
      <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-gray-100 bg-white px-3 py-3">
        {items.length === 0 ? <div className="py-6 text-center text-sm text-gray-400">{S.noDialogue}</div> : null}
        {items.map((item, index) => (
          <div key={item.eventId || `${item.timestamp}_${index}`} className="rounded-xl bg-gray-50 px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-400"><span className={item.speaker === 'sales' ? 'text-emerald-600' : item.speaker === 'customer' ? 'text-primary-600' : ''}>{tSpeaker(item.speaker)}</span><span>{item.timestamp}</span></div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{item.text}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => onSetSpeaker(item.eventId, 'sales')} className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${item.speaker === 'sales' ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-gray-500'}`}>{S.markSales}</button>
              <button type="button" onClick={() => onSetSpeaker(item.eventId, 'customer')} className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${item.speaker === 'customer' ? 'bg-primary-100 text-primary-700' : 'bg-white text-gray-500'}`}>{S.markCustomer}</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function EventPanel({ events, total }: { events: ConversationEvent[]; total: number }) {
  return <section className="rounded-xl border border-gray-100 bg-white p-3"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold text-gray-800">{'\u4e8b\u4ef6\u6d41\u8c03\u8bd5'}</span><span className="text-xs text-gray-400">{events.length} / {total}</span></div><div className="max-h-44 space-y-2 overflow-y-auto">{events.map((event) => <div key={event.id} className="rounded-lg bg-gray-50 px-2 py-1.5"><div className="flex items-center justify-between text-[11px] text-gray-400"><span>{tEventType(event.type)} · {tSpeaker(event.speaker)}</span><span>{formatTime(event.timestamp)}</span></div><div className="mt-0.5 truncate text-xs text-gray-700">{tEventContent(event.content)}</div></div>)}</div></section>
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-100 bg-white px-3 py-2"><div className="text-xs text-gray-400">{label}</div><div className="mt-1 truncate text-sm font-semibold text-gray-800">{value}</div></div>
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-gray-50 px-2 py-1.5"><span className="text-gray-400">{label} </span><span className="font-semibold text-gray-700">{value}</span></div>
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function createPolicyEvent(sessionId: string): ConversationEvent {
  return {
    id: 'qwen_response_created',
    sessionId,
    sequence: 0,
    timestamp: new Date().toISOString(),
    speaker: 'unknown',
    type: 'state_change',
    content: 'response.created',
  }
}

function extractTranscriptFromResponse(event: QwenRealtimeEvent) {
  return event.response?.output?.flatMap((output) => output.content || []).map((content) => content.transcript || content.text || '').join('').trim() || ''
}

function getLatestTranscriptEvent(events: ConversationEvent[]) {
  const transcripts = events.filter((event) => event.type === 'transcript_final')
  return transcripts[transcripts.length - 1]
}

function normalizeSpeakerForTranscript(result: SpeakerIdentificationResult, transcript: string, events: ConversationEvent[] = []): SpeakerIdentificationResult {
  const looksLikeCustomer = containsAny(transcript, ['\u4f60\u4eec', '\u522b\u4eba\u5bb6', '\u53e6\u4e00\u5bb6', '\u7ade\u54c1', '\u592a\u8d35', '\u4ef7\u683c\u9ad8', '\u4e0d\u653e\u5fc3', '\u518d\u770b\u770b', '\u8003\u8651\u4e00\u4e0b', '\u4f18\u60e0\u70b9', '\u4e0d\u4f1a\u7528', '\u552e\u540e'])
  const looksLikeSales = containsAny(transcript, ['\u6211\u4eec\u53ef\u4ee5', '\u6211\u5e2e\u60a8', '\u6211\u5e2e\u4f60', '\u7ed9\u60a8', '\u7ed9\u4f60', '\u8fd9\u8fb9', '\u6211\u4eec\u7684\u4f18\u52bf', '\u6211\u5efa\u8bae', '\u60a8\u8fd9\u8fb9', '\u4f60\u8fd9\u8fb9', '\u54b1\u4eec', '\u6211\u5148', '\u6211\u6765'])
  if (result.speaker === 'sales' && looksLikeCustomer && !looksLikeSales) return overrideSpeaker(result, 'customer', 'transcript_customer_signal_override', 0.68)
  if (result.speaker !== 'sales' && looksLikeSales && !looksLikeCustomer) return overrideSpeaker(result, 'sales', 'transcript_sales_signal_override', 0.66)
  if (result.speaker !== 'unknown') return result

  const latestTranscript = getLatestTranscriptEvent(events)
  if (latestTranscript?.speaker === 'sales' && looksLikeCustomer) return overrideSpeaker(result, 'customer', 'conversation_turn_customer_fallback', 0.62)
  if (latestTranscript?.speaker === 'customer' && looksLikeSales) return overrideSpeaker(result, 'sales', 'conversation_turn_sales_fallback', 0.62)
  if (looksLikeCustomer) return overrideSpeaker(result, 'customer', 'transcript_customer_signal_fallback', 0.6)
  if (looksLikeSales) return overrideSpeaker(result, 'sales', 'transcript_sales_signal_fallback', 0.6)
  return result
}

function overrideSpeaker(result: SpeakerIdentificationResult, speaker: Exclude<ConversationEvent['speaker'], 'ai_coach'>, reason: string, confidence: number): SpeakerIdentificationResult {
  return {
    ...result,
    speaker,
    confidence: Math.max(result.confidence, confidence),
    metadata: { ...result.metadata, originalSpeaker: result.speaker, reason },
  }
}

function formatSpeakerDiagnostics(result: SpeakerIdentificationResult) {
  const score = typeof result.metadata?.score === 'number' ? result.metadata.score.toFixed(2) : '-'
  const pitch = typeof result.metadata?.pitchMeanHz === 'number' ? `${result.metadata.pitchMeanHz}Hz` : '-'
  const registeredPitch = typeof result.metadata?.registeredPitchMeanHz === 'number' ? `${result.metadata.registeredPitchMeanHz}Hz` : '-'
  const pitchDiff = typeof result.metadata?.pitchDiffHz === 'number' ? `${result.metadata.pitchDiffHz}Hz` : '-'
  const spectrum = typeof result.metadata?.spectrumScore === 'number' ? result.metadata.spectrumScore.toFixed(2) : '-'
  return `\u5206\u6570 ${score} · \u97f3\u9ad8 ${pitch}/${registeredPitch} · \u5dee ${pitchDiff} · \u9891\u8c31 ${spectrum}`
}

function isLikelyWrongSalesAnswer(text: string, context: SalesContext) {
  if (context.objectionType === 'price') return containsAny(text, ['\u7ed9\u4f60\u4fbf\u5b9c', '\u964d\u4ef7', '\u6700\u4f4e\u4ef7', '\u6253\u6298', '\u4f18\u60e0\u4e00\u70b9'])
  if (context.objectionType === 'competitor') return containsAny(text, ['\u4ed6\u4eec\u4e0d\u884c', '\u7ade\u54c1\u4e0d\u597d', '\u522b\u4eba\u5bb6\u4e0d\u9760\u8c31', '\u4ed6\u4eec\u5f88\u5dee'])
  return false
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function statusDotClass(status: ConnectionStatus) {
  if (status === 'error') return 'bg-red-500'
  if (status === 'listening' || status === 'connecting') return 'bg-accent'
  return 'bg-gray-300'
}

function demoListeningStatus(status: ConnectionStatus, fallback: string) {
  const map: Record<ConnectionStatus, string> = {
    idle: S.notStarted,
    connecting: S.preparing,
    listening: S.listening,
    paused: S.paused,
    error: S.error,
  }
  return map[status] || fallback
}

function demoCustomerState(context: SalesContext) {
  if (context.objectionType === 'price') return '\u4ef7\u683c\u5f02\u8bae'
  if (context.objectionType === 'competitor') return '\u7ade\u54c1\u6bd4\u8f83'
  if (context.customerState === 'hesitant') return '\u72b9\u8c6b\u89c2\u671b'
  if (context.customerIntent === 'buying_signal') return '\u8d2d\u4e70\u4fe1\u53f7'
  if (context.customerState !== 'unknown') return tSalesContextValue(context.customerState)
  return '\u7b49\u5f85\u5ba2\u6237\u8868\u8fbe'
}

function demoJudgement(context: SalesContext) {
  if (context.objectionType === 'price') return '\u5ba2\u6237\u62c5\u5fc3\u4ef7\u683c\uff0c\u4e0d\u662f\u4e0d\u611f\u5174\u8da3\u3002'
  if (context.objectionType === 'competitor') return '\u5ba2\u6237\u6b63\u5728\u6bd4\u8f83\u9009\u62e9\uff0c\u5173\u952e\u662f\u786e\u8ba4\u51b3\u7b56\u6807\u51c6\u3002'
  if (context.customerState === 'hesitant') return '\u5ba2\u6237\u8fd8\u6ca1\u8bf4\u51fa\u771f\u6b63\u5361\u70b9\u3002'
  if (context.customerIntent === 'buying_signal') return '\u5ba2\u6237\u5df2\u7ecf\u51fa\u73b0\u63a8\u8fdb\u4fe1\u53f7\u3002'
  return '\u7ee7\u7eed\u966a\u542c\uff0c\u6682\u4e0d\u5224\u65ad\u3002'
}

function priorityClass(value: string) {
  if (value === 'high') return 'bg-red-50 text-red-600'
  if (value === 'medium') return 'bg-amber-50 text-amber-600'
  if (value === 'low') return 'bg-emerald-50 text-emerald-600'
  return 'bg-gray-50 text-gray-400'
}

function tSpeaker(value: string) {
  const map: Record<string, string> = {
    customer: '\u5ba2\u6237',
    sales: '\u9500\u552e',
    unknown: '\u672a\u77e5',
    ai_coach: '\u667a\u80fd\u6559\u7ec3',
  }
  return map[value] || value
}

function tSessionStatus(value: string) {
  const map: Record<string, string> = { active: '\u8fdb\u884c\u4e2d', paused: '\u5df2\u6682\u505c', ended: '\u5df2\u7ed3\u675f' }
  return map[value] || value
}

function tPriority(value: string) {
  const map: Record<string, string> = { none: '\u65e0', low: '\u4f4e', medium: '\u4e2d', high: '\u9ad8', urgent: '\u7d27\u6025' }
  return map[value] || value
}

function tVoiceState(value: string) {
  const map: Record<string, string> = { idle: '\u672a\u64ad\u62a5', playing: '\u64ad\u62a5\u4e2d', interrupted: '\u5df2\u6253\u65ad', stopped: '\u5df2\u505c\u6b62' }
  return map[value] || value
}

function tSalesContextValue(value: string) {
  const map: Record<string, string> = {
    opening: '\u9996\u6b21\u63a5\u89e6',
    discovery: '\u9700\u6c42\u6316\u6398',
    solution_presentation: '\u65b9\u6848\u4ecb\u7ecd',
    objection_handling: '\u5f02\u8bae\u5904\u7406',
    pricing: '\u4ef7\u683c\u8ba8\u8bba',
    closing: '\u6210\u4ea4\u63a8\u8fdb',
    unknown: '\u672a\u77e5',
    interested: '\u6709\u5174\u8da3',
    neutral: '\u666e\u901a\u4ea4\u6d41',
    hesitant: '\u72b9\u8c6b',
    price_sensitive: '\u4ef7\u683c\u654f\u611f',
    skeptical: '\u4e0d\u4fe1\u4efb',
    ready_to_buy: '\u8d2d\u4e70\u610f\u613f\u660e\u663e',
    asking_information: '\u8be2\u95ee\u4fe1\u606f',
    comparing: '\u6bd4\u8f83\u7ade\u54c1',
    objecting: '\u63d0\u51fa\u5f02\u8bae',
    negotiating: '\u8c08\u5224',
    buying_signal: '\u8d2d\u4e70\u4fe1\u53f7',
    leaving: '\u51c6\u5907\u7ed3\u675f',
    price: '\u4ef7\u683c',
    trust: '\u4fe1\u4efb',
    need: '\u9700\u6c42\u4e0d\u8db3',
    timing: '\u65f6\u95f4\u95ee\u9898',
    competitor: '\u7ade\u54c1\u6bd4\u8f83',
    authority: '\u51b3\u7b56\u6743\u95ee\u9898',
    low: '\u4f4e',
    medium: '\u4e2d',
    high: '\u9ad8',
  }
  return map[value] || value
}

function tEventType(value: string) {
  const map: Record<string, string> = {
    audio: '\u97f3\u9891',
    transcript_partial: '\u4e34\u65f6\u8f6c\u5199',
    transcript_final: '\u5b8c\u6574\u8f6c\u5199',
    state_change: '\u72b6\u6001\u53d8\u5316',
    sales_signal: '\u9500\u552e\u4fe1\u53f7',
    coach_suggestion: '\u6559\u7ec3\u63d0\u9192',
    suggestion: '\u5efa\u8bae',
    intervention: '\u63d0\u9192\u51b3\u7b56',
    context_update: '\u4e0a\u4e0b\u6587\u66f4\u65b0',
    strategy_recommendation: '\u7b56\u7565\u5efa\u8bae',
    latency_metric: '\u5ef6\u8fdf\u6307\u6807',
    session_marker: '\u4f1a\u8bdd\u6807\u8bb0',
  }
  return map[value] || value
}

function tEventContent(value: string) {
  const map: Record<string, string> = {
    page_hidden_auto_paused: '\u9875\u9762\u9690\u85cf\uff0c\u5df2\u81ea\u52a8\u6682\u505c',
    sales_context_updated: '\u9500\u552e\u4e0a\u4e0b\u6587\u5df2\u66f4\u65b0',
    sales_strategy_recommended: '\u5df2\u751f\u6210\u9500\u552e\u7b56\u7565',
    coach_cancelled_sales_started: '\u9500\u552e\u5f00\u59cb\u8bf4\u8bdd\uff0c\u5df2\u53d6\u6d88\u63d0\u9192',
    coach_playback_finished: '\u6559\u7ec3\u63d0\u9192\u64ad\u653e\u7ed3\u675f',
    response_blocked: '\u5df2\u963b\u6b62\u6a21\u578b\u4e3b\u52a8\u56de\u590d',
    speech_started: '\u68c0\u6d4b\u5230\u5f00\u59cb\u8bf4\u8bdd',
    speech_stopped: '\u68c0\u6d4b\u5230\u505c\u6b62\u8bf4\u8bdd',
  }
  if (value.startsWith('coach_pending_cancelled:')) return `\u5f85\u64ad\u63d0\u9192\u5df2\u53d6\u6d88\uff1a${tReason(value.replace('coach_pending_cancelled:', ''))}`
  if (value.startsWith('coach_interrupted:')) return `\u6559\u7ec3\u63d0\u9192\u5df2\u6253\u65ad\uff1a${tReason(value.replace('coach_interrupted:', ''))}`
  return map[value] || value
}

function tReason(value: string) {
  const map: Record<string, string> = {
    idle: '\u7a7a\u95f2',
    requesting_microphone: '\u8bf7\u6c42\u9ea6\u514b\u98ce',
    starting: '\u542f\u52a8\u4e2d',
    connecting: '\u8fde\u63a5\u4e2d',
    streaming: '\u4f20\u8f93\u4e2d',
    connected: '\u5df2\u8fde\u63a5',
    recording: '\u5f55\u97f3\u4e2d',
    listening: '\u76d1\u542c\u4e2d',
    speech_detected: '\u68c0\u6d4b\u5230\u8bf4\u8bdd',
    partial: '\u4e34\u65f6\u8f6c\u5199',
    processing: '\u5904\u7406\u4e2d',
    finalizing: '\u751f\u6210\u5b8c\u6574\u8f6c\u5199',
    final: '\u5b8c\u6574\u8f6c\u5199',
    paused: '\u5df2\u6682\u505c',
    closed: '\u5df2\u5173\u95ed',
    error: '\u9519\u8bef',
    stopped: '\u5df2\u505c\u6b62',
    demo: '\u6f14\u793a\u6a21\u5f0f',
    demo_injected: '\u6f14\u793a\u6ce8\u5165',
    voiceprint_missing: '\u672a\u6ce8\u518c\u9500\u552e\u58f0\u7eb9',
    registering_sales_voiceprint: '\u6b63\u5728\u6ce8\u518c\u9500\u552e\u58f0\u7eb9',
    voiceprint_ready: '\u9500\u552e\u58f0\u7eb9\u5df2\u5c31\u7eea',
    voiceprint_failed: '\u9500\u552e\u58f0\u7eb9\u5931\u8d25',
    matched_sales_voiceprint: '\u8bc6\u522b\u4e3a\u9500\u552e',
    not_sales_voiceprint: '\u8bc6\u522b\u4e3a\u5ba2\u6237',
    utterance_audio_missing: '\u7f3a\u5c11\u8bed\u97f3\u7247\u6bb5',
    transcript_sales_signal_override: '\u6309\u9500\u552e\u8bdd\u672f\u7ea0\u504f',
    transcript_customer_signal_override: '\u6309\u5ba2\u6237\u8868\u8fbe\u7ea0\u504f',
    conversation_turn_sales_fallback: '\u6309\u5bf9\u8bdd\u8f6e\u6b21\u5224\u4e3a\u9500\u552e',
    conversation_turn_customer_fallback: '\u6309\u5bf9\u8bdd\u8f6e\u6b21\u5224\u4e3a\u5ba2\u6237',
    transcript_sales_signal_fallback: '\u6309\u6587\u672c\u5224\u4e3a\u9500\u552e',
    transcript_customer_signal_fallback: '\u6309\u6587\u672c\u5224\u4e3a\u5ba2\u6237',
    speaker_corrected: '\u8bf4\u8bdd\u4eba\u5df2\u624b\u52a8\u4fee\u6b63',
    no_strategy: '\u6682\u65e0\u7b56\u7565',
    cooldown_active: '\u51b7\u5374\u4e2d',
    ASR_ONLY_PHASE: 'ASR-only \u9636\u6bb5\uff0c\u7981\u6b62\u6a21\u578b\u4e3b\u52a8\u56de\u590d',
  }
  if (value.startsWith('ws_state_')) return `\u5b9e\u65f6\u8fde\u63a5\u72b6\u6001\u5f02\u5e38\uff1a${value.replace('ws_state_', '')}`
  return map[value] || value
}
