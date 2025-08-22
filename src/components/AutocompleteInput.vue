<script setup>
import { ref, computed, watch } from 'vue'

const emit = defineEmits(['update:modelValue'])
const props = defineProps({
  modelValue: { type: String, default: '' },
  suggestions: { type: Array, default: () => [] },
})

const query = ref(props.modelValue)
watch(() => props.modelValue, v => (query.value = v))
watch(query, v => emit('update:modelValue', v))

const isOpen = ref(false)
const filtered = computed(() => {
  const q = (query.value || '').toLowerCase()
  if (!q) return []
  return props.suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 6)
})

function selectSuggestion(s) {
  query.value = s
  isOpen.value = false
}
</script>

<template>
  <div class="relative">
    <input
      class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      type="text"
      placeholder="Item"
      v-model="query"
      @focus="isOpen = true"
      @blur="setTimeout(() => (isOpen = false), 120)"
    />
    <ul v-if="isOpen && filtered.length" class="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow">
      <li
        v-for="s in filtered"
        :key="s"
        class="px-3 py-2 hover:bg-gray-50 cursor-pointer"
        @mousedown.prevent="selectSuggestion(s)"
      >{{ s }}</li>
    </ul>
  </div>
</template>