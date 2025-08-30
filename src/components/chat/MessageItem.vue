<script setup>
import { computed } from "vue";

const props = defineProps({
  role: { type: String, required: true },
  content: { type: String, required: true },
  error: { type: Boolean, default: false },
  isStreaming: { type: Boolean, default: false },
});

const isUser = computed(() => props.role === "user");
</script>

<template>
  <div class="w-full flex" :class="isUser ? 'justify-end' : 'justify-start'">
    <div
      class="px-3 py-2 text-sm rounded-2xl max-w-[88%] whitespace-pre-wrap break-words"
      :class="[
        isUser
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 border rounded-bl-sm',
        error ? 'border-red-300 text-red-700 bg-red-50' : ''
      ]"
    >
      <span>{{ content }}</span>
      <span v-if="isStreaming && !isUser" class="inline-block w-1 h-4 ml-1 align-baseline bg-neutral-400 animate-pulse"></span>
    </div>
  </div>
</template>

