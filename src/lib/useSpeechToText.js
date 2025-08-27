import { ref, onBeforeUnmount } from 'vue'

/**
 * Wraps the browser Web Speech API for simple voice-to-text.
 * Inputs: none. Optionally pass config to start({ language, continuous, interimResults }).
 * Returns: { isSupported, isListening, transcript, errorMessage, start, stop }.
 * Throws: never for runtime API errors; sets errorMessage instead. Only throws on misuse in dev.
 */
export function useSpeechToText() {
  const isSupported = ref(false)
  const isListening = ref(false)
  const transcript = ref('')
  const errorMessage = ref('')

  let RecognitionCtor = null
  let recognition = null

  function detectSupport() {
    try {
      // Some browsers expose webkit-prefixed constructor
      RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null
      isSupported.value = Boolean(RecognitionCtor)
    } catch (_) {
      RecognitionCtor = null
      isSupported.value = false
    }
  }

  function start(options = {}) {
    if (!isSupported.value) return
    if (isListening.value) return

    const { language, continuous = false, interimResults = false } = options

    // Reset state
    transcript.value = ''
    errorMessage.value = ''

    try {
      recognition = new RecognitionCtor()
      recognition.lang = language || navigator.language || 'en-US'
      recognition.continuous = Boolean(continuous)
      recognition.interimResults = Boolean(interimResults)

      recognition.onresult = (event) => {
        try {
          let finalText = ''
          // Iterate all results and pick the best alternative for final results
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i]
            if (result.isFinal) {
              finalText += result[0]?.transcript || ''
            }
          }
          if (finalText) transcript.value = finalText.trim()
        } catch (err) {
          errorMessage.value = (err && err.message) || 'Speech processing failed'
        }
      }

      recognition.onerror = (event) => {
        const code = event?.error || 'unknown-error'
        errorMessage.value = code
        isListening.value = false
      }

      recognition.onend = () => {
        isListening.value = false
      }

      recognition.onstart = () => {
        isListening.value = true
      }

      recognition.start()
    } catch (err) {
      errorMessage.value = (err && err.message) || 'Speech recognition failed to start'
      isListening.value = false
    }
  }

  function stop() {
    if (!recognition) return
    if (!isListening.value) return
    try {
      recognition.stop()
    } catch (_) {
      // no-op
    }
  }

  onBeforeUnmount(() => {
    if (recognition) {
      try { recognition.stop() } catch (_) {}
      recognition = null
    }
  })

  // Initialize support on first use
  if (typeof window !== 'undefined') detectSupport()

  return { isSupported, isListening, transcript, errorMessage, start, stop }
}

