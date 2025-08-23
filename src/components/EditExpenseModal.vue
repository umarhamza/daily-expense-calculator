<script setup>
import { ref, watch, computed } from 'vue'

const emit = defineEmits(['close', 'save', 'delete'])
const props = defineProps({
  isOpen: { type: Boolean, default: false },
  expense: { type: Object, required: true }, // { id, item, cost, date }
})

const item = ref('')
const cost = ref('')
const date = ref('')

watch(() => props.expense, (e) => {
  if (!e) return
  item.value = e.item ?? ''
  cost.value = Number.isFinite(e.cost) ? String(e.cost) : ''
  date.value = e.date ?? ''
}, { immediate: true })

const isValid = computed(() => !!item.value && !Number.isNaN(Number.parseFloat(cost.value)) && /^\d{4}-\d{2}-\d{2}$/.test(date.value))

function handleSave() {
  const parsedCost = Number.parseFloat(cost.value)
  if (!isValid.value) return
  emit('save', { id: props.expense.id, item: item.value, cost: parsedCost, date: date.value })
}

function handleDelete() {
  emit('delete', { id: props.expense.id })
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-20 flex items-end sm:items-center justify-center bg-black/30">
    <div class="w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold">Edit Expense</h2>
        <button class="text-gray-500 hover:text-gray-700" @click="$emit('close')">✕</button>
      </div>
      <div class="space-y-3">
        <input
          class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="text"
          placeholder="Item"
          v-model="item"
        />
        <input
          class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          inputmode="decimal"
          placeholder="Cost"
          v-model="cost"
        />
        <input
          class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="date"
          v-model="date"
        />
        <div class="flex items-center justify-between gap-3">
          <button class="flex-1 bg-blue-600 text-white font-medium py-2 rounded-md disabled:opacity-50" :disabled="!isValid" @click="handleSave">Save</button>
          <button class="px-3 py-2 text-red-600 border border-red-200 rounded-md" @click="handleDelete" aria-label="Delete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>