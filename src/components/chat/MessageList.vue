<script setup>
import { ref, watch, nextTick } from "vue";
import MessageItem from "./MessageItem.vue";

const props = defineProps({
  messages: { type: Array, required: true },
  isLoading: { type: Boolean, default: false },
  isStreaming: { type: Boolean, default: false },
});

const container = ref(null);
const isAtBottom = ref(true);

function handleScroll() {
  const el = container.value;
  if (!el) return;
  const threshold = 32;
  isAtBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
}

watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    const el = container.value;
    if (!el) return;
    if (isAtBottom.value) el.scrollTop = el.scrollHeight;
  }
);
</script>

<template>
  <div
    ref="container"
    class="flex-1 overflow-y-auto px-3 py-2 space-y-2"
    @scroll="handleScroll"
  >
    <div v-if="isLoading" class="text-center text-neutral-500 text-sm py-4">Loading…</div>
    <MessageItem
      v-for="(m, idx) in messages"
      :key="idx"
      :role="m.role"
      :content="m.content"
      :error="m.error"
      :isStreaming="isStreaming && idx === messages.length - 1 && m.role === 'assistant'"
    />
    <div v-if="!isLoading && messages.length === 0" class="text-center text-neutral-500 text-sm py-8">
      No messages yet.
    </div>
  </div>
</template>

