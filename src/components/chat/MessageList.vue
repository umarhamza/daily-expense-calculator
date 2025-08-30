<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import MessageItem from "./MessageItem.vue";
import { createAutoStick, scrollToBottom, isElementAtBottom, rafThrottle } from "@/lib/ui/scroll";

const props = defineProps({
  messages: { type: Array, required: true },
  isLoading: { type: Boolean, default: false },
  isStreaming: { type: Boolean, default: false },
});

const container = ref(null);
const isAtBottom = ref(true);
let autoStick = null;

function handleScroll() {
  const el = container.value;
  if (!el) return;
  isAtBottom.value = isElementAtBottom(el, 32);
}

watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    const el = container.value;
    if (!el) return;
    if (isAtBottom.value) scrollToBottom(el);
  }
);

function jumpToLatest() {
  const el = container.value;
  if (!el) return;
  scrollToBottom(el);
  isAtBottom.value = true;
}

onMounted(() => {
  const el = container.value;
  if (!el) return;
  autoStick = createAutoStick(el, { threshold: 32 });
  const update = rafThrottle(() => { isAtBottom.value = autoStick.isAtBottom(); });
  el.addEventListener('scroll', update, { passive: true });
});

onBeforeUnmount(() => {
  try { autoStick && autoStick.destroy && autoStick.destroy(); } catch (_) {}
  const el = container.value;
  if (el) {
    // Best-effort cleanup: listeners added in onMounted are removed by destroy, but guard anyway.
  }
});
</script>

<template>
  <div
    ref="container"
    class="flex-1 overflow-y-auto px-3 py-2 space-y-2 relative"
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
    <button
      v-if="!isAtBottom"
      class="absolute right-3 bottom-3 px-3 py-1.5 rounded-full text-sm bg-neutral-800 text-white shadow-md dark:bg-neutral-200 dark:text-neutral-900"
      @click="jumpToLatest"
      aria-label="Jump to latest messages"
    >
      Jump to latest
    </button>
  </div>
</template>

