// Kokoro-82M running fully in the browser (WebGPU with WASM fallback) via
// Transformers.js - free, no external API, studio-grade quality (rated A/A-
// on the model's own English voice quality benchmarks). The base model
// (~86-138MB in q8) downloads once and is cached by the browser; switching
// between voices below does NOT re-download the base model, only a small
// per-voice style vector.

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

// Curated to only the top-quality English voices (Kokoro ships 50+, most of
// them low-grade). Grades below are from the model card's own quality rating.
export const VOICE_OPTIONS = [
  { id: 'af_heart', label: 'Heart (US, female) — grade A', accent: 'American' },
  { id: 'af_bella', label: 'Bella (US, female) — grade A-', accent: 'American' },
  { id: 'bf_emma', label: 'Emma (UK, female) — grade B-', accent: 'British' },
  { id: 'am_fenrir', label: 'Fenrir (US, male) — grade C+', accent: 'American' },
  { id: 'am_michael', label: 'Michael (US, male) — grade C+', accent: 'American' }
]

const selectedVoice = useLocalStorage<string>('vocab_app_voice_id', 'af_heart')

let ttsInstance: any = null
let loadingPromise: Promise<any> | null = null

export function useTTS() {
  const downloading = ref(false)
  const downloadProgress = ref(0)
  const modelReady = ref(false)

  async function ensureModel() {
    if (typeof window === 'undefined') return null
    if (ttsInstance) {
      modelReady.value = true
      return ttsInstance
    }
    if (loadingPromise) return loadingPromise

    downloading.value = true
    loadingPromise = (async () => {
      try {
        const { KokoroTTS } = await import('kokoro-js')
        ttsInstance = await KokoroTTS.from_pretrained(MODEL_ID, {
          dtype: 'q8',
          device: 'webgpu', // falls back to wasm internally if unavailable
          progress_callback: (p: any) => {
            if (p.progress) downloadProgress.value = Math.round(p.progress)
          }
        })
        modelReady.value = true
        return ttsInstance
      } catch (e) {
        // WebGPU may be unavailable - retry once on wasm before giving up
        try {
          const { KokoroTTS } = await import('kokoro-js')
          ttsInstance = await KokoroTTS.from_pretrained(MODEL_ID, {
            dtype: 'q8',
            device: 'wasm',
            progress_callback: (p: any) => {
              if (p.progress) downloadProgress.value = Math.round(p.progress)
            }
          })
          modelReady.value = true
          return ttsInstance
        } catch (e2) {
          return null
        }
      } finally {
        downloading.value = false
      }
    })()
    return loadingPromise
  }

  // Instant fallback (native browser voice), used only if Kokoro truly fails
  // to load (e.g. very old browser, no WebGPU/WASM support at all)
  function speakFallback(word: string) {
    if (!window.speechSynthesis) return
    const u = new SpeechSynthesisUtterance(word)
    u.lang = 'en-US'
    u.rate = 0.9
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }

  async function speak(word: string) {
    const tts = await ensureModel()
    if (!tts) return speakFallback(word)
    try {
      const audio = await tts.generate(word, { voice: selectedVoice.value })
      const blob = audio.toBlob ? audio.toBlob() : audio
      const player = new Audio(URL.createObjectURL(blob))
      player.play()
    } catch {
      speakFallback(word)
    }
  }

  return { speak, downloading, downloadProgress, modelReady, selectedVoice, voiceOptions: VOICE_OPTIONS }
}
