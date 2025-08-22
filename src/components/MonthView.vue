<script setup>
import { computed, ref, watchEffect } from 'vue'

const props = defineProps({ monthDate: { type: String, required: true } })

const expenses = ref([])

const grouped = computed(() => {
  const totals = new Map()
  for (const e of expenses.value) {
    const prev = totals.get(e.item) ?? 0
    totals.set(e.item, prev + e.cost)
  }
  return Array.from(totals.entries()).map(([item, sum]) => ({ item, sum }))
})

const grandTotal = computed(() => grouped.value.reduce((s, g) => s + g.sum, 0))
</script>

<template>
  <div class="pb-16">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-semibold">{{ monthDate.slice(0, 7) }}</h1>
    </header>

    <div class="space-y-2">
      <div v-for="g in grouped" :key="g.item" class="flex items-center justify-between bg-white border border-gray-100 rounded-lg p-3">
        <div class="font-medium">{{ g.item }}</div>
        <div class="text-gray-700">${{ g.sum.toFixed(2) }}</div>
      </div>
      <div v-if="!grouped.length" class="text-center text-gray-500 py-10">No data for this month</div>
    </div>

    <div class="mt-6 flex items-center justify-between text-gray-800">
      <div class="font-semibold">Total</div>
      <div class="font-semibold">${{ grandTotal.toFixed(2) }}</div>
    </div>
  </div>
</template>