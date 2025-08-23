<script setup>
import { ref, computed } from 'vue'
import AddExpenseModal from './AddExpenseModal.vue'

const props = defineProps({ date: { type: String, required: true } })
const emit = defineEmits(['changeDate'])

const expenses = ref([])
const isModalOpen = ref(false)

function openModal() { isModalOpen.value = true }
function closeModal() { isModalOpen.value = false }
function addExpense(e) { expenses.value = [e, ...expenses.value]; closeModal() }

const total = computed(() => expenses.value.reduce((s, e) => s + e.cost, 0))
function goToday() {
  const today = new Date()
  const iso = today.toISOString().slice(0, 10)
  emit('changeDate', iso)
}
</script>

<template>
  <div class="pb-16">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-semibold">{{ date }}</h1>
      <button class="text-sm text-blue-600" v-if="date !== new Date().toISOString().slice(0,10)" @click="goToday">Today</button>
    </header>

    <div class="space-y-2">
      <div v-for="(e, i) in expenses" :key="i" class="flex items-center justify-between  bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3">
        <div class="font-medium">{{ e.item }}</div>
        <div class="text-gray-700 dark:text-gray-200">${{ e.cost.toFixed(2) }}</div>
      </div>
      <div v-if="!expenses.length" class="text-center text-gray-400 dark:text-gray-400 py-10">No expenses yet</div>
    </div>

    <div class="mt-6 flex items-center justify-between text-gray-800 dark:text-gray-200">
      <div class="font-semibold">Total</div>
      <div class="font-semibold">${{ total.toFixed(2) }}</div>
    </div>

    <button class="fixed bottom-16 right-4 bg-blue-600 text-white rounded-full w-12 h-12 text-2xl shadow-lg" @click="openModal">+</button>

    <AddExpenseModal :isOpen="isModalOpen" :defaultDate="date" @close="closeModal" @save="addExpense" />
  </div>
</template>