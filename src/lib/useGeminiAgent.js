import { ref } from 'vue'
import { runGemini } from '@/lib/geminiAgent'

/**
 * Vue composable to interact with the Gemini strict JSON agent.
 * Inputs: none.
 * Returns: { isLoading, error, send }
 * Throws: never from composable; errors surfaced via state.
 */
export function useGeminiAgent() {
  const isLoading = ref(false)
  const error = ref(null)

  async function send(message) {
    isLoading.value = true
    error.value = null
    try {
      const result = await runGemini(message)
      return result
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Unexpected error')
      return null
    } finally {
      isLoading.value = false
    }
  }

  return { isLoading, error, send }
}

