<script setup>
import { ref } from 'vue'
import AutocompleteInput from './AutocompleteInput.vue'

const emit = defineEmits(['close', 'save'])
const props = defineProps({
  isOpen: { type: Boolean, default: false },
  defaultDate: { type: String, required: true },
})

const item = ref('')
const cost = ref('')
const suggestions = ['Bread', 'Milk', 'Coffee', 'Groceries', 'Taxi', 'Dinner', 'Snacks']

function handleSave() {
  const parsed = Number.parseFloat(cost.value)
  if (!item.value || Number.isNaN(parsed)) return
  emit('save', { item: item.value, cost: parsed, date: props.defaultDate })
  item.value = ''
  cost.value = ''
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-20 flex items-end sm:items-center justify-center bg-black/30">
    <div class="w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold">Add Expense</h2>
        <button class="text-gray-500 hover:text-gray-700" @click="$emit('close')">✕</button>
      </div>
      <div class="space-y-3">
        <AutocompleteInput v-model="item" :suggestions="suggestions" />
        <input
          class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          inputmode="decimal"
          placeholder="Cost"
          v-model="cost"
        />
        <button class="w-full bg-blue-600 text-white font-medium py-2 rounded-md" @click="handleSave">Save</button>
      </div>
    </div>
  </div>
</template>