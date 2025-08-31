<script setup>
import { ref, watch, onMounted } from "vue";

const props = defineProps({
  modelValue: { type: String, default: "" },
  isSending: { type: Boolean, default: false },
  isListening: { type: Boolean, default: false },
  sttSupported: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue", "send", "stop", "toggleStt"]);

const textarea = ref(null);

function handleKeydown(e) {
  // Respect IME composition
  if (e.isComposing) return;
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    emit('send');
  }
}

function autoResize() {
  const el = textarea.value;
  if (!el) return;
  el.style.height = 'auto';
  const max = 5 * 24; // approx 5 lines of 24px
  el.style.height = Math.min(el.scrollHeight, max) + 'px';
}

watch(() => props.modelValue, autoResize);
onMounted(autoResize);
</script>

<template>
  <div class="sticky bottom-0 z-10 border-t bg-neutral-50/80 backdrop-blur px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
    <div class="flex gap-2 items-end">
      <textarea
        ref="textarea"
        class="flex-1 resize-none rounded-xl border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        :value="modelValue"
        :placeholder="props.isSending ? 'Sending…' : 'Send a message'"
        :disabled="isSending"
        rows="1"
        @input="$emit('update:modelValue', $event.target.value)"
        @keydown="handleKeydown"
        aria-label="Message composer"
      />
      <button
        v-if="sttSupported"
        class="px-3 py-2 rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        :class="isListening ? 'bg-blue-50 border-blue-200 text-blue-700' : ''"
        :disabled="isSending"
        @click="$emit('toggleStt')"
        :aria-label="isListening ? 'Stop voice input' : 'Start voice input'"
      >
        <span v-if="!isListening">🎙️</span>
        <span v-else>■</span>
      </button>
      <button
        class="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
        :disabled="isSending || !modelValue.trim()"
        @click="$emit('send')"
        aria-label="Send message"
      >
        Send
      </button>
    </div>
  </div>
</template>

