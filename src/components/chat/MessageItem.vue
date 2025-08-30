<script setup>
import { ref, computed } from "vue";
import { addToast } from "@/lib/toast";

const props = defineProps({
  role: { type: String, required: true },
  content: { type: String, required: true },
  error: { type: Boolean, default: false },
  isStreaming: { type: Boolean, default: false },
});

const isUser = computed(() => props.role === "user");

const isCopying = ref(false);

async function copyContent() {
  if (!props.content) return;
  try {
    isCopying.value = true;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(props.content);
    } else {
      const area = document.createElement('textarea');
      area.value = props.content;
      area.setAttribute('readonly', '');
      area.style.position = 'absolute';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    addToast({ type: 'success', message: 'Copied to clipboard', timeout: 2000 });
  } catch (e) {
    addToast({ type: 'error', message: 'Copy failed', timeout: 3000 });
  } finally {
    isCopying.value = false;
  }
}
</script>

<template>
  <div class="w-full flex" :class="isUser ? 'justify-end' : 'justify-start'">
    <div
      class="px-3 py-2 text-sm rounded-2xl max-w-[88%] whitespace-pre-wrap break-words group"
      :class="[
        isUser
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 border rounded-bl-sm',
        error ? 'border-red-300 text-red-700 bg-red-50' : ''
      ]"
    >
      <span aria-live="polite">{{ content }}</span>
      <span v-if="isStreaming && !isUser" class="inline-block w-1 h-4 ml-1 align-baseline bg-neutral-400 animate-pulse"></span>
      <button
        v-if="!isUser"
        class="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-xs px-2 py-0.5 rounded border border-neutral-300 text-neutral-700 dark:text-neutral-200 dark:border-neutral-600"
        :disabled="isCopying"
        @click="copyContent"
        aria-label="Copy message"
      >
        Copy
      </button>
    </div>
  </div>
</template>

