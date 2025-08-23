<script setup>
const emit = defineEmits(['navigate'])
const props = defineProps({ current: { type: String, default: 'day' } })
function handleNav(target) { emit('navigate', target) }
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-sm">
    <ul class="flex justify-around py-2 text-sm">
      <li>
        <button
          class="px-4 py-2 rounded-md"
          :class="current === 'day' ? 'text-blue-600 font-semibold' : 'text-gray-600'"
          @click="handleNav('day')"
        >Day</button>
      </li>
      <li>
        <button
          class="px-4 py-2 rounded-md"
          :class="current === 'month' ? 'text-blue-600 font-semibold' : 'text-gray-600'"
          @click="handleNav('month')"
        >Month</button>
      </li>
      <li>
        <button
          class="px-4 py-2 rounded-md"
          :class="current === 'chat' ? 'text-blue-600 font-semibold' : 'text-gray-600'"
          @click="handleNav('chat')"
        >Chat</button>
      </li>
    </ul>
  </nav>
</template>