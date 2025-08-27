<script setup>
import { ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { showErrorToast } from '@/lib/toast'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'
import { useSpeechToText } from '@/lib/useSpeechToText'
import IconMicrophone from './icons/IconMicrophone.vue'
import IconStop from './icons/IconStop.vue'


const emit = defineEmits(['close', 'added'])
const props = defineProps({ isOpen: { type: Boolean, default: false } })

const messages = ref([{ role: 'assistant', content: 'Ask me about your spend.' }])
const input = ref('')
const isSending = ref(false)
const errorMessage = ref('')

// Voice to text
const { isSupported: isSttSupported, isListening, transcript, errorMessage: sttError, start: startStt, stop: stopStt } = useSpeechToText()

watch(transcript, (t) => {
  if (t && typeof t === 'string') {
    input.value = t
  }
})

watch(sttError, (e) => {
  if (e) {
    showErrorToast(e)
  }
})

async function sendMessage() {
	const q = input.value.trim()
	if (!q || isSending.value) return
	// stop STT if active before sending
	try { if (isListening.value) stopStt() } catch (_) {}
	messages.value.push({ role: 'user', content: q })
	input.value = ''
	errorMessage.value = ''
	isSending.value = true

	// Placeholder for assistant while loading
	const pendingIndex = messages.value.push({ role: 'assistant', content: 'Thinking…' }) - 1

	try {
		const { data } = await supabase.auth.getSession()
		const token = data?.session?.access_token
		if (!token) throw new Error('Not authenticated')

		const res = await fetch('/.netlify/functions/chat', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'authorization': `Bearer ${token}`,
			},
			body: JSON.stringify({ question: q }),
		})

		const json = await res.json().catch(() => ({}))
		if (!res.ok) throw new Error(json.error || 'Failed to get answer')

		// If backend added items, emit to parent and show confirmation
		if (json.added && Array.isArray(json.added.items) && json.added.items.length) {
			emit('added', json.added)
			messages.value[pendingIndex] = { role: 'assistant', content: json.answer }
			return
		}

		// If an add attempt was made but no items parsed, show guidance
		if (json.attemptedAdd) {
			messages.value[pendingIndex] = { role: 'assistant', content: 'I couldn’t understand the items. Try: “add bread 3 at 12 each, eggs 2 at 15 each”.' }
			return
		}

		// Otherwise, show the general answer
		messages.value[pendingIndex] = { role: 'assistant', content: json.answer }
		return
	} catch (err) {
		messages.value[pendingIndex] = { role: 'assistant', content: 'Sorry, I had trouble answering that.' }
		errorMessage.value = err?.message || 'Something went wrong'
	} finally {
		isSending.value = false
	}
}
</script>

<template>
	<v-dialog
		:model-value="isOpen"
		@update:model-value="val => { if (!val) $emit('close') }"
	>
		<v-card>
			<v-card-title class="d-flex align-center justify-space-between">
				<span class="text-h6">Chat</span>
				<v-btn icon="mdi-close" variant="text" @click="() => { try { if (isListening) stopStt() } catch (_) {}; $emit('close') }" aria-label="Close" />
			</v-card-title>
			<v-card-text class="pt-0">
				<v-sheet class="pa-3 mb-3" rounded="md" border style="max-height: 260px; overflow-y: auto;">
					<div v-for="(m, i) in messages" :key="i" class="text-body-2" :class="m.role === 'user' ? 'text-right' : 'text-left'">
						<span class="d-inline-block px-3 py-2 rounded-lg" :class="m.role === 'user' ? 'bg-primary text-white' : 'bg-grey-lighten-3 text-grey-darken-4'">{{ m.content }}</span>
					</div>
				</v-sheet>
				<v-alert v-if="errorMessage" type="error" density="comfortable" class="mb-2">{{ errorMessage }}</v-alert>
        <p v-if="sttError" class="text-xs text-red-600 mb-2">{{ sttError }}</p>
				<div class="d-flex align-center" style="gap: 8px;">
					<v-text-field
						v-model="input"
						label="Ask a question..."
						variant="outlined"
						:disabled="isSending"
						@keydown.enter="sendMessage"
						hide-details
						class="flex-1"
					/>
          <button
            v-if="isSttSupported"
            class="px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            :class="isListening ? 'bg-blue-50 border-blue-200 text-blue-700' : ''"
            :aria-pressed="isListening ? 'true' : 'false'"
            :title="isListening ? 'Stop voice input' : 'Start voice input'"
            :disabled="isSending"
            @click="isListening ? stopStt() : startStt()"
            :aria-label="isListening ? 'Stop voice input' : 'Start voice input'"
          >
            <component :is="isListening ? IconStop : IconMicrophone" />
          </button>
					<v-btn color="primary" :loading="isSending" :disabled="isSending" @click="sendMessage">Send</v-btn>
				</div>
			</v-card-text>
		</v-card>
	</v-dialog>
</template>
