<script setup>
import { computed } from 'vue'
import { toastState, removeToast, addToast } from '@/lib/toast'

const toasts = computed(() => toastState.items)

/**
 * Copies provided toast text to clipboard with a basic fallback.
 * Shows a short success/failure toast.
 */
async function handleCopy(toast) {
	const text = toast.copyText || toast.message || ''
	try {
		if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
			await navigator.clipboard.writeText(text)
		} else {
			const textarea = document.createElement('textarea')
			textarea.value = text
			textarea.setAttribute('readonly', '')
			textarea.style.position = 'absolute'
			textarea.style.left = '-9999px'
			document.body.appendChild(textarea)
			textarea.select()
			document.execCommand('copy')
			document.body.removeChild(textarea)
		}
		addToast({ type: 'success', title: 'Copied', message: 'Error message copied', timeout: 2000 })
	} catch (e) {
		addToast({ type: 'error', title: 'Copy failed', message: 'Could not copy to clipboard', timeout: 3000 })
	}
}
</script>

<template>
	<div class="fixed top-4 right-4 z-50 flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm">
		<transition-group name="list" tag="div">
			<div
				v-for="t in toasts"
				:key="t.id"
				class="rounded-lg shadow-md p-3 border text-sm"
				:class="{
					'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-100': t.type === 'error',
					'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-100': t.type === 'success',
					'bg-white border-gray-200 text-gray-800 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100': t.type !== 'error' && t.type !== 'success',
				}"
			>
				<div class="flex items-start gap-2">
					<div class="flex-1 min-w-0">
						<div v-if="t.title" class="font-medium truncate">{{ t.title }}</div>
						<div class="mt-0.5 whitespace-pre-wrap break-words">{{ t.message }}</div>
					</div>
					<div class="flex items-center gap-2 ml-2">
						<button
							v-if="(t.copyText || t.message) && t.type === 'error'"
							class="px-2 py-1 rounded-md bg-transparent hover:bg-black/5 dark:hover:bg-white/10 text-xs"
							@click="handleCopy(t)"
						>
							Copy
						</button>
						<button
							class="px-2 py-1 rounded-md bg-transparent hover:bg-black/5 dark:hover:bg-white/10 text-xs"
							@click="removeToast(t.id)"
							aria-label="Dismiss"
						>
							✕
						</button>
					</div>
				</div>
			</div>
		</transition-group>
	</div>
</template>

<style scoped>
.list-enter-active, .list-leave-active { transition: all 0.18s ease; }
.list-enter-from { opacity: 0; transform: translateY(-8px); }
.list-leave-to { opacity: 0; transform: translateY(-8px); }
</style>