<script setup>
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { showErrorToast } from '@/lib/toast'

const emit = defineEmits(['close'])
const props = defineProps({ isOpen: { type: Boolean, default: false } })

const messages = ref([{ role: 'assistant', content: 'Ask me about your spend.' }])
const input = ref('')
const isSending = ref(false)
const errorMessage = ref('')

async function sendMessage() {
	const q = input.value.trim()
	if (!q || isSending.value) return
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

		messages.value[pendingIndex] = { role: 'assistant', content: json.answer }
	} catch (err) {
		messages.value[pendingIndex] = { role: 'assistant', content: 'Sorry, I had trouble answering that.' }
		errorMessage.value = err?.message || 'Something went wrong'
		showErrorToast(errorMessage.value)
	} finally {
		isSending.value = false
	}
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/30">
    <div class="w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold">Chat</h2>
        <button class="text-gray-500 hover:text-gray-700" @click="$emit('close')">✕</button>
      </div>
      <div class="h-56 overflow-y-auto space-y-2 border border-gray-100 dark:border-gray-700 rounded-md p-3 mb-3">
        <div v-for="(m, i) in messages" :key="i" class="text-sm" :class="m.role === 'user' ? 'text-right' : 'text-left'">
          <span class="inline-block px-3 py-2 rounded-lg" :class="m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'">{{ m.content }}</span>
        </div>
      </div>
      <p v-if="errorMessage" class="text-sm text-red-600 mb-2">{{ errorMessage }}</p>
      <div class="flex items-center gap-2">
        <input class="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" v-model="input" :disabled="isSending" placeholder="Ask a question..." @keydown.enter="sendMessage" />
        <button class="bg-blue-600 text-white px-4 py-2 rounded-md disabled:opacity-50" :disabled="isSending" @click="sendMessage">{{ isSending ? 'Sending…' : 'Send' }}</button>
      </div>
    </div>
  </div>
</template>