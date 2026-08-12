import type {
  SpeakerIdentificationInput,
  SpeakerIdentificationResult,
} from '../types/conversation'

export interface SpeakerIdentificationProvider {
  identify(input: SpeakerIdentificationInput): Promise<SpeakerIdentificationResult>
}

interface Voiceprint {
  sampleRate: number
  features: AudioFeatures
  createdAt: string
}

interface AudioFeatures {
  rms: number
  peak: number
  zeroCrossingRate: number
  avgAbsDelta: number
  pitchMeanHz: number
  pitchStdHz: number
  voicedRatio: number
  spectralCentroidHz: number
  lowBandRatio: number
  midBandRatio: number
  highBandRatio: number
  bandProfile: number[]
  durationMs: number
}

interface CompareResult {
  score: number
  parts: {
    pitch: number
    pitchStd: number
    spectrum: number
    centroid: number
    zcr: number
    voiced: number
    delta: number
    rms: number
  }
  pitchDiffHz: number
}

const DEFAULT_SAMPLE_RATE = 16000
const BAND_FREQUENCIES = [120, 220, 350, 500, 750, 1100, 1600, 2400, 3400]

export class SalesVoiceprintSpeakerIdentificationProvider implements SpeakerIdentificationProvider {
  private voiceprint: Voiceprint | null = null
  private readonly threshold: number

  constructor(options: { threshold?: number } = {}) {
    this.threshold = options.threshold ?? 0.66
  }

  registerSalesVoiceprint(audioChunks: string[], sampleRate: number) {
    const features = extractFeatures(audioChunks, sampleRate)
    if (!features) {
      return false
    }

    this.voiceprint = {
      sampleRate,
      features,
      createdAt: new Date().toISOString(),
    }
    return true
  }

  clearSalesVoiceprint() {
    this.voiceprint = null
  }

  hasSalesVoiceprint() {
    return Boolean(this.voiceprint)
  }

  async identify(input: SpeakerIdentificationInput): Promise<SpeakerIdentificationResult> {
    if (!this.voiceprint) {
      return {
        speaker: 'unknown',
        confidence: 0,
        metadata: {
          provider: 'sales_voiceprint',
          matchedSalesVoiceprint: false,
          reason: 'sales_voiceprint_missing',
        },
      }
    }

    const sampleRate = input.sampleRate ?? this.voiceprint.sampleRate ?? DEFAULT_SAMPLE_RATE
    const features = extractFeatures(input.audioChunks || (input.audioChunk ? [input.audioChunk] : []), sampleRate)
    if (!features) {
      return {
        speaker: 'unknown',
        confidence: 0,
        metadata: {
          provider: 'sales_voiceprint',
          matchedSalesVoiceprint: false,
          reason: 'utterance_audio_missing',
        },
      }
    }

    const comparison = compareFeatures(this.voiceprint.features, features)
    const matchedSalesVoiceprint = comparison.score >= this.threshold

    return {
      speaker: matchedSalesVoiceprint ? 'sales' : 'unknown',
      confidence: comparison.score,
      metadata: {
        provider: 'sales_voiceprint',
        matchedSalesVoiceprint,
        score: comparison.score,
        threshold: this.threshold,
        sampleRate,
        reason: matchedSalesVoiceprint ? 'matched_sales_voiceprint' : 'voiceprint_inconclusive',
        pitchMeanHz: Math.round(features.pitchMeanHz),
        registeredPitchMeanHz: Math.round(this.voiceprint.features.pitchMeanHz),
        pitchDiffHz: Math.round(comparison.pitchDiffHz),
        voicedRatio: round2(features.voicedRatio),
        spectrumScore: round2(comparison.parts.spectrum),
        pitchScore: round2(comparison.parts.pitch),
      },
    }
  }
}

export class MockSpeakerIdentificationProvider implements SpeakerIdentificationProvider {
  async identify(input: SpeakerIdentificationInput): Promise<SpeakerIdentificationResult> {
    return {
      speaker: input.audioChunks?.length ? 'customer' : 'unknown',
      confidence: input.audioChunks?.length ? 0.55 : 0,
      metadata: {
        provider: 'mock',
        channel: input.channel,
        reason: input.audioChunks?.length ? 'mock_non_sales_default' : 'mock_audio_missing',
      },
    }
  }
}

function extractFeatures(audioChunks: string[], sampleRate = DEFAULT_SAMPLE_RATE): AudioFeatures | null {
  const samples = audioChunks.flatMap(pcm16Base64ToFloatSamples)
  if (samples.length < Math.floor(sampleRate * 0.2)) {
    return null
  }

  let energy = 0
  let peak = 0
  let zeroCrossings = 0
  let absDelta = 0
  let last = samples[0]

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    energy += sample * sample
    peak = Math.max(peak, Math.abs(sample))

    if (index > 0) {
      if ((sample >= 0 && last < 0) || (sample < 0 && last >= 0)) {
        zeroCrossings += 1
      }
      absDelta += Math.abs(sample - last)
      last = sample
    }
  }

  const rms = Math.sqrt(energy / samples.length)
  const frameSize = Math.max(320, Math.floor(sampleRate * 0.032))
  const hopSize = Math.max(160, Math.floor(sampleRate * 0.016))
  const pitches: number[] = []
  const bandTotals = new Array(BAND_FREQUENCIES.length).fill(0)
  let voicedFrames = 0
  let usableFrames = 0

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const frame = samples.slice(start, start + frameSize)
    const frameRms = frameRootMeanSquare(frame)
    if (frameRms < Math.max(0.008, rms * 0.38)) {
      continue
    }

    usableFrames += 1
    const pitch = estimatePitchHz(frame, sampleRate)
    if (pitch > 0) {
      pitches.push(pitch)
      voicedFrames += 1
    }

    const frameBands = bandEnergies(frame, sampleRate)
    for (let index = 0; index < frameBands.length; index += 1) {
      bandTotals[index] += frameBands[index]
    }
  }

  if (usableFrames === 0) {
    return null
  }

  const bandSum = bandTotals.reduce((sum, value) => sum + value, 0) || 1
  const bandProfile = bandTotals.map((value) => value / bandSum)
  const pitchMeanHz = pitches.length ? mean(pitches) : 0
  const pitchStdHz = pitches.length > 1 ? standardDeviation(pitches, pitchMeanHz) : 0
  const spectralCentroidHz = bandProfile.reduce((sum, ratio, index) => sum + ratio * BAND_FREQUENCIES[index], 0)
  const lowBandRatio = bandProfile.slice(0, 3).reduce((sum, value) => sum + value, 0)
  const midBandRatio = bandProfile.slice(3, 6).reduce((sum, value) => sum + value, 0)
  const highBandRatio = bandProfile.slice(6).reduce((sum, value) => sum + value, 0)

  return {
    rms,
    peak,
    zeroCrossingRate: zeroCrossings / samples.length,
    avgAbsDelta: absDelta / Math.max(1, samples.length - 1),
    pitchMeanHz,
    pitchStdHz,
    voicedRatio: voicedFrames / usableFrames,
    spectralCentroidHz,
    lowBandRatio,
    midBandRatio,
    highBandRatio,
    bandProfile,
    durationMs: (samples.length / sampleRate) * 1000,
  }
}

function compareFeatures(reference: AudioFeatures, current: AudioFeatures): CompareResult {
  const pitchDiffHz = Math.abs(reference.pitchMeanHz - current.pitchMeanHz)
  const pitch = pitchSimilarity(reference, current)
  const pitchStd = similarity(reference.pitchStdHz, current.pitchStdHz, 55)
  const spectrum = cosineSimilarity(reference.bandProfile, current.bandProfile)
  const centroid = similarity(reference.spectralCentroidHz, current.spectralCentroidHz, 1250)
  const zcr = similarity(reference.zeroCrossingRate, current.zeroCrossingRate, 0.14)
  const voiced = similarity(reference.voicedRatio, current.voicedRatio, 0.45)
  const delta = similarity(reference.avgAbsDelta, current.avgAbsDelta, 0.12)
  const rms = similarity(reference.rms, current.rms, 0.28)

  let score = clamp01(
    (pitch * 0.3) +
    (spectrum * 0.32) +
    (centroid * 0.14) +
    (zcr * 0.08) +
    (voiced * 0.07) +
    (pitchStd * 0.04) +
    (delta * 0.03) +
    (rms * 0.02),
  )

  const bothVoiced = reference.voicedRatio > 0.25 && current.voicedRatio > 0.25 && reference.pitchMeanHz > 0 && current.pitchMeanHz > 0
  if (bothVoiced && pitchDiffHz > 95) {
    score = Math.min(score, 0.48)
  } else if (bothVoiced && pitchDiffHz > 65 && spectrum < 0.82) {
    score = Math.min(score, 0.58)
  } else if (bothVoiced && pitchDiffHz > 45 && spectrum < 0.72) {
    score = Math.min(score, 0.66)
  }

  if (pitch < 0.45 && spectrum < 0.62) {
    score = Math.min(score, 0.56)
  }

  return {
    score: clamp01(score),
    pitchDiffHz,
    parts: {
      pitch,
      pitchStd,
      spectrum,
      centroid,
      zcr,
      voiced,
      delta,
      rms,
    },
  }
}

function pitchSimilarity(reference: AudioFeatures, current: AudioFeatures) {
  if (reference.pitchMeanHz <= 0 || current.pitchMeanHz <= 0 || reference.voicedRatio < 0.2 || current.voicedRatio < 0.2) {
    return 0.5
  }

  const octaveDistance = Math.abs(Math.log2(current.pitchMeanHz / reference.pitchMeanHz))
  return clamp01(1 - (octaveDistance / 0.38))
}

function estimatePitchHz(frame: number[], sampleRate: number) {
  const normalized = removeDc(frame)
  const minLag = Math.floor(sampleRate / 350)
  const maxLag = Math.floor(sampleRate / 75)
  let bestLag = 0
  let bestScore = 0

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0
    let energyA = 0
    let energyB = 0
    for (let index = 0; index < normalized.length - lag; index += 1) {
      const a = normalized[index]
      const b = normalized[index + lag]
      correlation += a * b
      energyA += a * a
      energyB += b * b
    }

    const score = correlation / Math.sqrt((energyA * energyB) || 1)
    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }

  return bestScore > 0.36 && bestLag > 0 ? sampleRate / bestLag : 0
}

function bandEnergies(frame: number[], sampleRate: number) {
  const windowed = applyHann(removeDc(frame))
  return BAND_FREQUENCIES.map((frequency) => goertzelPower(windowed, sampleRate, frequency))
}

function goertzelPower(samples: number[], sampleRate: number, frequency: number) {
  const omega = (2 * Math.PI * frequency) / sampleRate
  const coeff = 2 * Math.cos(omega)
  let q0 = 0
  let q1 = 0
  let q2 = 0

  for (const sample of samples) {
    q0 = coeff * q1 - q2 + sample
    q2 = q1
    q1 = q0
  }

  return Math.max(0, (q1 * q1) + (q2 * q2) - coeff * q1 * q2)
}

function applyHann(samples: number[]) {
  const lastIndex = Math.max(1, samples.length - 1)
  return samples.map((sample, index) => sample * (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / lastIndex)))
}

function removeDc(samples: number[]) {
  const average = mean(samples)
  return samples.map((sample) => sample - average)
}

function frameRootMeanSquare(samples: number[]) {
  return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length)
}

function mean(values: number[]) {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: number[], average = mean(values)) {
  if (values.length <= 1) {
    return 0
  }
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1))
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0
  let magnitudeA = 0
  let magnitudeB = 0
  const length = Math.min(a.length, b.length)

  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index]
    magnitudeA += a[index] * a[index]
    magnitudeB += b[index] * b[index]
  }

  return clamp01(dot / Math.sqrt((magnitudeA * magnitudeB) || 1))
}

function similarity(reference: number, current: number, tolerance: number) {
  const distance = Math.abs(reference - current)
  return clamp01(1 - (distance / tolerance))
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function pcm16Base64ToFloatSamples(base64Pcm: string) {
  const binary = atob(base64Pcm)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  const view = new DataView(bytes.buffer)
  const samples = new Array<number>(bytes.byteLength / 2)

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 0x8000
  }

  return samples
}
